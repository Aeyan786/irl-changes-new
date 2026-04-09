-- Migration: Update RLS policies for users table
-- Purpose: Allow managers to see runner information for their team members
-- Date: 2026-01-30

-- First, check if the policy exists and drop it if it does
DROP POLICY IF EXISTS users_select_team_members ON users;

-- Create policy for managers to view their team members
-- This allows managers to see users who are members of their teams
CREATE POLICY users_select_team_members ON users
  FOR SELECT
  USING (
    -- User can see themselves
    auth.uid() = id
    OR
    -- Admins can see everyone (already covered by users_select_admin)
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR
    -- Managers can see runners who are in their teams
    EXISTS (
      SELECT 1 FROM teams t 
      WHERE t.manager_id = auth.uid() 
      AND users.id = ANY(t.members)
    )
    OR
    -- All users can see basic info of runners (for invitation purposes)
    -- This is limited - managers need to see runners to invite them
    (role = 'runner' AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'manager'
    ))
  );

-- Note: The existing users_select_own and users_select_admin policies 
-- should remain in place as they handle self-access and admin access
