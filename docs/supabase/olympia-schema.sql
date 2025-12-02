-- Olympia schema DDL (initial draft)
-- Run inside Supabase postgres; adjust permissions/RLS afterwards.

create schema if not exists olympia;

-- 1. Participants (link to main users)
create table if not exists olympia.participants (
  user_id uuid primary key references public.users(id) on delete cascade,
  contestant_code text unique,
  role text check (role in ('AD') or role is null),
  created_at timestamptz not null default now()
);

-- 2. Question bank (no tags table, fields follow Excel template)
create table if not exists olympia.questions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text,
  question_text text not null,
  answer_text text not null,
  note text,
  submitted_by text,
  source text,
  image_url text,
  audio_url text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Tournaments and matches
create table if not exists olympia.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text check (status in ('planned','active','archived') or status is null),
  created_at timestamptz not null default now()
);

create table if not exists olympia.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references olympia.tournaments(id) on delete set null,
  name text not null,
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','live','finished','cancelled')),
  host_user_id uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Rounds, players, question assignments
create table if not exists olympia.match_rounds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references olympia.matches(id) on delete cascade,
  round_type text not null check (round_type in ('khoi_dong','vcnv','tang_toc','ve_dich')),
  order_index smallint not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (match_id, round_type),
  unique (match_id, order_index)
);

create table if not exists olympia.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references olympia.matches(id) on delete cascade,
  participant_id uuid not null references olympia.participants(user_id) on delete cascade,
  seat_index smallint not null check (seat_index between 1 and 4),
  display_name text,
  is_disqualified_obstacle boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, seat_index),
  unique (match_id, participant_id)
);

create table if not exists olympia.round_questions (
  id uuid primary key default gen_random_uuid(),
  match_round_id uuid not null references olympia.match_rounds(id) on delete cascade,
  question_id uuid not null references olympia.questions(id) on delete restrict,
  order_index smallint not null,
  target_player_id uuid references olympia.match_players(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (match_round_id, order_index)
);

-- 5. Gameplay logs
create table if not exists olympia.answers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references olympia.matches(id) on delete cascade,
  match_round_id uuid not null references olympia.match_rounds(id) on delete cascade,
  round_question_id uuid not null references olympia.round_questions(id) on delete cascade,
  player_id uuid not null references olympia.match_players(id) on delete cascade,
  answer_text text,
  is_correct boolean,
  points_awarded integer default 0,
  response_time_ms integer,
  submitted_at timestamptz not null default now()
);

create table if not exists olympia.match_scores (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references olympia.matches(id) on delete cascade,
  player_id uuid not null references olympia.match_players(id) on delete cascade,
  round_type text not null,
  points integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (match_id, player_id, round_type)
);

create table if not exists olympia.buzzer_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references olympia.matches(id) on delete cascade,
  round_question_id uuid not null references olympia.round_questions(id) on delete cascade,
  player_id uuid references olympia.match_players(id) on delete cascade,
  event_type text not null default 'buzz',
  result text,
  occurred_at timestamptz not null default now()
);

create table if not exists olympia.star_uses (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references olympia.matches(id) on delete cascade,
  round_question_id uuid not null references olympia.round_questions(id) on delete cascade,
  player_id uuid not null references olympia.match_players(id) on delete cascade,
  outcome text,
  declared_at timestamptz not null default now(),
  unique (round_question_id, player_id)
);

create table if not exists olympia.obstacles (
  id uuid primary key default gen_random_uuid(),
  match_round_id uuid not null unique references olympia.match_rounds(id) on delete cascade,
  title text,
  final_keyword text not null,
  image_url text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists olympia.obstacle_tiles (
  id uuid primary key default gen_random_uuid(),
  obstacle_id uuid not null references olympia.obstacles(id) on delete cascade,
  round_question_id uuid references olympia.round_questions(id) on delete set null,
  position_index smallint not null,
  is_open boolean not null default false,
  unique (obstacle_id, position_index)
);

create table if not exists olympia.obstacle_guesses (
  id uuid primary key default gen_random_uuid(),
  obstacle_id uuid not null references olympia.obstacles(id) on delete cascade,
  player_id uuid not null references olympia.match_players(id) on delete cascade,
  guess_text text not null,
  is_correct boolean not null default false,
  attempt_order smallint,
  attempted_at timestamptz not null default now()
);

-- 6. Live session state (host-controlled runtime)
create table if not exists olympia.live_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references olympia.matches(id) on delete cascade,
  join_code text not null unique,
  status text not null default 'pending' check (status in ('pending','running','ended')),
  current_round_id uuid references olympia.match_rounds(id) on delete set null,
  current_round_type text,
  current_round_question_id uuid references olympia.round_questions(id) on delete set null,
  question_state text not null default 'hidden' check (question_state in ('hidden','showing','answer_revealed','completed')),
  timer_deadline timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
