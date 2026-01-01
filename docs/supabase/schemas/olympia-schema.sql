-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE olympia.answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  match_round_id uuid NOT NULL,
  round_question_id uuid NOT NULL,
  player_id uuid NOT NULL,
  answer_text text,
  is_correct boolean,
  points_awarded integer DEFAULT 0,
  response_time_ms integer,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT answers_pkey PRIMARY KEY (id),
  CONSTRAINT answers_match_id_fkey FOREIGN KEY (match_id) REFERENCES olympia.matches(id),
  CONSTRAINT answers_match_round_id_fkey FOREIGN KEY (match_round_id) REFERENCES olympia.match_rounds(id),
  CONSTRAINT answers_round_question_id_fkey FOREIGN KEY (round_question_id) REFERENCES olympia.round_questions(id),
  CONSTRAINT answers_player_id_fkey FOREIGN KEY (player_id) REFERENCES olympia.match_players(id)
);
CREATE TABLE olympia.buzzer_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  round_question_id uuid NOT NULL,
  player_id uuid,
  event_type text NOT NULL DEFAULT 'buzz'::text,
  result text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buzzer_events_pkey PRIMARY KEY (id),
  CONSTRAINT buzzer_events_match_id_fkey FOREIGN KEY (match_id) REFERENCES olympia.matches(id),
  CONSTRAINT buzzer_events_round_question_id_fkey FOREIGN KEY (round_question_id) REFERENCES olympia.round_questions(id),
  CONSTRAINT buzzer_events_player_id_fkey FOREIGN KEY (player_id) REFERENCES olympia.match_players(id)
);
CREATE TABLE olympia.live_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  join_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'ended'::text])),
  current_round_id uuid,
  current_round_type text,
  current_round_question_id uuid,
  question_state text NOT NULL DEFAULT 'hidden'::text CHECK (question_state = ANY (ARRAY['hidden'::text, 'showing'::text, 'answer_revealed'::text, 'completed'::text])),
  timer_deadline timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  player_password text,
  requires_player_password boolean NOT NULL DEFAULT true,
  mc_view_password text,
  CONSTRAINT live_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT live_sessions_match_id_fkey FOREIGN KEY (match_id) REFERENCES olympia.matches(id),
  CONSTRAINT live_sessions_current_round_id_fkey FOREIGN KEY (current_round_id) REFERENCES olympia.match_rounds(id),
  CONSTRAINT live_sessions_current_round_question_id_fkey FOREIGN KEY (current_round_question_id) REFERENCES olympia.round_questions(id),
  CONSTRAINT live_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE olympia.match_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  seat_index smallint NOT NULL CHECK (seat_index >= 1 AND seat_index <= 4),
  display_name text,
  is_disqualified_obstacle boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_players_pkey PRIMARY KEY (id),
  CONSTRAINT match_players_match_id_fkey FOREIGN KEY (match_id) REFERENCES olympia.matches(id),
  CONSTRAINT match_players_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES olympia.participants(user_id)
);
CREATE TABLE olympia.match_question_sets (
  match_id uuid NOT NULL,
  question_set_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_question_sets_pkey PRIMARY KEY (match_id, question_set_id),
  CONSTRAINT match_question_sets_match_id_fkey FOREIGN KEY (match_id) REFERENCES olympia.matches(id),
  CONSTRAINT match_question_sets_question_set_id_fkey FOREIGN KEY (question_set_id) REFERENCES olympia.question_sets(id)
);
CREATE TABLE olympia.match_rounds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  round_type text NOT NULL CHECK (round_type = ANY (ARRAY['khoi_dong'::text, 'vcnv'::text, 'tang_toc'::text, 've_dich'::text])),
  order_index smallint NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_rounds_pkey PRIMARY KEY (id),
  CONSTRAINT match_rounds_match_id_fkey FOREIGN KEY (match_id) REFERENCES olympia.matches(id)
);
CREATE TABLE olympia.match_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  player_id uuid NOT NULL,
  round_type text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_scores_pkey PRIMARY KEY (id),
  CONSTRAINT match_scores_match_id_fkey FOREIGN KEY (match_id) REFERENCES olympia.matches(id),
  CONSTRAINT match_scores_player_id_fkey FOREIGN KEY (player_id) REFERENCES olympia.match_players(id)
);
CREATE TABLE olympia.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid,
  name text NOT NULL,
  scheduled_at timestamp with time zone,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'live'::text, 'finished'::text, 'cancelled'::text])),
  host_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES olympia.tournaments(id),
  CONSTRAINT matches_host_user_id_fkey FOREIGN KEY (host_user_id) REFERENCES public.users(id)
);
CREATE TABLE olympia.obstacle_guesses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  obstacle_id uuid NOT NULL,
  player_id uuid NOT NULL,
  guess_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  attempt_order smallint,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT obstacle_guesses_pkey PRIMARY KEY (id),
  CONSTRAINT obstacle_guesses_obstacle_id_fkey FOREIGN KEY (obstacle_id) REFERENCES olympia.obstacles(id),
  CONSTRAINT obstacle_guesses_player_id_fkey FOREIGN KEY (player_id) REFERENCES olympia.match_players(id)
);
CREATE TABLE olympia.obstacle_tiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  obstacle_id uuid NOT NULL,
  round_question_id uuid,
  position_index smallint NOT NULL,
  is_open boolean NOT NULL DEFAULT false,
  CONSTRAINT obstacle_tiles_pkey PRIMARY KEY (id),
  CONSTRAINT obstacle_tiles_obstacle_id_fkey FOREIGN KEY (obstacle_id) REFERENCES olympia.obstacles(id),
  CONSTRAINT obstacle_tiles_round_question_id_fkey FOREIGN KEY (round_question_id) REFERENCES olympia.round_questions(id)
);
CREATE TABLE olympia.obstacles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_round_id uuid NOT NULL UNIQUE,
  title text,
  final_keyword text NOT NULL,
  image_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT obstacles_pkey PRIMARY KEY (id),
  CONSTRAINT obstacles_match_round_id_fkey FOREIGN KEY (match_round_id) REFERENCES olympia.match_rounds(id)
);
CREATE TABLE olympia.participants (
  user_id uuid NOT NULL,
  contestant_code text UNIQUE,
  role text CHECK (role = 'AD'::text OR role IS NULL),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT participants_pkey PRIMARY KEY (user_id),
  CONSTRAINT participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE olympia.question_set_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_set_id uuid NOT NULL,
  order_index integer NOT NULL,
  code text NOT NULL,
  category text,
  question_text text NOT NULL,
  answer_text text NOT NULL,
  note text,
  submitted_by text,
  source text,
  image_url text,
  audio_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT question_set_items_pkey PRIMARY KEY (id),
  CONSTRAINT question_set_items_question_set_id_fkey FOREIGN KEY (question_set_id) REFERENCES olympia.question_sets(id)
);
CREATE TABLE olympia.question_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  original_filename text,
  item_count integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT question_sets_pkey PRIMARY KEY (id),
  CONSTRAINT question_sets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);
CREATE TABLE olympia.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  category text,
  question_text text NOT NULL,
  answer_text text NOT NULL,
  note text,
  submitted_by text,
  source text,
  image_url text,
  audio_url text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE olympia.round_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_round_id uuid NOT NULL,
  question_id uuid NOT NULL,
  order_index smallint NOT NULL,
  target_player_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT round_questions_pkey PRIMARY KEY (id),
  CONSTRAINT round_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES olympia.questions(id),
  CONSTRAINT round_questions_target_player_id_fkey FOREIGN KEY (target_player_id) REFERENCES olympia.match_players(id),
  CONSTRAINT round_questions_match_round_id_fkey FOREIGN KEY (match_round_id) REFERENCES olympia.match_rounds(id)
);
CREATE TABLE olympia.score_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  player_id uuid NOT NULL,
  round_type text NOT NULL,
  requested_delta integer NOT NULL,
  applied_delta integer NOT NULL,
  points_before integer NOT NULL,
  points_after integer NOT NULL,
  source text NOT NULL DEFAULT 'system'::text,
  reason text,
  round_question_id uuid,
  answer_id uuid,
  revert_of uuid,
  reverted_at timestamp with time zone,
  reverted_by uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT score_changes_pkey PRIMARY KEY (id),
  CONSTRAINT score_changes_match_id_fkey FOREIGN KEY (match_id) REFERENCES olympia.matches(id),
  CONSTRAINT score_changes_player_id_fkey FOREIGN KEY (player_id) REFERENCES olympia.match_players(id),
  CONSTRAINT score_changes_round_question_id_fkey FOREIGN KEY (round_question_id) REFERENCES olympia.round_questions(id),
  CONSTRAINT score_changes_answer_id_fkey FOREIGN KEY (answer_id) REFERENCES olympia.answers(id),
  CONSTRAINT score_changes_revert_of_fkey FOREIGN KEY (revert_of) REFERENCES olympia.score_changes(id),
  CONSTRAINT score_changes_reverted_by_fkey FOREIGN KEY (reverted_by) REFERENCES public.users(id),
  CONSTRAINT score_changes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE olympia.session_password_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  player_password_hash text NOT NULL,
  mc_view_password_hash text NOT NULL,
  generated_by uuid,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_current boolean DEFAULT true,
  player_password_plain text NOT NULL,
  mc_password_plain text NOT NULL,
  CONSTRAINT session_password_history_pkey PRIMARY KEY (id),
  CONSTRAINT session_password_history_session_id_fkey FOREIGN KEY (session_id) REFERENCES olympia.live_sessions(id),
  CONSTRAINT session_password_history_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id)
);
CREATE TABLE olympia.session_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  verified_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '24:00:00'::interval),
  CONSTRAINT session_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT session_verifications_session_id_fkey FOREIGN KEY (session_id) REFERENCES olympia.live_sessions(id),
  CONSTRAINT session_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE olympia.star_uses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  round_question_id uuid NOT NULL,
  player_id uuid NOT NULL,
  outcome text,
  declared_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT star_uses_pkey PRIMARY KEY (id),
  CONSTRAINT star_uses_match_id_fkey FOREIGN KEY (match_id) REFERENCES olympia.matches(id),
  CONSTRAINT star_uses_round_question_id_fkey FOREIGN KEY (round_question_id) REFERENCES olympia.round_questions(id),
  CONSTRAINT star_uses_player_id_fkey FOREIGN KEY (player_id) REFERENCES olympia.match_players(id)
);
CREATE TABLE olympia.tournaments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  status text CHECK ((status = ANY (ARRAY['planned'::text, 'active'::text, 'archived'::text])) OR status IS NULL),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tournaments_pkey PRIMARY KEY (id)
);