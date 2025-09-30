import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AI_BASE_URL = process.env.SWAP2_SERVER_URL
  || process.env.NEXT_PUBLIC_AI_BASE_URL
  || process.env.NEXT_PUBLIC_API_BASE
  || '';
const AI_TIMEOUT_MS = Number(process.env.SWAP2_SERVER_TIMEOUT_MS || 4000);

async function forward(url: string, body: unknown) {
  if (!url || !url.startsWith('http')) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = AI_BASE_URL ? `${AI_BASE_URL.replace(/\/$/, '')}/feedback` : '';
    const remote = await forward(url, body);
    if (remote) {
      const res = NextResponse.json(remote);
      res.headers.set('x-ai-source', 'remote');
      return res;
    }
  } catch (e) {
    // swallow and fall through
  }
  return NextResponse.json({ ok: false, stored: false, error: 'forward_failed' }, { status: 502 });
}

