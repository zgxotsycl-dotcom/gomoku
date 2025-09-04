require('dotenv').config({ path: '.env.local' });
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
  path: "/socket.io/",
  cors: {
    origin: ["http://localhost:3000", "https://www.omokk.com", /\.vercel\.app$/],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3002;

const rooms = {}; // In-memory store for room state
const publicMatchmakingQueue = [];

// New Timer Constants
const BASE_TURN_DURATION = 5000; // 5 seconds
const INCREMENT = 1000; // 1 second
const MAX_TURN_DURATION = 30000; // 30 seconds

// --- Helper Functions ---
const startTurnTimer = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;

  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
  }

  const currentTurnDuration = room.turnLimit;
  room.turnEndsAt = Date.now() + currentTurnDuration;
  broadcastRoomState(roomId); // Broadcast state with new timer info

  room.turnTimer = setTimeout(async () => {
    if (room.gameState !== 'playing') return;

    console.log(`Turn timer expired for room ${roomId}. Player ${room.currentPlayer} forfeits.`);
    const winnerRole = room.currentPlayer === 'black' ? 'white' : 'black';
    
    room.gameState = 'post-game';
    io.to(roomId).emit('game-over-update', { winner: winnerRole, reason: 'timeout' });
    console.log(`Game over in room ${roomId}. Winner by timeout: ${winnerRole}`);

    if (!room.isPrivate) {
      const { error } = await supabase.from('active_games').delete().eq('room_id', roomId);
      if (error) console.error('Error deleting active game on timeout:', error);
    }
  }, currentTurnDuration);
};

const broadcastRoomState = (roomId) => {
  if (!rooms[roomId]) return;
  const room = rooms[roomId];
  const state = {
    gameState: room.gameState,
    players: room.players,
    spectatorCount: room.spectators.size,
    currentPlayer: room.currentPlayer,
    turnEndsAt: room.turnEndsAt,
    // We can also send blackTime and whiteTime if we manage it on the server
  };
  io.to(roomId).emit('room-state-update', state);
};


const broadcastUserCounts = () => {
  const onlineUsers = io.engine.clientsCount;
  const inQueueUsers = publicMatchmakingQueue.length;
  io.emit('user-counts-update', { onlineUsers, inQueueUsers });
};

io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);
  broadcastUserCounts();

  socket.on('request-user-counts', () => {
    broadcastUserCounts();
  });

  socket.on('authenticate', (userId) => {
    socket.userId = userId;
    console.log(`Socket ${socket.id} authenticated as user ${userId}`);
  });

  // --- Public Matchmaking ---
  socket.on('join-public-queue', (userProfile) => {
    if (publicMatchmakingQueue.some(p => p.profile.id === userProfile.id)) {
      console.log(`User ${userProfile.username} (${userProfile.id}) is already in the queue.`);
      return;
    }

    console.log(`User ${userProfile.username} (${socket.userId}) joined the public queue.`);
    publicMatchmakingQueue.push({ socketId: socket.id, profile: userProfile });
    broadcastUserCounts();

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
        currentPlayer: 'black',
        turnTimer: null,
        turnEndsAt: null,
        turnLimit: BASE_TURN_DURATION, // Initialize turn limit
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
        startTurnTimer(roomId);
        
        supabase.from('active_games').insert({
          room_id: roomId,
          player1_id: player1.profile.id,
          player2_id: player2.profile.id
        }).then(({ error }) => {
          if (error) console.error('Error creating active game:', error);
        });
      }
      broadcastUserCounts();
    }
  });

  // --- Private Room Logic ---
  socket.on('create-private-room', (userProfile) => {
    const roomId = nanoid(7);
    rooms[roomId] = {
        players: { [socket.id]: { role: 'black', ...userProfile } },
        spectators: new Set(),
        gameState: 'waiting',
        currentPlayer: 'black',
        turnTimer: null,
        turnEndsAt: null,
        turnLimit: BASE_TURN_DURATION, // Initialize turn limit
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
      startTurnTimer(roomId);
    }
  });

  // --- In-Game and Post-Game Logic ---
  socket.on('player-move', (data) => {
    const room = rooms[data.room];
    if (!room || !room.players[socket.id] || room.players[socket.id].role !== room.currentPlayer) {
        return; // Ignore move if it's not the player's turn, or player doesn't exist
    }

    // Increment turn limit before starting next turn
    room.turnLimit = Math.min(MAX_TURN_DURATION, room.turnLimit + INCREMENT);

    const newPlayer = room.currentPlayer === 'black' ? 'white' : 'black';
    room.currentPlayer = newPlayer;

    io.to(data.room).emit('game-state-update', { move: data.move, newPlayer: newPlayer });
    
    startTurnTimer(data.room);
  });

  socket.on('send-emoticon', (data) => {
    io.to(data.room).emit('new-emoticon', { 
        fromId: socket.userId,
        emoticon: data.emoticon 
    });
  });

  socket.on('game-over', async (data) => {
    const room = rooms[data.roomId];
    if (!room) return;

    if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
    }

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
      room.currentPlayer = 'black';
      room.turnLimit = BASE_TURN_DURATION; // Reset turn limit on rematch
      room.rematchVotes.clear();
      io.to(roomId).emit('new-game-starting');
      startTurnTimer(roomId);
    }
  });

  socket.on('request-to-join', (roomId) => {
    // Logic for spectator to become a player
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);

    // Remove from matchmaking queue if present
    const queueIndex = publicMatchmakingQueue.findIndex(p => p.socketId === socket.id);
    if (queueIndex !== -1) {
      publicMatchmakingQueue.splice(queueIndex, 1);
      console.log(`User ${socket.id} removed from public queue.`);
    }

    let disconnectedRoomId = null;

    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        disconnectedRoomId = roomId;
        if (room.turnTimer) {
            clearTimeout(room.turnTimer);
        }
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
        if (room && Object.keys(room.players).length === 0) {
            delete rooms[disconnectedRoomId];
        } else if (room) {
            if (!room.isPrivate) {
                const { error } = await supabase.from('active_games').delete().eq('room_id', disconnectedRoomId);
                if (error) console.error('Error deleting active game on disconnect:', error);
                delete rooms[disconnectedRoomId];
            }
        }
    }
    broadcastUserCounts();
  });
});

server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});