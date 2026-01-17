-- Migration: Add limit buy (waiting_entry) support to trading_plans
-- Run this in your Supabase SQL editor

-- First, add new enum values to trading_plan_status
-- PostgreSQL requires ALTER TYPE ... ADD VALUE for enums
ALTER TYPE trading_plan_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE trading_plan_status ADD VALUE IF NOT EXISTS 'waiting_entry';
ALTER TYPE trading_plan_status ADD VALUE IF NOT EXISTS 'expired';

-- Update any existing 'draft' records to 'pending' (the new term)
-- Note: This requires a workaround since you can't directly cast between enum values
-- We'll update the column to text temporarily
ALTER TABLE trading_plans
  ALTER COLUMN status TYPE text;

UPDATE trading_plans SET status = 'pending' WHERE status = 'draft';
UPDATE trading_plans SET status = 'completed' WHERE status = 'triggered';

-- Now convert back to enum
ALTER TABLE trading_plans
  ALTER COLUMN status TYPE trading_plan_status USING status::trading_plan_status;

-- Set default to 'pending' instead of 'draft'
ALTER TABLE trading_plans
  ALTER COLUMN status SET DEFAULT 'pending';

-- Add new columns for limit buy functionality
ALTER TABLE trading_plans
  ADD COLUMN IF NOT EXISTS target_entry_price numeric,
  ADD COLUMN IF NOT EXISTS entry_threshold_percent numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS waiting_since timestamptz,
  ADD COLUMN IF NOT EXISTS max_wait_hours integer DEFAULT 24;

-- Add index for efficient waiting_entry queries
CREATE INDEX IF NOT EXISTS idx_trading_plans_waiting_entry
  ON trading_plans(status, target_entry_price)
  WHERE status = 'waiting_entry';

-- Add index for pending plans
CREATE INDEX IF NOT EXISTS idx_trading_plans_pending
  ON trading_plans(status)
  WHERE status = 'pending';

-- Comment on new columns
COMMENT ON COLUMN trading_plans.target_entry_price IS 'Target price to buy at (limit buy). If null, buys at market price.';
COMMENT ON COLUMN trading_plans.entry_threshold_percent IS 'Buy when price is within this % of target (default 1%)';
COMMENT ON COLUMN trading_plans.waiting_since IS 'When the plan started waiting for entry';
COMMENT ON COLUMN trading_plans.max_wait_hours IS 'Max hours to wait for entry before expiring (default 24)';
