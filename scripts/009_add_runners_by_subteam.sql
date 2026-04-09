-- Migration: Add runners_by_subteam JSONB column to registrations table
-- This stores runners organized by sub-team type for multi-sub-team registrations

-- Add runners_by_subteam column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registrations' AND column_name = 'runners_by_subteam'
  ) THEN
    ALTER TABLE registrations ADD COLUMN runners_by_subteam jsonb DEFAULT NULL;
    
    COMMENT ON COLUMN registrations.runners_by_subteam IS 'Structured runners by sub-team type: {"male": [...], "female": [...], "co-ed": [...]}';
  END IF;
END $$;

-- Migrate existing data: convert runners array to structured format based on sub_team_type
UPDATE registrations
SET runners_by_subteam = jsonb_build_object(sub_team_type, runners)
WHERE runners_by_subteam IS NULL AND runners IS NOT NULL AND array_length(runners, 1) > 0;
