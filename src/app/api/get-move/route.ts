import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Support multiple env names so Vercel/Client configs work: SWAP2_SERVER_URL > NEXT_PUBLIC_AI_BASE_URL > NEXT_PUBLIC_API_BASE
const AI_BASE_URL = process.env.SWAP2_SERVER_URL || process.env.NEXT_PUBLIC_AI_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || '';
const AI_TIMEOUT_MS = Number(process.env.SWAP2_SERVER_TIMEOUT_MS || 3000);

function computeFallbackMove(board: any[][] | null | undefined, player: 'black' | 'white') {
  // Guard against invalid or empty boards by creating a default empty 15x15 board
  const validGrid = Array.isArray(board) && board.length > 0 && Array.isArray(board[0]);
  const n = validGrid ? board!.length : 15;
  const safeBoard: (string | null)[][] = validGrid
    ? (board as (string | null)[][])
    : Array.from({ length: n }, () => Array(n).fill(null));
  // last move heuristic
  let lastR = -1, lastC = -1;
  outer: for (let r=n-1; r>=0; r--) {
    for (let c=n-1; c>=0; c--) {
      if (safeBoard[r][c] === 'black' || safeBoard[r][c] === 'white') { lastR=r; lastC=c; break outer; }
    }
  }
  const around = (r0:number,c0:number) => {
    for (let rad=1; rad<=2; rad++) {
      for (let dr=-rad; dr<=rad; dr++) {
        for (let dc=-rad; dc<=rad; dc++) {
          const r=r0+dr, c=c0+dc;
          if (r>=0 && c>=0 && r<n && c<n && safeBoard[r][c]==null) return [r,c];
        }
      }
    }
    // center bias
    const mid = Math.floor(n/2);
    if (safeBoard[mid] && safeBoard[mid][mid]==null) return [mid,mid];
    // any empty
    for (let r=0;r<n;r++) for (let c=0;c<n;c++) if (safeBoard[r][c]==null) return [r,c];
    return [Math.floor(n/2), Math.floor(n/2)];
  };
  if (lastR!==-1) return around(lastR,lastC);
  const mid = Math.floor(n/2);
  return around(mid,mid);
}

async function fetchAi(url: string, body: unknown) {
  if (!url || !url.startsWith('http') || /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/.test(url)) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    if ((e as Error)?.name !== 'AbortError') console.warn('AI /get-move failed:', e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAiWithRetry(url: string, body: unknown, tries = 2, backoffMs = 150) {
  for (let i = 0; i < tries; i++) {
    const res = await fetchAi(url, body);
    if (res) return res;
    if (i < tries - 1) await new Promise((r) => setTimeout(r, backoffMs));
  }
  return null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rawBoard = (body as any)?.board;
  const board = Array.isArray(rawBoard) && rawBoard.length > 0 && Array.isArray(rawBoard[0]) ? rawBoard : null;
  const player = ((body as any)?.player === 'black' || (body as any)?.player === 'white') ? (body as any).player : 'black';

  const remoteUrl = AI_BASE_URL ? `${AI_BASE_URL.replace(/\/$/, '')}/get-move` : '';
  const remote = await fetchAiWithRetry(remoteUrl, body, 2, 150);
  if (remote && Array.isArray(remote?.move) && Number.isInteger(remote.move[0]) && Number.isInteger(remote.move[1])) {
    const res = NextResponse.json(remote);
    res.headers.set('x-ai-source', 'remote');
    return res;
  }

  // Fallback move to guarantee progress
  const [r, c] = computeFallbackMove(board, player);
  const res = NextResponse.json({ move: [r, c], source: 'fallback' });
  res.headers.set('x-ai-source', 'fallback');
  return res;
}
