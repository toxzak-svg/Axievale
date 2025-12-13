-- Create users table for Axievale
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT,
  api_key TEXT NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  trial_remaining INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Usage table: increment per request for auditing
CREATE TABLE IF NOT EXISTS usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  event_type TEXT,
  value INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
