import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AI_BASE_URL = process.env.SWAP2_SERVER_URL || process.env.NEXT_PUBLIC_AI_BASE_URL || '';
const AI_TIMEOUT_MS = Number(process.env.SWAP2_SERVER_TIMEOUT_MS || 2000);

function createEmptyBoard(size: number) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function firstEmptyAround(board: any[][], r0: number, c0: number, rings = 2) {
  const n = board.length;
  for (let rad = 1; rad <= rings; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r >= 0 && c >= 0 && r < n && c < n && board[r][c] == null) {
          return [r, c];
        }
      }
    }
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] == null) return [r, c];
    }
  }
  return [-1, -1];
}

function fallbackPropose(size = 15) {
  const board = createEmptyBoard(size);
  const mid = Math.floor(size / 2);
  board[mid][mid] = 'black';
  const [wr, wc] = firstEmptyAround(board, mid, mid, 1);
  if (wr !== -1) board[wr][wc] = 'white';
  const [br, bc] = firstEmptyAround(board, mid, mid, 1);
  if (br !== -1) board[br][bc] = 'black';
  return { board, toMove: 'white' };
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
    if (!response.ok) {
      console.warn('AI server returned non-OK for propose:', response.status, response.statusText);
      return null;
    }
    return await response.json();
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      console.warn('AI server request failed for propose:', error);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const aiServerUrl = AI_BASE_URL ? `${AI_BASE_URL.replace(/\/$/, '')}/swap2/propose` : '';
    const remote = await fetchAi(aiServerUrl, body);
    if (remote) {
      return NextResponse.json(remote);
    }
    const size = Array.isArray(body?.board) ? (body.board.length || 15) : 15;
    return NextResponse.json(fallbackPropose(size));
  } catch (error) {
    console.error('Swap2 propose proxy failed:', error);
    return NextResponse.json(fallbackPropose(15));
  }
}
