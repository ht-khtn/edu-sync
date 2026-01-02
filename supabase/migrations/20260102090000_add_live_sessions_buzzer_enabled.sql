alter table olympia.live_sessions
  add column if not exists buzzer_enabled boolean not null default true;
