import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { JupiterClient } from '@/lib/jupiter'

export async function GET(request: Request) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query) {
      return NextResponse.json(
        { error: 'Query required' },
        { status: 400 }
      )
    }

    const jupiter = new JupiterClient(process.env.JUPITER_API_KEY || '')
    const tokens = await jupiter.searchToken(query)

    return NextResponse.json({ tokens })
  } catch (err) {
    console.error('Token search error:', err)
    return NextResponse.json(
      { error: 'Failed to search tokens' },
      { status: 500 }
    )
  }
}
