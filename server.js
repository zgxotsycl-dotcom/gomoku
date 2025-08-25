require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { nanoid } = require('nanoid');
const { createClient } = require('@supabase/supabase-js');

// --- Supabase Admin Client ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

const rooms = {}; // In-memory store for room state
const publicMatchmakingQueue = [];

// --- Helper Functions ---
const broadcastRoomState = (roomId) => {
  if (!rooms[roomId]) return;
  const room = rooms[roomId];
  const state = {
    gameState: room.gameState,
    players: room.players,
    spectatorCount: room.spectators.size,
  };
  io.to(roomId).emit('room-state-update', state);
};


io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);

  socket.on('authenticate', (userId) => {
    socket.userId = userId;
    console.log(`Socket ${socket.id} authenticated as user ${userId}`);
  });

  // --- Public Matchmaking ---
  socket.on('join-public-queue', (userProfile) => {
    console.log(`User ${userProfile.username} (${socket.userId}) joined the public queue.`);
    publicMatchmakingQueue.push({ socketId: socket.id, profile: userProfile });

    if (publicMatchmakingQueue.length >= 2) {
      const player1 = publicMatchmakingQueue.shift();
      const player2 = publicMatchmakingQueue.shift();
      const roomId = nanoid(7);

      rooms[roomId] = {
        players: {
          [player1.socketId]: { role: 'black', ...player1.profile },
          [player2.socketId]: { role: 'white', ...player2.profile },
        },
        spectators: new Set(),
        gameState: 'playing',
        rematchVotes: new Set(),
        isPrivate: false,
      };
      
      const player1Socket = io.sockets.sockets.get(player1.socketId);
      const player2Socket = io.sockets.sockets.get(player2.socketId);

      if (player1Socket && player2Socket) {
        player1Socket.join(roomId);
        player2Socket.join(roomId);

        player1Socket.emit('assign-role', 'black');
        player2Socket.emit('assign-role', 'white');

        io.to(roomId).emit('game-start', { roomId, players: rooms[roomId].players });
        console.log(`Public game starting for ${player1.profile.username} and ${player2.profile.username} in room ${roomId}`);
        
        supabase.from('active_games').insert({
          room_id: roomId,
          player1_id: player1.profile.id,
          player2_id: player2.profile.id
        }).then(({ error }) => {
          if (error) console.error('Error creating active game:', error);
        });
      }
    }
  });

  // --- Private Room Logic ---
  socket.on('create-private-room', (userProfile) => {
    const roomId = nanoid(7);
    rooms[roomId] = {
        players: { [socket.id]: { role: 'black', ...userProfile } },
        spectators: new Set(),
        gameState: 'waiting',
        rematchVotes: new Set(),
        isPrivate: true,
    };
    socket.join(roomId);
    console.log(`User ${socket.userId} created private room ${roomId}`);
    socket.emit('room-created', roomId);
    socket.emit('assign-role', 'black');
    broadcastRoomState(roomId);
  });

  socket.on('join-private-room', (roomId, userProfile) => {
    const room = rooms[roomId];
    if (!room) {
      return socket.emit('room-full-or-invalid');
    }

    if (room.gameState === 'playing' || Object.keys(room.players).length >= 2) {
      room.spectators.add(socket.id);
      socket.join(roomId);
      console.log(`User ${socket.userId} joined room ${roomId} as a spectator`);
      socket.emit('joined-as-spectator', { roomId, players: room.players });
      broadcastRoomState(roomId);
    } else if (Object.keys(room.players).length < 2) {
      room.players[socket.id] = { role: 'white', ...userProfile };
      socket.join(roomId);
      room.gameState = 'playing';
      console.log(`User ${socket.userId} joined room ${roomId} as white`);
      socket.emit('assign-role', 'white');
      io.to(roomId).emit('game-start', { roomId, players: room.players });
      broadcastRoomState(roomId);
    }
  });

  // --- In-Game and Post-Game Logic ---
  socket.on('player-move', (data) => {
    io.to(data.room).emit('game-state-update', { move: data.move, newPlayer: data.newPlayer });
  });

  socket.on('send-emoticon', (data) => {
    // Relay emoticon to everyone in the room including the sender
    io.to(data.room).emit('new-emoticon', { 
        fromId: socket.userId, // Use the authenticated user ID
        emoticon: data.emoticon 
    });
  });

  socket.on('game-over', async (data) => {
    const room = rooms[data.roomId];
    if (!room) return;

    room.gameState = 'post-game';
    io.to(data.roomId).emit('game-over-update', { winner: data.winner });
    console.log(`Game over in room ${data.roomId}. Winner: ${data.winner}`);

    if (!room.isPrivate) {
      const { error } = await supabase.from('active_games').delete().eq('room_id', data.roomId);
      if (error) console.error('Error deleting active game:', error);
    }
  });

  socket.on('rematch-vote', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'post-game') return;

    room.rematchVotes.add(socket.id);
    if (room.rematchVotes.size === Object.keys(room.players).length) {
      console.log(`Rematch starting in room ${roomId}`);
      room.gameState = 'playing';
      room.rematchVotes.clear();
      io.to(roomId).emit('new-game-starting');
    }
  });

  socket.on('request-to-join', (roomId) => {
    // Logic for spectator to become a player
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    let disconnectedRoomId = null;

    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        disconnectedRoomId = roomId;
        delete room.players[socket.id];
        io.to(roomId).emit('opponent-disconnected');
        break;
      } else if (room.spectators.has(socket.id)) {
        room.spectators.delete(socket.id);
        broadcastRoomState(roomId);
        break;
      }
    }

    if (disconnectedRoomId) {
        const room = rooms[disconnectedRoomId];
        if (Object.keys(room.players).length === 0) {
            delete rooms[disconnectedRoomId];
        } else {
            if (!room.isPrivate) {
                const { error } = await supabase.from('active_games').delete().eq('room_id', disconnectedRoomId);
                if (error) console.error('Error deleting active game on disconnect:', error);
                delete rooms[disconnectedRoomId];
            }
        }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});