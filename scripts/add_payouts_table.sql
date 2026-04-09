-- Create payouts table to track admin withdrawals
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_payout_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_transit, paid, failed, canceled
  destination TEXT, -- Bank account last 4 digits or description
  failure_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  arrived_at TIMESTAMPTZ
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payouts_admin_id ON public.payouts(admin_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON public.payouts(created_at DESC);

-- Enable RLS
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Admins can view all payouts
CREATE POLICY "Admins can view all payouts"
  ON public.payouts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert payouts
CREATE POLICY "Admins can create payouts"
  ON public.payouts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update payouts
CREATE POLICY "Admins can update payouts"
  ON public.payouts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
