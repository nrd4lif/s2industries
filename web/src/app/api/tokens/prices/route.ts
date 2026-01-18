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

    // Jupiter Price API v3 (v2 is deprecated)
    const url = `https://api.jup.ag/price/v3?ids=${mintList.join(',')}`

    const headers: Record<string, string> = {}
    if (process.env.JUPITER_API_KEY) {
      headers['x-api-key'] = process.env.JUPITER_API_KEY
    }

    const res = await fetch(url, { headers })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Jupiter price API error:', res.status, errorText)
      return NextResponse.json({ prices: {}, error: `Jupiter API error: ${res.status}` })
    }

    const data = await res.json()

    const prices: Record<string, number> = {}

    // v3 response format: { "mint": { "usdPrice": number, ... } }
    mintList.forEach(mint => {
      const tokenData = data[mint]
      if (tokenData?.usdPrice) {
        prices[mint] = tokenData.usdPrice
      }
    })

    console.log('Parsed prices:', prices)
    return NextResponse.json({ prices })
  } catch (err) {
    console.error('Prices fetch error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch prices' },
      { status: 500 }
    )
  }
}
