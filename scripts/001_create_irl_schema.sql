-- Infinite Running League (IRL) Database Schema
-- This script creates all tables, enums, indexes, and RLS policies

-- ============================================
-- ENUMS (Create only if they don't exist)
-- ============================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('runner', 'manager', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gender_type AS ENUM ('male', 'female', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE team_type AS ENUM ('male', 'female', 'co-ed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE race_status AS ENUM ('past', 'current', 'upcoming');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invitation_type AS ENUM ('team_join', 'race_invite');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- TABLES
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'runner',
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE NOT NULL,
  address JSONB DEFAULT '{}',
  age INTEGER CHECK (age >= 0 AND age <= 150),
  gender gender_type,
  past_achievements TEXT,
  disabilities TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  members UUID[] DEFAULT '{}',
  type team_type NOT NULL DEFAULT 'co-ed',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Races table
CREATE TABLE IF NOT EXISTS public.races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  venue TEXT NOT NULL,
  details TEXT,
  rules TEXT,
  status race_status NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Registrations table
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sub_team_type team_type NOT NULL,
  runners UUID[] DEFAULT '{}',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  paid_amount NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_email TEXT,
  to_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  status invitation_status NOT NULL DEFAULT 'pending',
  type invitation_type NOT NULL,
  invite_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Either to_email or to_user_id must be provided
  CONSTRAINT invitation_recipient_check CHECK (to_email IS NOT NULL OR to_user_id IS NOT NULL)
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  stripe_id TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_manager_id ON public.teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_teams_name ON public.teams(name);

-- Races indexes
CREATE INDEX IF NOT EXISTS idx_races_date ON public.races(date);
CREATE INDEX IF NOT EXISTS idx_races_status ON public.races(status);

-- Registrations indexes
CREATE INDEX IF NOT EXISTS idx_registrations_race_id ON public.registrations(race_id);
CREATE INDEX IF NOT EXISTS idx_registrations_team_id ON public.registrations(team_id);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON public.registrations(payment_status);

-- Invitations indexes
CREATE INDEX IF NOT EXISTS idx_invitations_to_email ON public.invitations(to_email);
CREATE INDEX IF NOT EXISTS idx_invitations_to_user_id ON public.invitations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_from_user_id ON public.invitations(from_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_team_id ON public.invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_registration_id ON public.payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_id ON public.payments(stripe_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

DROP POLICY IF EXISTS "teams_select_all" ON public.teams;
DROP POLICY IF EXISTS "teams_insert_manager" ON public.teams;
DROP POLICY IF EXISTS "teams_update_own" ON public.teams;
DROP POLICY IF EXISTS "teams_update_admin" ON public.teams;
DROP POLICY IF EXISTS "teams_delete_own" ON public.teams;
DROP POLICY IF EXISTS "teams_delete_admin" ON public.teams;

DROP POLICY IF EXISTS "races_select_all" ON public.races;
DROP POLICY IF EXISTS "races_insert_admin" ON public.races;
DROP POLICY IF EXISTS "races_update_admin" ON public.races;
DROP POLICY IF EXISTS "races_delete_admin" ON public.races;

DROP POLICY IF EXISTS "registrations_select_own" ON public.registrations;
DROP POLICY IF EXISTS "registrations_select_admin" ON public.registrations;
DROP POLICY IF EXISTS "registrations_insert_manager" ON public.registrations;
DROP POLICY IF EXISTS "registrations_insert_admin" ON public.registrations;
DROP POLICY IF EXISTS "registrations_update_manager" ON public.registrations;
DROP POLICY IF EXISTS "registrations_update_admin" ON public.registrations;
DROP POLICY IF EXISTS "registrations_delete_admin" ON public.registrations;

DROP POLICY IF EXISTS "invitations_select_recipient" ON public.invitations;
DROP POLICY IF EXISTS "invitations_select_sender" ON public.invitations;
DROP POLICY IF EXISTS "invitations_select_admin" ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert_manager" ON public.invitations;
DROP POLICY IF EXISTS "invitations_update_recipient" ON public.invitations;
DROP POLICY IF EXISTS "invitations_update_admin" ON public.invitations;
DROP POLICY IF EXISTS "invitations_delete_sender" ON public.invitations;
DROP POLICY IF EXISTS "invitations_delete_admin" ON public.invitations;

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_admin" ON public.payments;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('manager', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- USERS POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT USING (public.is_admin());

-- Users can insert their own profile (handled by trigger)
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Admins can update any user
CREATE POLICY "users_update_admin" ON public.users
  FOR UPDATE USING (public.is_admin());

-- Admins can delete any user
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE USING (public.is_admin());

-- ============================================
-- TEAMS POLICIES
-- ============================================

-- Anyone authenticated can view teams
CREATE POLICY "teams_select_all" ON public.teams
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Managers and admins can create teams
CREATE POLICY "teams_insert_manager" ON public.teams
  FOR INSERT WITH CHECK (public.is_manager() AND auth.uid() = manager_id);

-- Team managers can update their own teams
CREATE POLICY "teams_update_own" ON public.teams
  FOR UPDATE USING (auth.uid() = manager_id);

-- Admins can update any team
CREATE POLICY "teams_update_admin" ON public.teams
  FOR UPDATE USING (public.is_admin());

-- Team managers can delete their own teams
CREATE POLICY "teams_delete_own" ON public.teams
  FOR DELETE USING (auth.uid() = manager_id);

-- Admins can delete any team
CREATE POLICY "teams_delete_admin" ON public.teams
  FOR DELETE USING (public.is_admin());

-- ============================================
-- RACES POLICIES
-- ============================================

-- Anyone can view races (public)
CREATE POLICY "races_select_all" ON public.races
  FOR SELECT USING (true);

-- Only admins can create races
CREATE POLICY "races_insert_admin" ON public.races
  FOR INSERT WITH CHECK (public.is_admin());

-- Only admins can update races
CREATE POLICY "races_update_admin" ON public.races
  FOR UPDATE USING (public.is_admin());

-- Only admins can delete races
CREATE POLICY "races_delete_admin" ON public.races
  FOR DELETE USING (public.is_admin());

-- ============================================
-- REGISTRATIONS POLICIES
-- ============================================

-- Users can view registrations for their teams
CREATE POLICY "registrations_select_own" ON public.registrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams 
      WHERE teams.id = registrations.team_id 
      AND (teams.manager_id = auth.uid() OR auth.uid() = ANY(teams.members))
    )
  );

-- Admins can view all registrations
CREATE POLICY "registrations_select_admin" ON public.registrations
  FOR SELECT USING (public.is_admin());

-- Team managers can create registrations for their teams
CREATE POLICY "registrations_insert_manager" ON public.registrations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams 
      WHERE teams.id = registrations.team_id 
      AND teams.manager_id = auth.uid()
    )
  );

-- Admins can create any registration
CREATE POLICY "registrations_insert_admin" ON public.registrations
  FOR INSERT WITH CHECK (public.is_admin());

-- Team managers can update their team's registrations
CREATE POLICY "registrations_update_manager" ON public.registrations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.teams 
      WHERE teams.id = registrations.team_id 
      AND teams.manager_id = auth.uid()
    )
  );

-- Admins can update any registration
CREATE POLICY "registrations_update_admin" ON public.registrations
  FOR UPDATE USING (public.is_admin());

-- Admins can delete registrations
CREATE POLICY "registrations_delete_admin" ON public.registrations
  FOR DELETE USING (public.is_admin());

-- ============================================
-- INVITATIONS POLICIES
-- ============================================

-- Users can view invitations sent to them
CREATE POLICY "invitations_select_recipient" ON public.invitations
  FOR SELECT USING (
    to_user_id = auth.uid() 
    OR to_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- Users can view invitations they sent
CREATE POLICY "invitations_select_sender" ON public.invitations
  FOR SELECT USING (from_user_id = auth.uid());

-- Admins can view all invitations
CREATE POLICY "invitations_select_admin" ON public.invitations
  FOR SELECT USING (public.is_admin());

-- Managers can create invitations for their teams
CREATE POLICY "invitations_insert_manager" ON public.invitations
  FOR INSERT WITH CHECK (
    auth.uid() = from_user_id AND
    (team_id IS NULL OR EXISTS (
      SELECT 1 FROM public.teams 
      WHERE teams.id = invitations.team_id 
      AND teams.manager_id = auth.uid()
    ))
  );

-- Recipients can update invitation status (accept/reject)
CREATE POLICY "invitations_update_recipient" ON public.invitations
  FOR UPDATE USING (
    to_user_id = auth.uid() 
    OR to_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- Admins can update any invitation
CREATE POLICY "invitations_update_admin" ON public.invitations
  FOR UPDATE USING (public.is_admin());

-- Senders can delete their pending invitations
CREATE POLICY "invitations_delete_sender" ON public.invitations
  FOR DELETE USING (from_user_id = auth.uid() AND status = 'pending');

-- Admins can delete any invitation
CREATE POLICY "invitations_delete_admin" ON public.invitations
  FOR DELETE USING (public.is_admin());

-- ============================================
-- PAYMENTS POLICIES
-- ============================================

-- Users can view payments for their team's registrations
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.registrations r
      JOIN public.teams t ON t.id = r.team_id
      WHERE r.id = payments.registration_id 
      AND (t.manager_id = auth.uid() OR auth.uid() = ANY(t.members))
    )
  );

-- Admins can view all payments
CREATE POLICY "payments_select_admin" ON public.payments
  FOR SELECT USING (public.is_admin());

-- Only admins or system can create payments (typically via webhook)
CREATE POLICY "payments_insert_admin" ON public.payments
  FOR INSERT WITH CHECK (public.is_admin());

-- Only admins can update payments
CREATE POLICY "payments_update_admin" ON public.payments
  FOR UPDATE USING (public.is_admin());

-- Only admins can delete payments
CREATE POLICY "payments_delete_admin" ON public.payments
  FOR DELETE USING (public.is_admin());

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger function to create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', NULL),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'runner')
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger function to update race status based on date
CREATE OR REPLACE FUNCTION public.update_race_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.date < NOW() THEN
    NEW.status := 'past';
  ELSIF NEW.date <= NOW() + INTERVAL '1 day' THEN
    NEW.status := 'current';
  ELSE
    NEW.status := 'upcoming';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for race status updates
DROP TRIGGER IF EXISTS update_race_status_trigger ON public.races;
CREATE TRIGGER update_race_status_trigger
  BEFORE INSERT OR UPDATE OF date ON public.races
  FOR EACH ROW
  EXECUTE FUNCTION public.update_race_status();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to add a member to a team
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

-- Function to remove a member from a team
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

-- Function to get team members with details
CREATE OR REPLACE FUNCTION public.get_team_members(p_team_id UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role user_role,
  gender gender_type
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.gender
  FROM public.users u
  WHERE u.id = ANY(
    SELECT unnest(t.members) FROM public.teams t WHERE t.id = p_team_id
  )
  OR u.id = (SELECT t.manager_id FROM public.teams t WHERE t.id = p_team_id);
END;
$$;
