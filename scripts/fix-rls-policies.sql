-- Fix payments_select_own RLS policy so managers can see their teams' payments
DROP POLICY IF EXISTS "payments_select_own" ON payments;
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM registrations r
      JOIN teams t ON t.id = r.team_id
      WHERE r.id = payments.registration_id
        AND t.manager_id = auth.uid()
    )
  );

-- Fix payments_insert: managers should be able to insert payments for their teams
DROP POLICY IF EXISTS "payments_insert_manager" ON payments;
CREATE POLICY "payments_insert_manager" ON payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM registrations r
      JOIN teams t ON t.id = r.team_id
      WHERE r.id = payments.registration_id
        AND t.manager_id = auth.uid()
    )
  );

-- Fix notifications: allow inserts for server-side (service role handles it) and allow users to insert own
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- Allow service role to insert notifications for any user (needed for server actions)
DROP POLICY IF EXISTS "notifications_insert_service" ON notifications;
CREATE POLICY "notifications_insert_service" ON notifications
  FOR INSERT WITH CHECK (true);
