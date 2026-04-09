-- Migration: Fix infinite recursion in users RLS policy
-- Purpose: Remove the recursive policy and rely on existing policies
-- Date: 2026-01-30

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS users_select_team_members ON users;

-- The existing policies should handle most cases:
-- - users_select_own: Users can see their own data
-- - users_select_admin: Admins can see all users

-- For managers to see runners, we'll use the service role in server components
-- which bypasses RLS, or we can create a security definer function

-- Create a security definer function that bypasses RLS for checking user roles
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM users WHERE id = user_id;
$$;

-- Create a simpler policy that doesn't cause recursion
-- This policy allows managers to see runners without querying the users table recursively
CREATE POLICY users_select_runners_for_managers ON users
  FOR SELECT
  USING (
    -- User can always see themselves (handled by users_select_own, but adding for safety)
    auth.uid() = id
    OR
    -- If the current user is a manager (checked via function), they can see runners
    (
      get_user_role(auth.uid()) = 'manager' 
      AND role = 'runner'
    )
  );
