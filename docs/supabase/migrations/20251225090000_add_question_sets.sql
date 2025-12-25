-- Add Olympia question set support

create table if not exists olympia.question_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  original_filename text,
  item_count integer not null default 0,
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists olympia.question_set_items (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references olympia.question_sets(id) on delete cascade,
  order_index integer not null,
  code text not null,
  category text,
  question_text text not null,
  answer_text text not null,
  note text,
  submitted_by text,
  source text,
  image_url text,
  audio_url text,
  created_at timestamptz not null default now(),
  unique (question_set_id, code)
);

create index if not exists question_set_items_question_set_id_idx on olympia.question_set_items (question_set_id, order_index);

create table if not exists olympia.match_question_sets (
  match_id uuid not null references olympia.matches(id) on delete cascade,
  question_set_id uuid not null references olympia.question_sets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, question_set_id)
);
