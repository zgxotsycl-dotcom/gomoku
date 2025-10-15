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
const allowedOrigins = (process.env.SOCKET_CORS_ORIGINS || '').split(',').filter(Boolean);
const io = new Server(server, {
  path: "/socket.io/",
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : ["http://localhost:3000", /https?:\/\/.*\.vercel\.app$/],
    methods: ["GET", "POST"],
    credentials: true,
  }
});

const PORT = process.env.PORT || 3002;

const rooms = {}; // In-memory store for room state
const publicMatchmakingQueue = [];

// New Timer Constants
const BASE_TURN_DURATION = 5000; // 5 seconds
const INCREMENT = 1000; // 1 second
const MAX_TURN_DURATION = 30000; // 30 seconds
const MIN_MOVES_FOR_ELO = 10; // Require some moves before rating changes

// --- Swap2 helper (server-side simple proposer) ---
function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}
function firstEmptyAround(board, r0, c0, rings = 2) {
  const n = board.length;
  for (let rad = 1; rad <= rings; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r >= 0 && c >= 0 && r < n && c < n && board[r][c] == null) return [r, c];
      }
    }
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (board[r][c] == null) return [r, c];
  return [-1, -1];
}
function proposeInitialTripleServer(size = 15) {
  const mid = Math.floor(size / 2);
  const b = createEmptyBoard(size);
  b[mid][mid] = 'black';
  let [wr, wc] = firstEmptyAround(b, mid, mid, 1);
  if (wr !== -1) b[wr][wc] = 'white';
  let [br, bc] = firstEmptyAround(b, mid, mid, 1);
  if (br !== -1) b[br][bc] = 'black';
  return { board: b, toMove: 'white' };
}

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
    // ELO update on timeout (treat as standard win/loss)
    try {
      const players = Object.values(room.players);
      const black = players.find(p => p.role === 'black');
      const white = players.find(p => p.role === 'white');
      if (black && white && !room.isPrivate && !isLikelyGuestId(black.id) && !isLikelyGuestId(white.id)) {
        const getProfile = async (id) => {
          const { data } = await supabase.from('profiles').select('elo_rating').eq('id', id).single();
          return (data && data.elo_rating) || 1200;
        };
        const rb = await getProfile(black.id);
        const rw = await getProfile(white.id);
        const K = 32;
        const expected = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
        const sb = winnerRole === 'black' ? 1 : 0;
        const sw = winnerRole === 'white' ? 1 : 0;
        const rb_new = Math.round(rb + K * (sb - expected(rb, rw)));
        const rw_new = Math.round(rw + K * (sw - expected(rw, rb)));
        await Promise.all([
          supabase.from('profiles').update({ elo_rating: rb_new }).eq('id', black.id),
          supabase.from('profiles').update({ elo_rating: rw_new }).eq('id', white.id),
        ]);
      }
    } catch (e) {
      console.error('ELO update (timeout) failed:', e);
    }

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

// Heuristic: treat non-UUID-looking IDs as guest/ephemeral IDs
const isLikelyGuestId = (id) => {
  if (!id || typeof id !== 'string') return true;
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return !uuidV4.test(id);
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
    // Build a safe profile for guests (fallbacks if missing)
    const safeProfile = (() => {
      try {
        const id = userProfile?.id || `guest-${(socket.id || '').slice(0,6)}`;
        const username = userProfile?.username || `Guest-${(id || '').slice(0,6)}`;
        return {
          id,
          username,
          elo_rating: Number.isFinite(userProfile?.elo_rating) ? userProfile.elo_rating : 1200,
          is_supporter: !!userProfile?.is_supporter,
          nickname_color: userProfile?.nickname_color ?? null,
          badge_color: userProfile?.badge_color ?? null,
          banner_color: userProfile?.banner_color ?? null,
        };
      } catch {
        const id = `guest-${(socket.id || '').slice(0,6)}`;
        return { id, username: `Guest-${id.slice(6)}`, elo_rating: 1200, is_supporter: false, nickname_color: null, badge_color: null, banner_color: null };
      }
    })();

    if (publicMatchmakingQueue.some(p => p.profile.id === safeProfile.id)) {
      console.log(`User ${safeProfile.username} (${safeProfile.id}) is already in the queue.`);
      return;
    }

    console.log(`User ${safeProfile.username} (${socket.userId || safeProfile.id}) joined the public queue.`);
    publicMatchmakingQueue.push({ socketId: socket.id, profile: safeProfile });
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
        moveCount: 0,
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

        // Swap2: propose initial triple for online public match (no UI negotiation here)
        const opening = proposeInitialTripleServer(15);
        io.to(roomId).emit('game-start', { roomId, players: rooms[roomId].players, openingBoard: opening.board, openingToMove: opening.toMove });
        console.log(`Public game starting for ${player1.profile.username} and ${player2.profile.username} in room ${roomId}`);
        startTurnTimer(roomId);
        
        // Only record in DB if both players look like registered users (likely UUIDs)
        const p1Guest = isLikelyGuestId(player1.profile.id);
        const p2Guest = isLikelyGuestId(player2.profile.id);
        if (!p1Guest && !p2Guest) {
          supabase.from('active_games').insert({
            room_id: roomId,
            player1_id: player1.profile.id,
            player2_id: player2.profile.id
          }).then(({ error }) => {
            if (error) console.error('Error creating active game:', error);
          });
        }
      }
      broadcastUserCounts();
    }
  });

  socket.on('leave-public-queue', () => {
    const idx = publicMatchmakingQueue.findIndex(p => p.socketId === socket.id);
    if (idx !== -1) {
      publicMatchmakingQueue.splice(idx, 1);
      console.log(`User ${socket.id} left the public queue.`);
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
    // Track total moves for ELO thresholds
    room.moveCount = (room.moveCount || 0) + 1;

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

    // ELO update for online public matches (pvo)
    try {
      const players = Object.values(room.players);
      const black = players.find(p => p.role === 'black');
      const white = players.find(p => p.role === 'white');
      const enoughMoves = (room.moveCount || 0) >= MIN_MOVES_FOR_ELO;
      if (black && white && !room.isPrivate && black.id !== white.id && enoughMoves && !isLikelyGuestId(black.id) && !isLikelyGuestId(white.id)) {
        const getProfile = async (id) => {
          const { data } = await supabase.from('profiles').select('elo_rating').eq('id', id).single();
          return (data && data.elo_rating) || 1200;
        };
        const rb = await getProfile(black.id);
        const rw = await getProfile(white.id);
        const K = 32;
        const expected = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
        // winner score 1, loser 0
        const winnerRole = data.winner; // 'black' | 'white'
        const sb = winnerRole === 'black' ? 1 : 0;
        const sw = winnerRole === 'white' ? 1 : 0;
        const rb_new = Math.max(0, Math.round(rb + K * (sb - expected(rb, rw))));
        const rw_new = Math.max(0, Math.round(rw + K * (sw - expected(rw, rb))));
        await Promise.all([
          supabase.from('profiles').update({ elo_rating: rb_new }).eq('id', black.id),
          supabase.from('profiles').update({ elo_rating: rw_new }).eq('id', white.id),
        ]);
      }
    } catch (e) {
      console.error('ELO update failed:', e);
    }

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
