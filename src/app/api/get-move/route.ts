import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const aiServerUrl = 'https://ai.omokk.com/get-move';

    const response = await fetch(aiServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return new NextResponse(`AI server error: ${response.statusText}`, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error proxying to AI server:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
