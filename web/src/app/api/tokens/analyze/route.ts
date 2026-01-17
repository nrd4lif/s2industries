import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { BirdeyeClient } from '@/lib/birdeye'

export async function GET(request: Request) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json(
        { error: 'Token address required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.BIRDEYE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Birdeye API key not configured' },
        { status: 500 }
      )
    }

    const birdeye = new BirdeyeClient(apiKey)
    const analysis = await birdeye.analyzeToken(address)

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('Token analysis error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to analyze token' },
      { status: 500 }
    )
  }
}
