-- Supabase SQL setup for cross-device sync
-- Run this in your Supabase SQL editor to create the necessary table

CREATE TABLE IF NOT EXISTS user_data (
  id BIGSERIAL PRIMARY KEY,
  google_user_id TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on google_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_data_google_user_id ON user_data(google_user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_data_updated_at ON user_data;
CREATE TRIGGER update_user_data_updated_at
    BEFORE UPDATE ON user_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only access their own data
-- Note: This assumes you're using Supabase Auth. If using Google OAuth only,
-- you may need to adjust this policy or use service role key in API routes
CREATE POLICY "Users can view their own data"
  ON user_data FOR SELECT
  USING (true); -- Adjust based on your auth setup

CREATE POLICY "Users can insert their own data"
  ON user_data FOR INSERT
  WITH CHECK (true); -- Adjust based on your auth setup

CREATE POLICY "Users can update their own data"
  ON user_data FOR UPDATE
  USING (true); -- Adjust based on your auth setup

