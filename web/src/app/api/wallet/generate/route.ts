import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { generateTradingWallet } from '@/lib/jupiter'

export async function POST() {
  try {
    await requireAuth()

    const wallet = generateTradingWallet()

    // Return both keys - the private key will only be shown once
    return NextResponse.json({
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
    })
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
