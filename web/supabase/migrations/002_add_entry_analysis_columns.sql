-- Migration: Add optimal entry analysis columns to token_analyses
-- Run this in your Supabase SQL editor AFTER running 001_add_ml_logging_tables.sql

-- Add new columns for entry point analysis
alter table token_analyses
  add column if not exists optimal_entry_price numeric,
  add column if not exists optimal_entry_reason text,
  add column if not exists current_vs_optimal_percent numeric,
  add column if not exists entry_signal text,  -- 'strong_buy', 'buy', 'wait', 'avoid'
  add column if not exists entry_signal_reason text,
  add column if not exists expected_profit_at_current numeric,
  add column if not exists expected_profit_at_optimal numeric,
  add column if not exists vwap numeric;

-- Add index for finding buy signals
create index if not exists idx_token_analyses_entry_signal
  on token_analyses(entry_signal, created_at desc);

-- Create table for trending token snapshots
create table if not exists trending_snapshots (
  id uuid primary key default uuid_generate_v4(),
  token_mint text not null,
  token_symbol text,
  token_name text,

  -- From Jupiter trending API
  category text not null,  -- 'toptrending', 'toptraded', 'toporganicscore'
  interval text not null,  -- '5m', '1h', '6h', '24h'
  rank_position integer not null,  -- Position in the list (1 = top)

  -- Price and market data
  usd_price numeric not null,
  market_cap numeric,
  fdv numeric,
  liquidity numeric,

  -- Stats for the interval
  price_change_percent numeric,
  volume numeric,
  buy_volume numeric,
  sell_volume numeric,
  num_buys integer,
  num_sells integer,

  -- Security flags
  is_sus boolean default false,
  mint_authority boolean default false,
  freeze_authority boolean default false,
  top_holder_percentage numeric,
  is_verified boolean default false,

  created_at timestamptz default now()
);

-- Index for trending lookups
create index if not exists idx_trending_token_time
  on trending_snapshots(token_mint, created_at desc);

create index if not exists idx_trending_category_time
  on trending_snapshots(category, interval, created_at desc);

-- RLS Policies
alter table trending_snapshots enable row level security;

create policy "Anyone can view trending_snapshots" on trending_snapshots
  for select using (true);

create policy "Service role can insert trending_snapshots" on trending_snapshots
  for insert with check (true);
