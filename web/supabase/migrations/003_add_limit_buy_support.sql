-- Migration: Add limit buy (waiting_entry) support to trading_plans
-- Run this in your Supabase SQL editor

-- Add new columns for limit buy functionality
ALTER TABLE trading_plans
  ADD COLUMN IF NOT EXISTS target_entry_price numeric,
  ADD COLUMN IF NOT EXISTS entry_threshold_percent numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS waiting_since timestamptz,
  ADD COLUMN IF NOT EXISTS max_wait_hours integer DEFAULT 24;

-- Update status check constraint to include 'waiting_entry'
-- First drop the old constraint if it exists, then add new one
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'trading_plans_status_check'
    AND table_name = 'trading_plans'
  ) THEN
    ALTER TABLE trading_plans DROP CONSTRAINT trading_plans_status_check;
  END IF;
END $$;

-- Add updated constraint with waiting_entry status
ALTER TABLE trading_plans
  ADD CONSTRAINT trading_plans_status_check
  CHECK (status IN ('pending', 'waiting_entry', 'active', 'completed', 'cancelled', 'expired'));

-- Add index for efficient waiting_entry queries
CREATE INDEX IF NOT EXISTS idx_trading_plans_waiting_entry
  ON trading_plans(status, target_entry_price)
  WHERE status = 'waiting_entry';

-- Comment on new columns
COMMENT ON COLUMN trading_plans.target_entry_price IS 'Target price to buy at (limit buy). If null, buys at market price.';
COMMENT ON COLUMN trading_plans.entry_threshold_percent IS 'Buy when price is within this % of target (default 1%)';
COMMENT ON COLUMN trading_plans.waiting_since IS 'When the plan started waiting for entry';
COMMENT ON COLUMN trading_plans.max_wait_hours IS 'Max hours to wait for entry before expiring (default 24)';
