import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AI_BASE_URL = process.env.SWAP2_SERVER_URL || process.env.NEXT_PUBLIC_AI_BASE_URL || '';
const AI_TIMEOUT_MS = Number(process.env.SWAP2_SERVER_TIMEOUT_MS || 2000);

async function fetchAi(url: string, body: unknown) {
  if (!url.startsWith('http')) return null;
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
      console.warn('AI server returned non-OK for second:', response.status, response.statusText);
      return null;
    }
    return await response.json();
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      console.warn('AI server request failed for second:', error);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const aiServerUrl = AI_BASE_URL ? `${AI_BASE_URL.replace(/\/$/, '')}/swap2/second` : '';
    const remote = await fetchAi(aiServerUrl, body);
    if (remote) {
      return NextResponse.json(remote);
    }
    return NextResponse.json({ swapColors: false, toMove: 'white', board: body?.board ?? null });
  } catch (error) {
    console.error('Swap2 second proxy failed:', error);
    return NextResponse.json({ swapColors: false, toMove: 'white', board: null });
  }
}
