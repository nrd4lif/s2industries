-- Migration: Add dynamic profit protection fields
-- These are calculated from token volatility at order creation but can be manually adjusted

-- Profit protection settings on trading_plans
ALTER TABLE trading_plans
ADD COLUMN IF NOT EXISTS profit_protection_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS profit_trigger_percent NUMERIC,        -- Start protecting after this profit % (default: volatility × 1.5)
ADD COLUMN IF NOT EXISTS giveback_allowed_percent NUMERIC,      -- Check MACD after this % drop from peak (default: volatility × 0.5)
ADD COLUMN IF NOT EXISTS hard_floor_percent NUMERIC,            -- Exit regardless after this % drop from peak (default: volatility × 0.75)
ADD COLUMN IF NOT EXISTS peak_profit_percent NUMERIC,           -- Track highest unrealized profit %
ADD COLUMN IF NOT EXISTS profit_protection_triggered_at TIMESTAMPTZ,  -- When protection logic first engaged
ADD COLUMN IF NOT EXISTS token_volatility_at_entry NUMERIC;     -- Store the volatility used to calculate defaults

-- Add comment explaining the feature
COMMENT ON COLUMN trading_plans.profit_protection_enabled IS 'Enable dynamic profit protection based on MACD + volatility';
COMMENT ON COLUMN trading_plans.profit_trigger_percent IS 'Start monitoring for exit once profit exceeds this % (default: volatility × 1.5)';
COMMENT ON COLUMN trading_plans.giveback_allowed_percent IS 'Check MACD for exit signal after price drops this % from peak (default: volatility × 0.5)';
COMMENT ON COLUMN trading_plans.hard_floor_percent IS 'Force exit if price drops this % from peak regardless of MACD (default: volatility × 0.75)';
COMMENT ON COLUMN trading_plans.peak_profit_percent IS 'Highest unrealized profit % achieved during this trade';
COMMENT ON COLUMN trading_plans.token_volatility_at_entry IS 'Token volatility at time of entry, used to calculate default thresholds';
