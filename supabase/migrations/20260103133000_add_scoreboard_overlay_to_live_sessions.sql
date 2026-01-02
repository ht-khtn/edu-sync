-- Add synchronized scoreboard overlay flag

ALTER TABLE olympia.live_sessions
ADD COLUMN IF NOT EXISTS show_scoreboard_overlay boolean NOT NULL DEFAULT false;
