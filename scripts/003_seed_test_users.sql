-- Seed Test Data for IRL App
-- Note: Users must be created through the Supabase Auth system (sign up flow)
-- This script only seeds races and other public data that don't require auth.users references
-- 
-- To create test users, use the sign up page at /auth/sign-up:
-- 1. Sign up with your email
-- 2. Update your role in the users table if needed (for manager/admin access)

-- Create a sample upcoming race
INSERT INTO public.races (
  id,
  title,
  date,
  venue,
  status,
  details,
  rules,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000020',
  'Spring Championship 2025',
  '2025-04-15 08:00:00+00',
  'Central Park, New York',
  'upcoming',
  'Annual spring championship race featuring 10K and half-marathon categories. Open to all registered teams.',
  '1. All runners must be registered team members.\n2. Each team can register up to 30 runners.\n3. Runners cannot participate in more than 3 legs.\n4. Registration fee: $10 per runner.',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  date = EXCLUDED.date;

-- Create another upcoming race
INSERT INTO public.races (
  id,
  title,
  date,
  venue,
  status,
  details,
  rules,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000021',
  'Summer Marathon Series',
  '2025-06-20 07:00:00+00',
  'Lakefront Trail, Chicago',
  'upcoming',
  'Summer marathon series with scenic lakefront views. Full marathon and relay options available.',
  '1. Teams must have minimum 10 runners.\n2. Hydration stations every 2 miles.\n3. Medical support on standby.\n4. Awards ceremony at 2 PM.',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  date = EXCLUDED.date;

-- Create a past race
INSERT INTO public.races (
  id,
  title,
  date,
  venue,
  status,
  details,
  rules,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000022',
  'Winter Classic 2024',
  '2024-12-10 09:00:00+00',
  'Freedom Trail, Boston',
  'past',
  'Annual winter classic through historic Boston landmarks.',
  'Standard IRL race rules apply.',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  status = EXCLUDED.status;

-- Output confirmation
SELECT 'Seed data created successfully! Sample races have been added.' as status;
SELECT 'To create users, sign up at /auth/sign-up' as info;
