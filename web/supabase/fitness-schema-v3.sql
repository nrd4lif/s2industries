-- S2 Fitness Module Schema v3 - Food Notes
-- Run this migration AFTER fitness-schema-v2.sql

-- Add food_notes column to workout_days for logging diet deviations
ALTER TABLE workout_days
ADD COLUMN IF NOT EXISTS food_notes text;

-- Comment explaining the field
COMMENT ON COLUMN workout_days.food_notes IS 'Optional notes about food/nutrition for the day (e.g., restaurant meals, alcohol, deviations from normal diet)';
