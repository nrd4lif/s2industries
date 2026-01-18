import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: wallet } = await supabase
      .from('wallet_config')
      .select('public_key')
      .eq('user_id', user.id)
      .single()

    if (!wallet) {
      return NextResponse.json({ error: 'No wallet configured' }, { status: 404 })
    }

    // Connect to Solana and get balance
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
    const publicKey = new PublicKey(wallet.public_key)

    const balanceLamports = await connection.getBalance(publicKey)
    const balanceSol = balanceLamports / LAMPORTS_PER_SOL

    return NextResponse.json({
      publicKey: wallet.public_key,
      balanceSol,
      balanceLamports,
    })
  } catch (err) {
    console.error('Balance fetch error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch balance' },
      { status: 500 }
    )
  }
}
