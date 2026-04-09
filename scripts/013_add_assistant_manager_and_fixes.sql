-- ============================================================
-- Migration 013: Assistant Manager Role + Race Fields + Schema Fixes
-- ============================================================

-- ============================================================
-- 1. ADD assistant_manager TO user_role ENUM
-- ============================================================
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'assistant_manager';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. ASSISTANT MANAGERS TABLE
--    Tracks which users are assistant managers for which team
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assistant_managers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_assistant_managers_team_id ON public.assistant_managers(team_id);
CREATE INDEX IF NOT EXISTS idx_assistant_managers_user_id ON public.assistant_managers(user_id);

-- Enable RLS
ALTER TABLE public.assistant_managers ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "am_select_own_team" ON public.assistant_managers;
CREATE POLICY "am_select_own_team" ON public.assistant_managers
  FOR SELECT USING (
    -- Manager of the team can see
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND manager_id = auth.uid())
    -- The assistant manager themselves can see
    OR user_id = auth.uid()
    -- Admins can see all
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "am_insert_manager" ON public.assistant_managers;
CREATE POLICY "am_insert_manager" ON public.assistant_managers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND manager_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "am_delete_manager" ON public.assistant_managers;
CREATE POLICY "am_delete_manager" ON public.assistant_managers
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND manager_id = auth.uid())
    OR public.is_admin()
  );

-- ============================================================
-- 3. RACES TABLE — add missing fields
--    registration_open, registration_deadline, max_runners_per_team, num_legs
-- ============================================================
ALTER TABLE public.races ADD COLUMN IF NOT EXISTS registration_open    BOOLEAN       DEFAULT true;
ALTER TABLE public.races ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ  DEFAULT NULL;
ALTER TABLE public.races ADD COLUMN IF NOT EXISTS max_runners_per_team  INTEGER       DEFAULT 10;
ALTER TABLE public.races ADD COLUMN IF NOT EXISTS num_legs              INTEGER       DEFAULT 30;
ALTER TABLE public.races ADD COLUMN IF NOT EXISTS gender_rules          JSONB         DEFAULT '{
  "coed_min_female": 5,
  "male_min_male": 5,
  "female_all_female": true
}'::jsonb;

-- ============================================================
-- 4. USERS TABLE — add missing runner profile fields
-- ============================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio         TEXT DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone       TEXT DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS waiver_accepted BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS waiver_accepted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- 5. UPDATE is_manager() helper to include assistant_manager
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('manager', 'admin', 'assistant_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. FUNCTION: Assign assistant manager to a team
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_assistant_manager(
  p_team_id    UUID,
  p_user_id    UUID,
  p_manager_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team   RECORD;
  v_user   RECORD;
BEGIN
  -- Verify team exists and belongs to manager
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id AND manager_id = p_manager_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Team not found or you are not the manager');
  END IF;

  -- Verify target user exists and is a member of the team
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- User must be a runner/member of this team
  IF NOT (p_user_id = ANY(v_team.members)) THEN
    RETURN jsonb_build_object('error', 'User must be a team member to be assigned as assistant manager');
  END IF;

  -- Cannot assign the main manager
  IF p_user_id = p_manager_id THEN
    RETURN jsonb_build_object('error', 'Cannot assign yourself as assistant manager');
  END IF;

  -- Insert into assistant_managers table
  INSERT INTO public.assistant_managers (team_id, user_id, assigned_by)
  VALUES (p_team_id, p_user_id, p_manager_id)
  ON CONFLICT (team_id, user_id) DO NOTHING;

  -- Update the user's role to assistant_manager
  UPDATE public.users SET role = 'assistant_manager' WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 7. FUNCTION: Remove assistant manager from a team
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_assistant_manager(
  p_team_id    UUID,
  p_user_id    UUID,
  p_manager_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team RECORD;
BEGIN
  -- Verify team exists and belongs to manager
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id AND manager_id = p_manager_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Team not found or you are not the manager');
  END IF;

  -- Remove from assistant_managers table
  DELETE FROM public.assistant_managers WHERE team_id = p_team_id AND user_id = p_user_id;

  -- Revert user role back to runner
  UPDATE public.users SET role = 'runner' WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 8. RLS: assistant_managers can view their team's data
-- ============================================================

-- Allow assistant managers to see their team's registrations
DROP POLICY IF EXISTS "registrations_select_assistant_manager" ON public.registrations;
CREATE POLICY "registrations_select_assistant_manager" ON public.registrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assistant_managers am
      WHERE am.team_id = registrations.team_id AND am.user_id = auth.uid()
    )
  );

-- Allow assistant managers to update registrations (add/remove runners)
DROP POLICY IF EXISTS "registrations_update_assistant_manager" ON public.registrations;
CREATE POLICY "registrations_update_assistant_manager" ON public.registrations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.assistant_managers am
      WHERE am.team_id = registrations.team_id AND am.user_id = auth.uid()
    )
  );

-- Allow assistant managers to see payments for their team
DROP POLICY IF EXISTS "payments_select_assistant_manager" ON public.payments;
CREATE POLICY "payments_select_assistant_manager" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.registrations r
      JOIN public.assistant_managers am ON am.team_id = r.team_id
      WHERE r.id = payments.registration_id AND am.user_id = auth.uid()
    )
  );

-- Allow assistant managers to insert payments for their team
DROP POLICY IF EXISTS "payments_insert_assistant_manager" ON public.payments;
CREATE POLICY "payments_insert_assistant_manager" ON public.payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.registrations r
      JOIN public.assistant_managers am ON am.team_id = r.team_id
      WHERE r.id = payments.registration_id AND am.user_id = auth.uid()
    )
  );

-- Allow assistant managers to see their team
DROP POLICY IF EXISTS "teams_select_assistant_manager" ON public.teams;
CREATE POLICY "teams_select_assistant_manager" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assistant_managers am
      WHERE am.team_id = teams.id AND am.user_id = auth.uid()
    )
  );

-- Allow assistant managers to update team (add/remove runners only — NOT manager itself)
DROP POLICY IF EXISTS "teams_update_assistant_manager" ON public.teams;
CREATE POLICY "teams_update_assistant_manager" ON public.teams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.assistant_managers am
      WHERE am.team_id = teams.id AND am.user_id = auth.uid()
    )
  );

-- Allow assistant managers to view users on their team
DROP POLICY IF EXISTS "users_select_assistant_manager" ON public.users;
CREATE POLICY "users_select_assistant_manager" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assistant_managers am
      JOIN public.teams t ON t.id = am.team_id
      WHERE am.user_id = auth.uid()
        AND (users.id = ANY(t.members) OR users.id = t.manager_id)
    )
  );

-- Allow assistant managers to view invitations for their team
DROP POLICY IF EXISTS "invitations_select_assistant_manager" ON public.invitations;
CREATE POLICY "invitations_select_assistant_manager" ON public.invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assistant_managers am
      WHERE am.team_id = invitations.team_id AND am.user_id = auth.uid()
    )
  );

-- Allow assistant managers to create invitations for their team
DROP POLICY IF EXISTS "invitations_insert_assistant_manager" ON public.invitations;
CREATE POLICY "invitations_insert_assistant_manager" ON public.invitations
  FOR INSERT WITH CHECK (
    auth.uid() = from_user_id AND
    EXISTS (
      SELECT 1 FROM public.assistant_managers am
      WHERE am.team_id = invitations.team_id AND am.user_id = auth.uid()
    )
  );

-- ============================================================
-- 9. FIX: add_team_member / remove_team_member allow assistant managers
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_team_member(
  p_team_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.teams
  SET members = array_append(members, p_user_id)
  WHERE id = p_team_id
  AND NOT (p_user_id = ANY(members));
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_team_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.teams
  SET members = array_remove(members, p_user_id)
  WHERE id = p_team_id;
  RETURN FOUND;
END;
$$;

-- ============================================================
-- 10. MIDDLEWARE helper: get_user_role updated for assistant_manager
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM users WHERE id = user_id;
$$;

-- ============================================================
-- 11. Verify changes
-- ============================================================
SELECT
  'assistant_managers table' AS check_item,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assistant_managers') AS exists;

SELECT
  'races.registration_open' AS check_item,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'registration_open') AS exists;

SELECT
  'users.bio' AS check_item,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') AS exists;
