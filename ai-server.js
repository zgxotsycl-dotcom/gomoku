// Lightweight AI inference server for Gomoku (Swap2 endpoints + get-move)
// - Uses simple heuristics by default
// - Optionally hot-reloads a custom engine from MODEL_DIR/current (see model-watcher.js)

// Env
// AI_PORT: listen port (default 8081)
// MODEL_DIR: base directory for models (default ./models)
// LOG_LEVEL: info|debug

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.AI_PORT || 8081);
const MODEL_DIR = process.env.MODEL_DIR || path.resolve(__dirname, 'models');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const app = express();
app.use(express.json({ limit: '1mb' }));

function log(...args) { if (LOG_LEVEL !== 'silent') console.log('[AI]', ...args); }

// --- Helpers ---------------------------------------------------------------
const clampBoard = (board) => {
  if (!Array.isArray(board) || board.length === 0) return null;
  const n = board.length;
  const m = Array.from({ length: n }, () => Array(n).fill(null));
  for (let r = 0; r < n; r++) {
    const row = board[r];
    if (!Array.isArray(row) || row.length !== n) return null;
    for (let c = 0; c < n; c++) {
      const cell = row[c];
      m[r][c] = (cell === 'black' || cell === 'white') ? cell : null;
    }
  }
  return m;
};

const createEmpty = (n = 15) => Array.from({ length: n }, () => Array(n).fill(null));

const firstEmptyAround = (board, r0, c0, rings = 2) => {
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
};

const fallbackPropose = (n = 15) => {
  const b = createEmpty(n);
  const mid = Math.floor(n / 2);
  b[mid][mid] = 'black';
  const [wr, wc] = firstEmptyAround(b, mid, mid, 1);
  if (wr !== -1) b[wr][wc] = 'white';
  const [br, bc] = firstEmptyAround(b, mid, mid, 1);
  if (br !== -1) b[br][bc] = 'black';
  return { board: b, toMove: 'white' };
};

const countStones = (board) => {
  let black = 0, white = 0;
  for (const row of board) for (const cell of row) {
    if (cell === 'black') black++; else if (cell === 'white') white++;
  }
  return { black, white };
};

const simpleMove = (board, player = 'black') => {
  const n = Array.isArray(board) ? board.length : 15;
  const safe = clampBoard(board) || createEmpty(n);
  // Try around last stone
  let lastR = -1, lastC = -1;
  for (let r = n - 1; r >= 0; r--) {
    for (let c = n - 1; c >= 0; c--) {
      if (safe[r][c] === 'black' || safe[r][c] === 'white') { lastR = r; lastC = c; break; }
    }
    if (lastR !== -1) break;
  }
  const around = (r0, c0) => {
    for (let rad = 1; rad <= 2; rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          const r = r0 + dr, c = c0 + dc;
          if (r >= 0 && c >= 0 && r < n && c < n && safe[r][c] == null) return [r, c];
        }
      }
    }
    const mid = Math.floor(n / 2);
    if (safe[mid][mid] == null) return [mid, mid];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (safe[r][c] == null) return [r, c];
    return [Math.floor(n / 2), Math.floor(n / 2)];
  };
  if (lastR !== -1) return around(lastR, lastC);
  const mid = Math.floor(n / 2);
  return around(mid, mid);
};

// --- Optional hot-load engine --------------------------------------------
let currentEngine = null; // { evaluate(board, toMove): { move:[r,c], score:number } }
function tryLoadEngine() {
  try {
    const link = path.join(MODEL_DIR, 'current');
    if (!fs.existsSync(link)) { currentEngine = null; return; }
    const enginePath = path.join(link, 'engine.js');
    if (fs.existsSync(enginePath)) {
      // clear from cache to allow reload
      delete require.cache[require.resolve(enginePath)];
      // eslint-disable-next-line import/no-dynamic-require, global-require
      currentEngine = require(enginePath);
      log('Loaded custom engine from', enginePath);
    } else {
      currentEngine = null;
    }
  } catch (e) {
    console.error('[AI] Engine load failed:', e);
    currentEngine = null;
  }
}

// watch for changes occasionally
setInterval(tryLoadEngine, 10_000).unref();
tryLoadEngine();

// --- Routes ---------------------------------------------------------------
app.get('/healthz', (req, res) => {
  const cur = path.join(MODEL_DIR, 'current');
  let version = null;
  try {
    const vPath = path.join(cur, 'version.txt');
    if (fs.existsSync(vPath)) version = fs.readFileSync(vPath, 'utf8').trim();
  } catch {}
  res.json({ ok: true, engine: !!currentEngine, version });
});

app.post('/get-move', (req, res) => {
  try {
    const board = clampBoard(req.body?.board) || createEmpty(15);
    const player = (req.body?.player === 'black' || req.body?.player === 'white') ? req.body.player : 'black';
    if (currentEngine?.evaluate) {
      try {
        const out = currentEngine.evaluate(board, player) || {};
        if (Array.isArray(out.move) && out.move.length === 2) return res.json({ move: out.move, source: 'engine' });
      } catch (e) { console.warn('engine evaluate failed:', e); }
    }
    const mv = simpleMove(board, player);
    return res.json({ move: mv, source: 'fallback' });
  } catch (e) {
    console.error('get-move error:', e);
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/swap2/propose', (req, res) => {
  try {
    const input = clampBoard(req.body?.board);
    const n = input?.length || 15;
    const prop = fallbackPropose(n);
    res.json({ board: prop.board, toMove: prop.toMove });
  } catch (e) {
    console.error('propose error:', e);
    res.status(500).json({ error: 'internal' });
  }
});

app.post('/swap2/second', (req, res) => {
  try {
    // Very simple: keep colors (no swap) and start white to move
    const input = clampBoard(req.body?.board);
    const board = input || fallbackPropose(15).board;
    // optionally request extra white rarely
    const { black, white } = countStones(board);
    const pendingWhiteExtra = (white <= black - 1) && (black >= 3);
    res.json({ board, toMove: 'white', swapColors: false, pendingWhiteExtra });
  } catch (e) {
    console.error('second error:', e);
    res.status(500).json({ error: 'internal' });
  }
});

app.post('/swap2/choose', (req, res) => {
  try {
    const board = clampBoard(req.body?.board) || createEmpty(15);
    const { black, white } = countStones(board);
    // simple heuristic: choose color with fewer stones on board
    const aiColor = (black <= white) ? 'black' : 'white';
    res.json({ aiColor });
  } catch (e) {
    console.error('choose error:', e);
    res.status(500).json({ error: 'internal' });
  }
});

app.listen(PORT, () => {
  log(`AI server listening on :${PORT}`);
});

