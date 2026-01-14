-- Olympia realtime events: single low-payload stream filtered by match_id
-- Mục tiêu:
-- - Không broadcast full row (chỉ payload cần thiết)
-- - Gom DB write + realtime signal trong 1 transaction (trigger AFTER write)
-- - Client chỉ subscribe 1 table (realtime_events) theo match_id/join_code

CREATE TABLE IF NOT EXISTS olympia.realtime_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  session_id uuid,
  entity text NOT NULL,
  entity_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT realtime_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS realtime_events_match_id_created_at_idx
  ON olympia.realtime_events (match_id, created_at DESC);

CREATE INDEX IF NOT EXISTS realtime_events_session_id_created_at_idx
  ON olympia.realtime_events (session_id, created_at DESC);

-- Cho guest/MC views đọc stream realtime
GRANT SELECT ON TABLE olympia.realtime_events TO anon, authenticated;

-- Best-effort: add vào publication realtime nếu tồn tại
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE olympia.realtime_events';
EXCEPTION
  WHEN undefined_object THEN
    -- publication không tồn tại trong project này
    NULL;
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Emit helpers
CREATE OR REPLACE FUNCTION olympia.emit_realtime_event_live_sessions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  row_session_id uuid;
  row_match_id uuid;
  et text;
  payload jsonb;
BEGIN
  et := TG_OP;

  IF (TG_OP = 'DELETE') THEN
    row_session_id := OLD.id;
    row_match_id := OLD.match_id;
    payload := jsonb_build_object(
      'id', OLD.id,
      'status', OLD.status,
      'joinCode', OLD.join_code,
      'questionState', OLD.question_state,
      'currentRoundId', OLD.current_round_id,
      'currentRoundType', OLD.current_round_type,
      'currentRoundQuestionId', OLD.current_round_question_id,
      'timerDeadline', OLD.timer_deadline,
      'buzzerEnabled', OLD.buzzer_enabled,
      'showScoreboardOverlay', OLD.show_scoreboard_overlay,
      'showAnswersOverlay', OLD.show_answers_overlay,
      'guestMediaControl', OLD.guest_media_control
    );
  ELSE
    row_session_id := NEW.id;
    row_match_id := NEW.match_id;
    payload := jsonb_build_object(
      'id', NEW.id,
      'status', NEW.status,
      'joinCode', NEW.join_code,
      'questionState', NEW.question_state,
      'currentRoundId', NEW.current_round_id,
      'currentRoundType', NEW.current_round_type,
      'currentRoundQuestionId', NEW.current_round_question_id,
      'timerDeadline', NEW.timer_deadline,
      'buzzerEnabled', NEW.buzzer_enabled,
      'showScoreboardOverlay', NEW.show_scoreboard_overlay,
      'showAnswersOverlay', NEW.show_answers_overlay,
      'guestMediaControl', NEW.guest_media_control
    );
  END IF;

  INSERT INTO olympia.realtime_events (
    match_id,
    session_id,
    entity,
    entity_id,
    event_type,
    payload
  ) VALUES (
    row_match_id,
    row_session_id,
    'live_sessions',
    row_session_id,
    et,
    payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION olympia.emit_realtime_event_match_scores()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  et text;
  payload jsonb;
BEGIN
  et := TG_OP;

  IF (TG_OP = 'DELETE') THEN
    payload := jsonb_build_object(
      'id', OLD.id,
      'playerId', OLD.player_id,
      'roundType', OLD.round_type,
      'points', OLD.points
    );

    INSERT INTO olympia.realtime_events (match_id, entity, entity_id, event_type, payload)
    VALUES (OLD.match_id, 'match_scores', OLD.id, et, payload);

    RETURN OLD;
  END IF;

  payload := jsonb_build_object(
    'id', NEW.id,
    'playerId', NEW.player_id,
    'roundType', NEW.round_type,
    'points', NEW.points
  );

  INSERT INTO olympia.realtime_events (match_id, entity, entity_id, event_type, payload)
  VALUES (NEW.match_id, 'match_scores', NEW.id, et, payload);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION olympia.emit_realtime_event_answers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  et text;
  payload jsonb;
BEGIN
  et := TG_OP;

  IF (TG_OP = 'DELETE') THEN
    payload := jsonb_build_object(
      'id', OLD.id,
      'roundQuestionId', OLD.round_question_id,
      'playerId', OLD.player_id,
      'answerText', OLD.answer_text,
      'isCorrect', OLD.is_correct,
      'pointsAwarded', OLD.points_awarded,
      'submittedAt', OLD.submitted_at,
      'responseTimeMs', OLD.response_time_ms
    );

    INSERT INTO olympia.realtime_events (match_id, entity, entity_id, event_type, payload)
    VALUES (OLD.match_id, 'answers', OLD.id, et, payload);

    RETURN OLD;
  END IF;

  payload := jsonb_build_object(
    'id', NEW.id,
    'roundQuestionId', NEW.round_question_id,
    'playerId', NEW.player_id,
    'answerText', NEW.answer_text,
    'isCorrect', NEW.is_correct,
    'pointsAwarded', NEW.points_awarded,
    'submittedAt', NEW.submitted_at,
    'responseTimeMs', NEW.response_time_ms
  );

  INSERT INTO olympia.realtime_events (match_id, entity, entity_id, event_type, payload)
  VALUES (NEW.match_id, 'answers', NEW.id, et, payload);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION olympia.emit_realtime_event_buzzer_events()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  et text;
  payload jsonb;
BEGIN
  et := TG_OP;

  IF (TG_OP = 'DELETE') THEN
    payload := jsonb_build_object(
      'id', OLD.id,
      'roundQuestionId', OLD.round_question_id,
      'playerId', OLD.player_id,
      'eventType', OLD.event_type,
      'result', OLD.result,
      'occurredAt', OLD.occurred_at
    );

    INSERT INTO olympia.realtime_events (match_id, entity, entity_id, event_type, payload)
    VALUES (OLD.match_id, 'buzzer_events', OLD.id, et, payload);

    RETURN OLD;
  END IF;

  payload := jsonb_build_object(
    'id', NEW.id,
    'roundQuestionId', NEW.round_question_id,
    'playerId', NEW.player_id,
    'eventType', NEW.event_type,
    'result', NEW.result,
    'occurredAt', NEW.occurred_at
  );

  INSERT INTO olympia.realtime_events (match_id, entity, entity_id, event_type, payload)
  VALUES (NEW.match_id, 'buzzer_events', NEW.id, et, payload);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION olympia.emit_realtime_event_star_uses()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  et text;
  payload jsonb;
BEGIN
  et := TG_OP;

  IF (TG_OP = 'DELETE') THEN
    payload := jsonb_build_object(
      'id', OLD.id,
      'roundQuestionId', OLD.round_question_id,
      'playerId', OLD.player_id,
      'outcome', OLD.outcome,
      'declaredAt', OLD.declared_at
    );

    INSERT INTO olympia.realtime_events (match_id, entity, entity_id, event_type, payload)
    VALUES (OLD.match_id, 'star_uses', OLD.id, et, payload);

    RETURN OLD;
  END IF;

  payload := jsonb_build_object(
    'id', NEW.id,
    'roundQuestionId', NEW.round_question_id,
    'playerId', NEW.player_id,
    'outcome', NEW.outcome,
    'declaredAt', NEW.declared_at
  );

  INSERT INTO olympia.realtime_events (match_id, entity, entity_id, event_type, payload)
  VALUES (NEW.match_id, 'star_uses', NEW.id, et, payload);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION olympia.emit_realtime_event_matches()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  et text;
  payload jsonb;
  row_match_id uuid;
BEGIN
  et := TG_OP;

  IF (TG_OP = 'DELETE') THEN
    row_match_id := OLD.id;
    payload := jsonb_build_object(
      'id', OLD.id,
      'status', OLD.status,
      'scheduledAt', OLD.scheduled_at
    );
  ELSE
    row_match_id := NEW.id;
    payload := jsonb_build_object(
      'id', NEW.id,
      'status', NEW.status,
      'scheduledAt', NEW.scheduled_at
    );
  END IF;

  INSERT INTO olympia.realtime_events (match_id, entity, entity_id, event_type, payload)
  VALUES (row_match_id, 'matches', row_match_id, et, payload);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers
DROP TRIGGER IF EXISTS trg_emit_realtime_live_sessions ON olympia.live_sessions;
CREATE TRIGGER trg_emit_realtime_live_sessions
AFTER INSERT OR UPDATE OR DELETE ON olympia.live_sessions
FOR EACH ROW EXECUTE FUNCTION olympia.emit_realtime_event_live_sessions();

DROP TRIGGER IF EXISTS trg_emit_realtime_match_scores ON olympia.match_scores;
CREATE TRIGGER trg_emit_realtime_match_scores
AFTER INSERT OR UPDATE OR DELETE ON olympia.match_scores
FOR EACH ROW EXECUTE FUNCTION olympia.emit_realtime_event_match_scores();

DROP TRIGGER IF EXISTS trg_emit_realtime_answers ON olympia.answers;
CREATE TRIGGER trg_emit_realtime_answers
AFTER INSERT OR UPDATE OR DELETE ON olympia.answers
FOR EACH ROW EXECUTE FUNCTION olympia.emit_realtime_event_answers();

DROP TRIGGER IF EXISTS trg_emit_realtime_buzzer_events ON olympia.buzzer_events;
CREATE TRIGGER trg_emit_realtime_buzzer_events
AFTER INSERT OR UPDATE OR DELETE ON olympia.buzzer_events
FOR EACH ROW EXECUTE FUNCTION olympia.emit_realtime_event_buzzer_events();

DROP TRIGGER IF EXISTS trg_emit_realtime_star_uses ON olympia.star_uses;
CREATE TRIGGER trg_emit_realtime_star_uses
AFTER INSERT OR UPDATE OR DELETE ON olympia.star_uses
FOR EACH ROW EXECUTE FUNCTION olympia.emit_realtime_event_star_uses();

DROP TRIGGER IF EXISTS trg_emit_realtime_matches ON olympia.matches;
CREATE TRIGGER trg_emit_realtime_matches
AFTER INSERT OR UPDATE OR DELETE ON olympia.matches
FOR EACH ROW EXECUTE FUNCTION olympia.emit_realtime_event_matches();
