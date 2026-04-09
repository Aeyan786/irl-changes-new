-- Migration: Schema Updates for Teams and Registrations
-- This script adds new columns, constraints, and triggers for enhanced team management

-- ============================================
-- TEAMS TABLE UPDATES
-- ============================================

-- Add 'details' column for team description (optional)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS details TEXT;

-- Add 'updated_at' column with default value
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing rows to have updated_at set to created_at
UPDATE public.teams SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;

-- Create trigger for teams updated_at (reuse existing function from users)
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- USERS TABLE UPDATES
-- ============================================

-- Add 'current_team_id' column for runners to track their current team
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- Create index on current_team_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_users_current_team_id ON public.users(current_team_id);

-- ============================================
-- REGISTRATIONS TABLE UPDATES
-- ============================================

-- Create new enum type for sub_team_types array if it doesn't exist
-- We'll use the existing team_type enum for the array elements

-- Add new column for multiple sub-team types (array)
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS sub_team_types team_type[] DEFAULT '{}';

-- Migrate existing data from sub_team_type to sub_team_types
UPDATE public.registrations 
SET sub_team_types = ARRAY[sub_team_type] 
WHERE sub_team_type IS NOT NULL 
  AND (sub_team_types IS NULL OR sub_team_types = '{}');

-- Note: We keep the old sub_team_type column for backward compatibility
-- It will be deprecated in future versions

-- ============================================
-- TRIGGER: Sync current_team_id with team members
-- ============================================

-- Function to update user's current_team_id when they are added/removed from a team
CREATE OR REPLACE FUNCTION public.sync_user_current_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_members UUID[];
  new_members UUID[];
  member_id UUID;
BEGIN
  -- Get old and new members arrays
  old_members := COALESCE(OLD.members, '{}');
  new_members := COALESCE(NEW.members, '{}');
  
  -- Find members that were removed (in old but not in new)
  FOREACH member_id IN ARRAY old_members
  LOOP
    IF NOT (member_id = ANY(new_members)) THEN
      -- Set current_team_id to NULL for removed members
      -- But only if their current_team_id was this team
      UPDATE public.users
      SET current_team_id = NULL
      WHERE id = member_id AND current_team_id = OLD.id;
    END IF;
  END LOOP;
  
  -- Find members that were added (in new but not in old)
  FOREACH member_id IN ARRAY new_members
  LOOP
    IF NOT (member_id = ANY(old_members)) THEN
      -- Set current_team_id for new members
      UPDATE public.users
      SET current_team_id = NEW.id
      WHERE id = member_id AND role = 'runner';
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for syncing current_team_id
DROP TRIGGER IF EXISTS sync_team_members_trigger ON public.teams;
CREATE TRIGGER sync_team_members_trigger
  AFTER INSERT OR UPDATE OF members ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_current_team();

-- Function to clear current_team_id when team is deleted
CREATE OR REPLACE FUNCTION public.clear_team_members_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_id UUID;
BEGIN
  -- Clear current_team_id for all members when team is deleted
  FOREACH member_id IN ARRAY COALESCE(OLD.members, '{}')
  LOOP
    UPDATE public.users
    SET current_team_id = NULL
    WHERE id = member_id AND current_team_id = OLD.id;
  END LOOP;
  
  RETURN OLD;
END;
$$;

-- Create trigger for team deletion
DROP TRIGGER IF EXISTS clear_team_members_on_delete_trigger ON public.teams;
CREATE TRIGGER clear_team_members_on_delete_trigger
  BEFORE DELETE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_team_members_on_delete();

-- ============================================
-- CONSTRAINT: One team per runner
-- ============================================

-- Function to check if a runner is already in another team
CREATE OR REPLACE FUNCTION public.check_runner_single_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_id UUID;
  existing_team_id UUID;
  existing_team_name TEXT;
BEGIN
  -- Check each new member
  FOREACH member_id IN ARRAY COALESCE(NEW.members, '{}')
  LOOP
    -- Skip if member was already in this team (not a new addition)
    IF OLD IS NOT NULL AND member_id = ANY(COALESCE(OLD.members, '{}')) THEN
      CONTINUE;
    END IF;
    
    -- Check if this runner is already in another team
    SELECT t.id, t.name INTO existing_team_id, existing_team_name
    FROM public.teams t
    WHERE member_id = ANY(t.members)
      AND t.id != NEW.id
    LIMIT 1;
    
    IF existing_team_id IS NOT NULL THEN
      RAISE EXCEPTION 'Runner % is already a member of team "%". A runner can only belong to one team.', 
        member_id, existing_team_name;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce single team per runner
DROP TRIGGER IF EXISTS check_runner_single_team_trigger ON public.teams;
CREATE TRIGGER check_runner_single_team_trigger
  BEFORE INSERT OR UPDATE OF members ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.check_runner_single_team();

-- ============================================
-- MIGRATE EXISTING DATA
-- ============================================

-- Update current_team_id for all existing team members
DO $$
DECLARE
  team_record RECORD;
  member_id UUID;
BEGIN
  FOR team_record IN SELECT id, members FROM public.teams WHERE members IS NOT NULL AND array_length(members, 1) > 0
  LOOP
    FOREACH member_id IN ARRAY team_record.members
    LOOP
      UPDATE public.users
      SET current_team_id = team_record.id
      WHERE id = member_id 
        AND role = 'runner'
        AND current_team_id IS NULL;
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================
-- ADDITIONAL RLS POLICIES
-- ============================================

-- Note: Existing policies already handle manager team updates via teams_update_own
-- which checks: auth.uid() = manager_id

-- Verify schema changes
SELECT 
  'teams' as table_name,
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'teams' 
  AND column_name IN ('details', 'updated_at')
UNION ALL
SELECT 
  'users' as table_name,
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'current_team_id'
UNION ALL
SELECT 
  'registrations' as table_name,
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'registrations' 
  AND column_name = 'sub_team_types';
