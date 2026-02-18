import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { userFitnessSettingsSchema } from '@/lib/fitness/fitness-validators'

// GET /api/fitness/settings - Fetch user's fitness settings
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: settings, error } = await supabase
      .from('user_fitness_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching fitness settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    // Return null if no settings exist (use defaults)
    return NextResponse.json({ settings: settings || null })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// POST /api/fitness/settings - Create or update user's fitness settings
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()

    // Validate input
    const input = userFitnessSettingsSchema.parse(body)

    // Check if settings exist
    const { data: existing } = await supabase
      .from('user_fitness_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let result
    if (existing) {
      // Update existing settings
      const { data, error } = await supabase
        .from('user_fitness_settings')
        .update(input)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating fitness settings:', error)
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
      }
      result = data
    } else {
      // Insert new settings
      const { data, error } = await supabase
        .from('user_fitness_settings')
        .insert({ user_id: user.id, ...input })
        .select()
        .single()

      if (error) {
        console.error('Error creating fitness settings:', error)
        return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 })
      }
      result = data
    }

    return NextResponse.json({ settings: result })
  } catch (e) {
    if (e instanceof Error && e.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Validation error:', e)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
}
