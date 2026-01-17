-- Migration: Add tables for ML data logging
-- Run this in your Supabase SQL editor

-- OHLCV candle data from Birdeye
create table if not exists ohlcv_candles (
  id uuid primary key default uuid_generate_v4(),
  token_mint text not null,
  interval text not null,  -- '15m', '1H', etc.
  open_price numeric not null,
  high_price numeric not null,
  low_price numeric not null,
  close_price numeric not null,
  volume numeric not null,
  candle_time timestamptz not null,  -- Time of the candle
  source text default 'birdeye',
  created_at timestamptz default now(),

  -- Prevent duplicate candles
  unique(token_mint, interval, candle_time)
);

-- Index for efficient candle lookups
create index if not exists idx_ohlcv_token_interval_time
  on ohlcv_candles(token_mint, interval, candle_time desc);

-- Token analysis results
create table if not exists token_analyses (
  id uuid primary key default uuid_generate_v4(),
  token_mint text not null,
  token_symbol text,
  token_name text,

  -- Price data
  current_price numeric not null,
  high_24h numeric not null,
  low_24h numeric not null,
  price_change_24h numeric not null,
  price_change_percent_24h numeric not null,

  -- Volatility and trend
  volatility numeric not null,
  trend text not null,  -- 'bullish', 'bearish', 'sideways'
  trend_strength numeric not null,
  avg_volume numeric not null,

  -- Support/Resistance
  support_level numeric not null,
  resistance_level numeric not null,

  -- Suggested levels
  suggested_stop_loss_percent numeric not null,
  suggested_take_profit_percent numeric not null,

  -- Scalping analysis
  scalping_score integer not null,
  scalping_verdict text not null,  -- 'good', 'moderate', 'poor'
  scalping_reason text not null,

  -- Number of candles analyzed
  candles_analyzed integer not null,

  created_at timestamptz default now()
);

-- Index for analysis lookups
create index if not exists idx_token_analyses_mint_time
  on token_analyses(token_mint, created_at desc);

-- Jupiter quotes log
create table if not exists jupiter_quotes (
  id uuid primary key default uuid_generate_v4(),

  -- Request params
  input_mint text not null,
  output_mint text not null,
  amount_in text not null,
  taker text not null,

  -- Response data
  amount_out text not null,
  in_usd_value numeric,
  out_usd_value numeric,
  slippage_bps integer,
  price_impact numeric,
  route_plan jsonb,
  router text,

  created_at timestamptz default now()
);

-- Index for quote lookups
create index if not exists idx_jupiter_quotes_mints_time
  on jupiter_quotes(input_mint, output_mint, created_at desc);

-- RLS Policies (allow service role to insert, anyone to read)
alter table ohlcv_candles enable row level security;
alter table token_analyses enable row level security;
alter table jupiter_quotes enable row level security;

create policy "Anyone can view ohlcv_candles" on ohlcv_candles
  for select using (true);

create policy "Anyone can view token_analyses" on token_analyses
  for select using (true);

create policy "Anyone can view jupiter_quotes" on jupiter_quotes
  for select using (true);

-- Service role can insert (used by API routes)
create policy "Service role can insert ohlcv_candles" on ohlcv_candles
  for insert with check (true);

create policy "Service role can insert token_analyses" on token_analyses
  for insert with check (true);

create policy "Service role can insert jupiter_quotes" on jupiter_quotes
  for insert with check (true);
