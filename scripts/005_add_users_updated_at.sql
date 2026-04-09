-- Migration: Add updated_at column to users table
-- This adds an updated_at timestamp that auto-updates on row changes

-- Add the updated_at column with default value
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Update existing rows to have updated_at set to created_at (or now if created_at is null)
UPDATE users SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;

-- Create or replace the trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists (to avoid errors on re-run)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Create the trigger
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'updated_at';
