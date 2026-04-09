-- Migration: Remove types array from teams table
-- Team type selection is now handled only at race registration level
-- Keep is_high_school column

-- Drop the check constraint first
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS check_team_types_values;

-- Drop the types column
ALTER TABLE public.teams DROP COLUMN IF EXISTS types;
