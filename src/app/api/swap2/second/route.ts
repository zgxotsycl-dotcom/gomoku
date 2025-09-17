import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const aiServerUrl = (process.env.NEXT_PUBLIC_AI_BASE_URL || 'https://ai.omokk.com') + '/swap2/second';
    const response = await fetch(aiServerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return new NextResponse(`AI server error: ${response.statusText}`, { status: response.status });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error('Swap2 second proxy failed:', e);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

