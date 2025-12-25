-- Migration: Add session_verifications table to track user password verifications
-- This allows verification to persist across devices/browsers

-- Create session_verifications table
CREATE TABLE IF NOT EXISTS olympia.session_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES olympia.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  verified_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE(session_id, user_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_session_verifications_session_id 
  ON olympia.session_verifications(session_id);

CREATE INDEX IF NOT EXISTS idx_session_verifications_user_id 
  ON olympia.session_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_session_verifications_expires_at 
  ON olympia.session_verifications(expires_at);

-- Add password_history table to track password changes (for audit)
CREATE TABLE IF NOT EXISTS olympia.session_password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES olympia.live_sessions(id) ON DELETE CASCADE,
  player_password_hash text NOT NULL,
  mc_view_password_hash text NOT NULL,
  player_password_plain text NOT NULL,
  mc_password_plain text NOT NULL,
  generated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_current boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_session_password_history_session_id 
  ON olympia.session_password_history(session_id);
