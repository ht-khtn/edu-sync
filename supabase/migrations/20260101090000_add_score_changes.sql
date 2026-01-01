-- Migration: add audit log for score changes (undo/manual adjust)
-- Synced from docs/supabase/migrations/20260101090000_add_score_changes.sql

create table if not exists olympia.score_changes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references olympia.matches(id) on delete cascade,
  player_id uuid not null references olympia.match_players(id) on delete cascade,
  round_type text not null,

  requested_delta integer not null,
  applied_delta integer not null,
  points_before integer not null,
  points_after integer not null,

  source text not null default 'system',
  reason text,

  round_question_id uuid references olympia.round_questions(id) on delete set null,
  answer_id uuid references olympia.answers(id) on delete set null,

  revert_of uuid references olympia.score_changes(id) on delete set null,
  reverted_at timestamptz,
  reverted_by uuid references public.users(id) on delete set null,

  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_olympia_score_changes_match_created_at
  on olympia.score_changes (match_id, created_at desc);

create index if not exists idx_olympia_score_changes_match_revert
  on olympia.score_changes (match_id, revert_of, reverted_at);
