-- Migration: Add types array and is_high_school to teams table
-- types: array of text values ('male', 'female', 'co-ed')
-- is_high_school: boolean flag for high school teams

-- Add types column (text array, default empty)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS types text[] DEFAULT '{}';

-- Add is_high_school column (boolean, default false)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_high_school boolean DEFAULT false;

-- Add check constraint to ensure valid type values
-- Using a function-based approach for array element validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_team_types_values'
  ) THEN
    ALTER TABLE public.teams ADD CONSTRAINT check_team_types_values
      CHECK (types <@ ARRAY['male', 'female', 'co-ed']::text[]);
  END IF;
END $$;

-- Set existing teams to empty types array (already default, but be explicit)
UPDATE public.teams SET types = '{}' WHERE types IS NULL;
UPDATE public.teams SET is_high_school = false WHERE is_high_school IS NULL;
