-- Add show_answers_overlay column to live_sessions table
ALTER TABLE olympia.live_sessions
ADD COLUMN show_answers_overlay boolean NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX idx_live_sessions_show_answers_overlay ON olympia.live_sessions(show_answers_overlay);
