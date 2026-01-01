-- Synced from docs/supabase/migrations/20251225090000_add_question_sets.sql

create table if not exists olympia.question_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  item_count integer not null default 0,
  original_filename text,
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists olympia.question_set_items (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references olympia.question_sets(id) on delete cascade,
  question_id uuid not null references olympia.questions(id) on delete cascade,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  unique (question_set_id, question_id)
);

alter table if exists olympia.matches
  add column if not exists question_set_ids uuid[] not null default '{}'::uuid[];
