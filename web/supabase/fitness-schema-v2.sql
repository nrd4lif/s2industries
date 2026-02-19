-- S2 Fitness Module Schema v2 - AI Integration
-- Run this migration AFTER the initial fitness-schema.sql

-- Add health considerations and AI fields to user_fitness_settings
ALTER TABLE user_fitness_settings
ADD COLUMN IF NOT EXISTS health_considerations text,
ADD COLUMN IF NOT EXISTS fitness_goals text,
ADD COLUMN IF NOT EXISTS experience_level text DEFAULT 'beginner',
ADD COLUMN IF NOT EXISTS last_ai_analysis_at timestamptz,
ADD COLUMN IF NOT EXISTS ai_recommendations jsonb;

-- Add AI-generated flag and source to workout_days
ALTER TABLE workout_days
ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_notes text;

-- Table for storing AI analysis history
CREATE TABLE IF NOT EXISTS fitness_ai_analyses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- Analysis details
  analysis_date timestamptz default now(),
  workouts_analyzed int not null,
  date_range_start date,
  date_range_end date,

  -- AI outputs
  performance_summary text,
  recommendations jsonb,
  -- Structure: { exercises_to_modify: [...], progression_adjustments: {...}, warnings: [...] }

  -- Generated plan info
  days_generated int default 0,

  -- Raw AI response for debugging
  raw_response text,

  created_at timestamptz default now()
);

-- RLS for AI analyses
ALTER TABLE fitness_ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI analyses" ON fitness_ai_analyses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own AI analyses" ON fitness_ai_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_fitness_ai_analyses_user_date
ON fitness_ai_analyses(user_id, analysis_date DESC);
