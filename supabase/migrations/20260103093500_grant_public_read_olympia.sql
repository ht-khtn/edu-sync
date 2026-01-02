-- Allow public (anon) & authenticated read access for Olympia guest/MC views

-- Schema usage
GRANT USAGE ON SCHEMA olympia TO anon, authenticated;

-- Read-only access for guest/MC screens
GRANT SELECT ON TABLE
  olympia.matches,
  olympia.match_rounds,
  olympia.match_players,
  olympia.match_scores,
  olympia.live_sessions,
  olympia.round_questions,
  olympia.star_uses,
  olympia.buzzer_events,
  olympia.answers,
  olympia.obstacles,
  olympia.obstacle_tiles,
  olympia.obstacle_guesses
TO anon, authenticated;
