-- Synced from docs/supabase/migrations/20241225130000_add_session_verifications.sql

create table if not exists olympia.session_verifications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references olympia.live_sessions(id) on delete cascade,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index if not exists idx_olympia_session_verifications_session
  on olympia.session_verifications (session_id);

create index if not exists idx_olympia_session_verifications_user
  on olympia.session_verifications (user_id);

alter table if exists olympia.live_sessions
  add column if not exists requires_player_password boolean not null default true;

alter table if exists olympia.live_sessions
  add column if not exists password_generated_at timestamptz;

alter table if exists olympia.live_sessions
  add column if not exists password_generated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
