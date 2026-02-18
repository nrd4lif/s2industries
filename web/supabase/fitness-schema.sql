-- S2 Fitness Module Schema
-- Run this in your Supabase SQL editor

-- Workout day types
create type workout_type as enum ('REST', 'CARDIO', 'UPPER', 'LOWER', 'RECOVERY');

-- Workout days (one row per date per user)
create table workout_days (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- The date for this workout (date only, no time)
  workout_date date not null,

  -- Type of workout
  workout_type workout_type not null,

  -- Planned workout details (JSONB for flexibility)
  -- For CARDIO: { warmup: {...}, main: {...}, cooldown: {...} }
  -- For UPPER/LOWER: { exercises: [...] }
  -- For REST/RECOVERY: null or { notes: "..." }
  planned_json jsonb,

  -- Actual workout performed (same structure as planned)
  actual_json jsonb,

  -- Completion tracking
  completed_at timestamptz,

  -- Notes for this day
  notes text,

  -- Week number (1-4) for progression tracking
  week_number int not null default 1,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- One entry per date per user
  unique(user_id, workout_date)
);

-- Index for efficient date range queries
create index idx_workout_days_user_date on workout_days(user_id, workout_date);

-- User fitness settings
create table user_fitness_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- Treadmill defaults
  default_treadmill_speed numeric default 3.0,
  default_warmup_minutes int default 5,
  default_cooldown_minutes int default 5,
  starting_incline numeric default 4,

  -- Progression preferences
  progression_type text default 'automatic', -- 'automatic' or 'manual'
  prefer_rep_increase boolean default false, -- If true, increase reps instead of weight

  -- Starting weights for strength exercises (lbs)
  bench_weight numeric default 45,
  row_weight numeric default 45,
  overhead_press_weight numeric default 25,
  lat_pulldown_weight numeric default 70,
  curl_weight numeric default 15,
  tricep_weight numeric default 15,
  squat_weight numeric default 95,
  rdl_weight numeric default 65,
  lunge_weight numeric default 20,
  hamstring_curl_weight numeric default 50,
  calf_raise_weight numeric default 100,

  -- Timezone preference
  timezone text default 'America/Chicago',

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

-- RLS Policies
alter table workout_days enable row level security;
alter table user_fitness_settings enable row level security;

-- Workout days: user can only see their own
create policy "Users can view own workout days" on workout_days
  for select using (auth.uid() = user_id);
create policy "Users can insert own workout days" on workout_days
  for insert with check (auth.uid() = user_id);
create policy "Users can update own workout days" on workout_days
  for update using (auth.uid() = user_id);
create policy "Users can delete own workout days" on workout_days
  for delete using (auth.uid() = user_id);

-- User fitness settings: user can only see their own
create policy "Users can view own fitness settings" on user_fitness_settings
  for select using (auth.uid() = user_id);
create policy "Users can insert own fitness settings" on user_fitness_settings
  for insert with check (auth.uid() = user_id);
create policy "Users can update own fitness settings" on user_fitness_settings
  for update using (auth.uid() = user_id);
create policy "Users can delete own fitness settings" on user_fitness_settings
  for delete using (auth.uid() = user_id);

-- Updated at triggers (use existing function from main schema)
create trigger workout_days_updated_at
  before update on workout_days
  for each row execute function update_updated_at();

create trigger user_fitness_settings_updated_at
  before update on user_fitness_settings
  for each row execute function update_updated_at();
