-- S2 Trading Bot Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Wallet configuration (encrypted trading wallet)
create table wallet_config (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  public_key text not null,
  -- Private key encrypted with SUPABASE_SERVICE_ROLE_KEY before storage
  encrypted_private_key text not null,
  label text default 'Trading Wallet',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- Trading plans (pending or active trades)
create type trading_plan_status as enum ('draft', 'active', 'triggered', 'completed', 'cancelled');
create type trigger_type as enum ('stop_loss', 'take_profit');

create table trading_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- Token info
  token_mint text not null,
  token_symbol text,
  token_name text,

  -- Entry position
  entry_price_usd numeric not null,
  amount_sol numeric not null,           -- Amount of SOL to swap
  amount_tokens numeric,                  -- Tokens received (filled after entry)

  -- Exit triggers (percentages from entry)
  stop_loss_percent numeric not null,     -- e.g., 5 means sell if price drops 5%
  take_profit_percent numeric not null,   -- e.g., 10 means sell if price rises 10%

  -- Calculated trigger prices (set when plan is activated)
  stop_loss_price numeric,
  take_profit_price numeric,

  -- Status tracking
  status trading_plan_status default 'draft',
  triggered_by trigger_type,
  triggered_at timestamptz,

  -- Transaction signatures
  entry_tx_signature text,
  exit_tx_signature text,

  -- Results (filled after completion)
  exit_price_usd numeric,
  profit_loss_sol numeric,
  profit_loss_percent numeric,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Price snapshots for monitoring and history
create table price_snapshots (
  id uuid primary key default uuid_generate_v4(),
  token_mint text not null,
  price_usd numeric not null,
  price_sol numeric,
  volume_24h numeric,
  market_cap numeric,
  source text default 'jupiter',
  created_at timestamptz default now()
);

-- Index for efficient price lookups
create index idx_price_snapshots_token_time on price_snapshots(token_mint, created_at desc);

-- Trade execution log
create table trades (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  trading_plan_id uuid references trading_plans(id) on delete set null,

  -- Trade details
  token_mint text not null,
  token_symbol text,
  side text not null check (side in ('buy', 'sell')),

  -- Amounts
  amount_in numeric not null,
  amount_out numeric not null,
  input_mint text not null,
  output_mint text not null,

  -- Price at execution
  price_usd numeric not null,

  -- Jupiter transaction
  tx_signature text not null,

  -- Fees
  fee_sol numeric,

  created_at timestamptz default now()
);

-- RLS Policies
alter table wallet_config enable row level security;
alter table trading_plans enable row level security;
alter table trades enable row level security;
alter table price_snapshots enable row level security;

-- Wallet config: user can only see their own
create policy "Users can view own wallet config" on wallet_config
  for select using (auth.uid() = user_id);
create policy "Users can insert own wallet config" on wallet_config
  for insert with check (auth.uid() = user_id);
create policy "Users can update own wallet config" on wallet_config
  for update using (auth.uid() = user_id);
create policy "Users can delete own wallet config" on wallet_config
  for delete using (auth.uid() = user_id);

-- Trading plans: user can only see their own
create policy "Users can view own trading plans" on trading_plans
  for select using (auth.uid() = user_id);
create policy "Users can insert own trading plans" on trading_plans
  for insert with check (auth.uid() = user_id);
create policy "Users can update own trading plans" on trading_plans
  for update using (auth.uid() = user_id);
create policy "Users can delete own trading plans" on trading_plans
  for delete using (auth.uid() = user_id);

-- Trades: user can only see their own
create policy "Users can view own trades" on trades
  for select using (auth.uid() = user_id);
create policy "Users can insert own trades" on trades
  for insert with check (auth.uid() = user_id);

-- Price snapshots: everyone can read, only service role can insert
create policy "Anyone can view price snapshots" on price_snapshots
  for select using (true);

-- Updated at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger wallet_config_updated_at
  before update on wallet_config
  for each row execute function update_updated_at();

create trigger trading_plans_updated_at
  before update on trading_plans
  for each row execute function update_updated_at();

-- PDS (Product Data Science) Progress
create table pds_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  progress_data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS for pds_progress
alter table pds_progress enable row level security;

create policy "Users can view own pds progress" on pds_progress
  for select using (auth.uid() = user_id);
create policy "Users can insert own pds progress" on pds_progress
  for insert with check (auth.uid() = user_id);
create policy "Users can update own pds progress" on pds_progress
  for update using (auth.uid() = user_id);
create policy "Users can delete own pds progress" on pds_progress
  for delete using (auth.uid() = user_id);

create trigger pds_progress_updated_at
  before update on pds_progress
  for each row execute function update_updated_at();
