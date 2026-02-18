import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { updateWorkoutDaySchema, markCompleteSchema } from '@/lib/fitness/fitness-validators'

// GET /api/fitness/days/[date] - Fetch a single workout day
export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { date } = await params

    const { data: day, error } = await supabase
      .from('workout_days')
      .select('*')
      .eq('user_id', user.id)
      .eq('workout_date', date)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
      }
      console.error('Error fetching workout day:', error)
      return NextResponse.json({ error: 'Failed to fetch workout day' }, { status: 500 })
    }

    return NextResponse.json({ day })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// PUT /api/fitness/days/[date] - Update a workout day's plan or actuals
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { date } = await params
    const body = await request.json()

    // Validate input (partial validation - only validate provided fields)
    const input = updateWorkoutDaySchema.parse({ ...body, workout_date: date })

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {}
    if (input.planned_json !== undefined) {
      updateData.planned_json = input.planned_json
    }
    if (input.actual_json !== undefined) {
      updateData.actual_json = input.actual_json
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes
    }

    const { data: day, error } = await supabase
      .from('workout_days')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('workout_date', date)
      .select()
      .single()

    if (error) {
      console.error('Error updating workout day:', error)
      return NextResponse.json({ error: 'Failed to update workout day' }, { status: 500 })
    }

    return NextResponse.json({ day })
  } catch (e) {
    if (e instanceof Error && e.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Validation error:', e)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
}

// POST /api/fitness/days/[date]/complete - Mark a day as completed
export async function POST(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { date } = await params
    const body = await request.json()

    // Validate input
    const input = markCompleteSchema.parse({ ...body, workout_date: date })

    // Build update
    const updateData: Record<string, unknown> = {
      completed_at: input.completed ? new Date().toISOString() : null,
    }

    // If actual data is provided, save it
    if (input.actual_json !== undefined) {
      updateData.actual_json = input.actual_json
    }

    const { data: day, error } = await supabase
      .from('workout_days')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('workout_date', date)
      .select()
      .single()

    if (error) {
      console.error('Error marking workout complete:', error)
      return NextResponse.json({ error: 'Failed to update workout day' }, { status: 500 })
    }

    return NextResponse.json({ day })
  } catch (e) {
    if (e instanceof Error && e.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error:', e)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
}
