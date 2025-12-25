-- Migration: Add password columns to live_sessions table
-- Run this in Supabase SQL editor to update the schema

-- Add password columns to live_sessions table
ALTER TABLE olympia.live_sessions ADD COLUMN IF NOT EXISTS player_password text;
ALTER TABLE olympia.live_sessions ADD COLUMN IF NOT EXISTS requires_player_password boolean not null default true;
ALTER TABLE olympia.live_sessions ADD COLUMN IF NOT EXISTS mc_view_password text;
