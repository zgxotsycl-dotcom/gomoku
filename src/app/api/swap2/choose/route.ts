import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AI_BASE_URL = process.env.SWAP2_SERVER_URL || process.env.NEXT_PUBLIC_AI_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || '';
const AI_TIMEOUT_MS = Number(process.env.SWAP2_SERVER_TIMEOUT_MS || 2000);

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
      console.warn('AI server returned non-OK for choose:', response.status, response.statusText);
      return null;
    }
    return await response.json();
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      console.warn('AI server request failed for choose:', error);
    }
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

function computeFallbackColor(board: any[][] | null): 'black' | 'white' {
  if (!Array.isArray(board)) return 'black';
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 'black') black += 1;
      else if (cell === 'white') white += 1;
    }
  }
  return black <= white ? 'black' : 'white';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const board: any[][] | null = Array.isArray(body?.board) ? body.board : null;

  try {
    const aiServerUrl = AI_BASE_URL ? `${AI_BASE_URL.replace(/\/$/, '')}/swap2/choose` : '';
    const remote = await fetchAiWithRetry(aiServerUrl, { board }, 2, 150);
    if (remote) {
      const res = NextResponse.json(remote);
      res.headers.set('x-ai-source', 'remote');
      return res;
    }
  } catch (error) {
    console.error('Swap2 choose proxy failed:', error);
  }

  const fb = NextResponse.json({ aiColor: computeFallbackColor(board) });
  fb.headers.set('x-ai-source', 'fallback');
  return fb;
}
