import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { progressDataSchema } from '@/lib/pds/validators'

// GET /api/pds/progress - Fetch user's PDS progress
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('pds_progress')
      .select('progress_data')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching PDS progress:', error)
      return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
    }

    // Return null if no progress exists yet
    return NextResponse.json({ progress: data?.progress_data || null })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// POST /api/pds/progress - Save user's PDS progress
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()

    // Validate input
    const progressData = progressDataSchema.parse(body)

    // Upsert progress (insert or update)
    const { data, error } = await supabase
      .from('pds_progress')
      .upsert(
        {
          user_id: user.id,
          progress_data: progressData,
        },
        {
          onConflict: 'user_id',
        }
      )
      .select('progress_data')
      .single()

    if (error) {
      console.error('Error saving PDS progress:', error)
      return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
    }

    return NextResponse.json({ progress: data.progress_data })
  } catch (e) {
    if (e instanceof Error && e.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Validation error:', e)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
}
