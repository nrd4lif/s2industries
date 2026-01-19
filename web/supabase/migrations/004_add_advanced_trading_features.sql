-- Migration: Add advanced trading features
-- Trailing stops, partial profit-taking, breakeven stops, time-based exits, daily limits
-- Run this in your Supabase SQL editor

-- ========================================
-- TRAILING STOP SUPPORT
-- ========================================

ALTER TABLE trading_plans
  ADD COLUMN IF NOT EXISTS use_trailing_stop boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trailing_stop_percent numeric,  -- e.g., 5 means trail 5% below peak
  ADD COLUMN IF NOT EXISTS highest_price_since_entry numeric,  -- Track peak price for trailing
  ADD COLUMN IF NOT EXISTS trailing_stop_price numeric;  -- Current trailing stop level

COMMENT ON COLUMN trading_plans.use_trailing_stop IS 'Enable trailing stop instead of fixed stop-loss';
COMMENT ON COLUMN trading_plans.trailing_stop_percent IS 'Percentage below peak price for trailing stop (e.g., 5 = sell if drops 5% from peak)';
COMMENT ON COLUMN trading_plans.highest_price_since_entry IS 'Highest price reached since entry (for trailing stop calc)';
COMMENT ON COLUMN trading_plans.trailing_stop_price IS 'Current trailing stop price (highest_price * (1 - trailing_stop_percent/100))';

-- ========================================
-- PARTIAL PROFIT TAKING
-- ========================================

ALTER TABLE trading_plans
  ADD COLUMN IF NOT EXISTS use_partial_profit boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS partial_profit_percent numeric DEFAULT 50,  -- Sell 50% at TP1
  ADD COLUMN IF NOT EXISTS partial_profit_price numeric,  -- First take-profit level (TP1)
  ADD COLUMN IF NOT EXISTS partial_profit_taken boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS partial_profit_taken_at timestamptz,
  ADD COLUMN IF NOT EXISTS partial_tx_signature text,
  ADD COLUMN IF NOT EXISTS remaining_tokens numeric;  -- Tokens left after partial sell

COMMENT ON COLUMN trading_plans.use_partial_profit IS 'Enable selling portion at first target';
COMMENT ON COLUMN trading_plans.partial_profit_percent IS 'Percentage of position to sell at TP1 (default 50%)';
COMMENT ON COLUMN trading_plans.partial_profit_price IS 'Price to take partial profit (TP1)';
COMMENT ON COLUMN trading_plans.partial_profit_taken IS 'Whether partial profit has been taken';
COMMENT ON COLUMN trading_plans.partial_profit_taken_at IS 'When partial profit was taken';
COMMENT ON COLUMN trading_plans.partial_tx_signature IS 'Transaction signature for partial profit sale';
COMMENT ON COLUMN trading_plans.remaining_tokens IS 'Tokens remaining after partial profit sale';

-- ========================================
-- BREAKEVEN STOP
-- ========================================

ALTER TABLE trading_plans
  ADD COLUMN IF NOT EXISTS use_breakeven_stop boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS breakeven_trigger_percent numeric DEFAULT 3,  -- Move SL to entry when +3%
  ADD COLUMN IF NOT EXISTS breakeven_activated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS breakeven_activated_at timestamptz;

COMMENT ON COLUMN trading_plans.use_breakeven_stop IS 'Move stop-loss to entry price once in profit';
COMMENT ON COLUMN trading_plans.breakeven_trigger_percent IS 'Move SL to breakeven when price reaches this % above entry';
COMMENT ON COLUMN trading_plans.breakeven_activated IS 'Whether breakeven stop has been activated';
COMMENT ON COLUMN trading_plans.breakeven_activated_at IS 'When breakeven stop was activated';

-- ========================================
-- TIME-BASED EXITS
-- ========================================

ALTER TABLE trading_plans
  ADD COLUMN IF NOT EXISTS max_hold_hours integer,  -- Auto-exit after X hours (null = no limit)
  ADD COLUMN IF NOT EXISTS time_exit_triggered boolean DEFAULT false;

COMMENT ON COLUMN trading_plans.max_hold_hours IS 'Maximum hours to hold position before auto-exit (null = unlimited)';
COMMENT ON COLUMN trading_plans.time_exit_triggered IS 'Whether position was exited due to time limit';

-- ========================================
-- DAILY LOSS LIMITS (User Settings)
-- ========================================

-- Create user_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,

  -- Daily loss limits
  daily_loss_limit_sol numeric DEFAULT 0.5,  -- Max SOL loss per day
  daily_loss_limit_enabled boolean DEFAULT true,

  -- Position limits
  max_concurrent_trades integer DEFAULT 5,
  max_position_size_sol numeric DEFAULT 1.0,

  -- Default trade settings
  default_stop_loss_percent numeric DEFAULT 5,
  default_take_profit_percent numeric DEFAULT 10,
  default_use_trailing_stop boolean DEFAULT false,
  default_trailing_stop_percent numeric DEFAULT 5,
  default_use_partial_profit boolean DEFAULT false,
  default_use_breakeven_stop boolean DEFAULT false,
  default_max_hold_hours integer,  -- null = unlimited

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS for user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE user_settings IS 'User-specific trading settings and risk limits';
COMMENT ON COLUMN user_settings.daily_loss_limit_sol IS 'Maximum SOL loss allowed per day (resets at midnight UTC)';
COMMENT ON COLUMN user_settings.max_concurrent_trades IS 'Maximum number of active trades at once';
COMMENT ON COLUMN user_settings.max_position_size_sol IS 'Maximum SOL per single trade';

-- ========================================
-- DAILY LOSS TRACKING VIEW
-- ========================================

-- Create a view to easily check today's P&L
CREATE OR REPLACE VIEW daily_pnl AS
SELECT
  user_id,
  DATE(created_at AT TIME ZONE 'UTC') as trade_date,
  COUNT(*) as trade_count,
  SUM(CASE WHEN profit_loss_sol > 0 THEN profit_loss_sol ELSE 0 END) as total_profit_sol,
  SUM(CASE WHEN profit_loss_sol < 0 THEN profit_loss_sol ELSE 0 END) as total_loss_sol,
  SUM(profit_loss_sol) as net_pnl_sol
FROM trading_plans
WHERE status = 'completed' AND profit_loss_sol IS NOT NULL
GROUP BY user_id, DATE(created_at AT TIME ZONE 'UTC');

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_trading_plans_active_trailing
  ON trading_plans(status, use_trailing_stop)
  WHERE status = 'active' AND use_trailing_stop = true;

CREATE INDEX IF NOT EXISTS idx_trading_plans_active_partial
  ON trading_plans(status, use_partial_profit, partial_profit_taken)
  WHERE status = 'active' AND use_partial_profit = true AND partial_profit_taken = false;

CREATE INDEX IF NOT EXISTS idx_trading_plans_completed_date
  ON trading_plans(user_id, status, created_at)
  WHERE status = 'completed';
