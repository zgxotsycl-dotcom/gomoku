import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const board: any[][] | null = Array.isArray(body?.board) ? body.board : null

    // If external AI chooser exists, call it first
    const base = process.env.NEXT_PUBLIC_AI_BASE_URL || ''
    if (base.startsWith('http')) {
      try {
        const res = await fetch(base + '/swap2/choose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ board }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data && (data.aiColor === 'black' || data.aiColor === 'white')) {
            return NextResponse.json({ aiColor: data.aiColor })
          }
        }
      } catch {}
    }

    // Fallback heuristic: pick color with fewer stones (usually black after W extra)
    let b = 0, w = 0
    if (board) {
      for (const row of board) {
        for (const c of row) {
          if (c === 'black') b++
          else if (c === 'white') w++
        }
      }
    }
    const aiColor = b <= w ? 'black' : 'white'
    return NextResponse.json({ aiColor })
  } catch (e) {
    return NextResponse.json({ aiColor: 'black' })
  }
}

