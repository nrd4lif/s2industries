import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { encryptPrivateKey } from '@/lib/crypto'
import { getPublicKeyFromPrivate } from '@/lib/jupiter'
import { setupWalletSchema } from '@/lib/validators'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: wallet } = await supabase
      .from('wallet_config')
      .select('public_key, label')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({ wallet })
  } catch {
    return NextResponse.json({ wallet: null })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const { private_key, label } = setupWalletSchema.parse(body)

    // Derive public key from private key
    let publicKey: string
    try {
      publicKey = getPublicKeyFromPrivate(private_key)
    } catch {
      return NextResponse.json(
        { error: 'Invalid private key format' },
        { status: 400 }
      )
    }

    // Encrypt the private key
    const encryptedPrivateKey = encryptPrivateKey(private_key)

    const supabase = await createClient()

    // Upsert wallet config
    const { error } = await supabase
      .from('wallet_config')
      .upsert({
        user_id: user.id,
        public_key: publicKey,
        encrypted_private_key: encryptedPrivateKey,
        label: label || 'Trading Wallet',
      }, {
        onConflict: 'user_id',
      })

    if (error) {
      console.error('Failed to save wallet:', error)
      return NextResponse.json(
        { error: 'Failed to save wallet' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, publicKey })
  } catch (err) {
    console.error('Wallet setup error:', err)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}

export async function DELETE() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { error } = await supabase
      .from('wallet_config')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete wallet' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
