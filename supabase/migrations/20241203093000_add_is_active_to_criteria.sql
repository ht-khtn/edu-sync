-- Synced from docs/supabase/migrations/20241203093000_add_is_active_to_criteria.sql

alter table if exists olympia.criteria
  add column if not exists is_active boolean not null default true;
