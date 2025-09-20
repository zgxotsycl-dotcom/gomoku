import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const aiServerUrl = (process.env.NEXT_PUBLIC_AI_BASE_URL || '') + '/swap2/second';
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
      console.warn('AI server returned non-OK for second:', response.status, response.statusText);
    }
    // Fallback: do not swap, next to move is white per Swap2 scenario
    return NextResponse.json({ swapColors: false, toMove: 'white', board: body?.board ?? null });
  } catch (e) {
    console.error('Swap2 second proxy failed:', e);
    return NextResponse.json({ swapColors: false, toMove: 'white', board: null });
  }
}
