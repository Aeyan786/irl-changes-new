-- Results Table for Race Performance Data
-- This script creates the results table with all necessary indexes and RLS policies

-- ============================================
-- TABLE
-- ============================================

-- Results table for storing race performance data
CREATE TABLE IF NOT EXISTS public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  runner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leg_times NUMERIC[] DEFAULT '{}',
  total_time NUMERIC NOT NULL,
  finish_position INTEGER CHECK (finish_position > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

-- Index on race_id for filtering results by race
CREATE INDEX IF NOT EXISTS idx_results_race_id ON public.results(race_id);

-- Index on runner_id for filtering results by runner
CREATE INDEX IF NOT EXISTS idx_results_runner_id ON public.results(runner_id);

-- Index on registration_id for linking to team registrations
CREATE INDEX IF NOT EXISTS idx_results_registration_id ON public.results(registration_id);

-- Index on finish_position for ranking queries
CREATE INDEX IF NOT EXISTS idx_results_finish_position ON public.results(finish_position);

-- Composite index for race leaderboards
CREATE INDEX IF NOT EXISTS idx_results_race_finish_position ON public.results(race_id, finish_position);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on results table
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "results_select_own" ON public.results;
DROP POLICY IF EXISTS "results_select_manager" ON public.results;
DROP POLICY IF EXISTS "results_select_admin" ON public.results;
DROP POLICY IF EXISTS "results_insert_admin" ON public.results;
DROP POLICY IF EXISTS "results_update_admin" ON public.results;
DROP POLICY IF EXISTS "results_delete_admin" ON public.results;

-- ============================================
-- RESULTS POLICIES
-- ============================================

-- Runners can view their own results
CREATE POLICY "results_select_own" ON public.results
  FOR SELECT USING (runner_id = auth.uid());

-- Managers can view results for runners in their teams
CREATE POLICY "results_select_manager" ON public.results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.manager_id = auth.uid()
      AND results.runner_id = ANY(t.members)
    )
  );

-- Admins can view all results
CREATE POLICY "results_select_admin" ON public.results
  FOR SELECT USING (public.is_admin());

-- Only admins can create results
CREATE POLICY "results_insert_admin" ON public.results
  FOR INSERT WITH CHECK (public.is_admin());

-- Only admins can update results
CREATE POLICY "results_update_admin" ON public.results
  FOR UPDATE USING (public.is_admin());

-- Only admins can delete results
CREATE POLICY "results_delete_admin" ON public.results
  FOR DELETE USING (public.is_admin());

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get race leaderboard
CREATE OR REPLACE FUNCTION public.get_race_leaderboard(p_race_id UUID)
RETURNS TABLE (
  id UUID,
  runner_id UUID,
  runner_first_name TEXT,
  runner_last_name TEXT,
  runner_email TEXT,
  leg_times NUMERIC[],
  total_time NUMERIC,
  finish_position INTEGER,
  notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.runner_id,
    u.first_name as runner_first_name,
    u.last_name as runner_last_name,
    u.email as runner_email,
    r.leg_times,
    r.total_time,
    r.finish_position,
    r.notes
  FROM public.results r
  JOIN public.users u ON u.id = r.runner_id
  WHERE r.race_id = p_race_id
  ORDER BY r.finish_position ASC NULLS LAST, r.total_time ASC;
END;
$$;

-- Function to get runner's race history
CREATE OR REPLACE FUNCTION public.get_runner_results(p_runner_id UUID)
RETURNS TABLE (
  id UUID,
  race_id UUID,
  race_title TEXT,
  race_date TIMESTAMPTZ,
  race_venue TEXT,
  leg_times NUMERIC[],
  total_time NUMERIC,
  finish_position INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.race_id,
    rc.title as race_title,
    rc.date as race_date,
    rc.venue as race_venue,
    r.leg_times,
    r.total_time,
    r.finish_position,
    r.notes,
    r.created_at
  FROM public.results r
  JOIN public.races rc ON rc.id = r.race_id
  WHERE r.runner_id = p_runner_id
  ORDER BY rc.date DESC;
END;
$$;

-- Output confirmation
SELECT 'Results table created successfully with RLS policies!' as status;
