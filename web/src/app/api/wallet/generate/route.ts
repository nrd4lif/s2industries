import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'

export async function POST() {
  try {
    await requireAuth()

    const keypair = Keypair.generate()
    const publicKey = keypair.publicKey.toBase58()
    const privateKeyBase58 = bs58.encode(keypair.secretKey)

    // Phantom import format: JSON array of bytes
    const privateKeyArray = JSON.stringify(Array.from(keypair.secretKey))

    return NextResponse.json({
      publicKey,
      privateKey: privateKeyBase58,
      // For importing into Phantom wallet
      phantomImportKey: privateKeyArray,
    })
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
