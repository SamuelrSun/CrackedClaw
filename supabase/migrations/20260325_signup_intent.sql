-- Add signup_intent to profiles to track how users signed up
-- Values: 'full' (normal Dopl with companion), 'brain' (brain-only signup)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_intent text DEFAULT 'full';
