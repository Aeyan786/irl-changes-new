-- Migration: Remove team type from teams table
-- The team type is no longer needed as teams can have mixed gender members
-- Note: registrations.sub_team_type is kept for race-specific sub-team categorization

-- Drop the type column from teams table
ALTER TABLE public.teams DROP COLUMN IF EXISTS type;

-- Drop the team_type enum if it's no longer used elsewhere
-- Note: registrations.sub_team_type still uses this enum, so we keep it
-- DO $$ BEGIN
--   DROP TYPE team_type;
-- EXCEPTION
--   WHEN dependent_objects_still_exist THEN NULL;
-- END $$;

-- Add a comment explaining the change
COMMENT ON TABLE public.teams IS 'Teams table - type column removed as teams can now have mixed gender members. Sub-team types for race registrations are handled via registrations.sub_team_type';
