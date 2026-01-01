-- Synced from docs/supabase/migrations/20241225120000_add_passwords_to_live_sessions.sql

alter table if exists olympia.live_sessions
  add column if not exists player_password text,
  add column if not exists mc_view_password text;
