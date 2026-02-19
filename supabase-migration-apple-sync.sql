-- Migration: Add Supabase Auth (Sign in with Apple) support for sync
-- Run this in Supabase SQL editor after the initial supabase-setup.sql

-- Add column for Supabase Auth user id (from Sign in with Apple)
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE;

-- Allow google_user_id to be null for Apple-only users
ALTER TABLE user_data ALTER COLUMN google_user_id DROP NOT NULL;

-- Index for Supabase user lookups
CREATE INDEX IF NOT EXISTS idx_user_data_supabase_user_id ON user_data(supabase_user_id);

-- Ensure we have a unique constraint for upsert by supabase_user_id (already UNIQUE above)
-- No additional changes needed for RLS; API uses service role key
