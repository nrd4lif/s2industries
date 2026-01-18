import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const mints = searchParams.get('mints')

    if (!mints) {
      return NextResponse.json(
        { error: 'Missing mints parameter' },
        { status: 400 }
      )
    }

    const mintList = mints.split(',').filter(m => m.length > 0)

    if (mintList.length === 0) {
      return NextResponse.json({ prices: {} })
    }

    // Jupiter Price API v2 supports multiple tokens
    const url = `https://api.jup.ag/price/v2?ids=${mintList.join(',')}`
    const res = await fetch(url, {
      headers: {
        'x-api-key': process.env.JUPITER_API_KEY || '',
      },
    })

    if (!res.ok) {
      console.error('Jupiter price API error:', res.status)
      return NextResponse.json({ prices: {} })
    }

    const data = await res.json()
    const prices: Record<string, number> = {}

    mintList.forEach(mint => {
      const tokenData = data.data?.[mint]
      if (tokenData?.price) {
        prices[mint] = parseFloat(tokenData.price)
      }
    })

    return NextResponse.json({ prices })
  } catch (err) {
    console.error('Prices fetch error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch prices' },
      { status: 500 }
    )
  }
}
