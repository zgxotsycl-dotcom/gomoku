import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function createEmptyBoard(size: number) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}
function firstEmptyAround(board: any[][], r0: number, c0: number, rings = 2) {
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
function fallbackPropose(size = 15) {
  const b = createEmptyBoard(size);
  const mid = Math.floor(size / 2);
  b[mid][mid] = 'black';
  let [wr, wc] = firstEmptyAround(b, mid, mid, 1);
  if (wr !== -1) b[wr][wc] = 'white';
  let [br, bc] = firstEmptyAround(b, mid, mid, 1);
  if (br !== -1) b[br][bc] = 'black';
  return { board: b, toMove: 'white' };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const aiServerUrl = (process.env.NEXT_PUBLIC_AI_BASE_URL || '') + '/swap2/propose';
    if (aiServerUrl.startsWith('http')) {
      const response = await fetch(aiServerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
      console.warn('AI server returned non-OK for propose:', response.status, response.statusText);
    }
    // Fallback local generate
    const size = Array.isArray(body?.board) ? (body.board.length || 15) : 15;
    return NextResponse.json(fallbackPropose(size));
  } catch (e) {
    console.error('Swap2 propose proxy failed:', e);
    const size = 15;
    return NextResponse.json(fallbackPropose(size));
  }
}
