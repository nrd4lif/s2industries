-- Migration: Add token_decimals to trading_plans
-- This allows proper display of token amounts

ALTER TABLE trading_plans
  ADD COLUMN IF NOT EXISTS token_decimals integer DEFAULT 9;

COMMENT ON COLUMN trading_plans.token_decimals IS 'Number of decimal places for the token (usually 6 or 9 for SPL tokens)';
