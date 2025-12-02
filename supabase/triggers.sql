-- Audit table + trigger function for EduSync
-- This file creates a simple audit_logs table (if missing) and a trigger function
-- that attempts to capture the acting user via auth.uid() when available (i.e. when
-- statements are executed with the user's JWT). For operations performed with the
-- service_role key (server) the trigger will record NULL actor; use Edge Functions
-- to perform writes that must include an explicit actor.

-- Create audit logs table if not exists
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text,
  record_id text,
  action text,
  actor_id uuid,
  diff jsonb,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Audit trigger function: tries to use auth.uid() but does not fail if not available
CREATE OR REPLACE FUNCTION public.fn_audit_log() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor uuid;
  v_payload jsonb;
  v_record_id text;
BEGIN
  -- Try to get the current authenticated user id via auth.uid(); if not available, leave NULL
  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN others THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_payload := to_jsonb(OLD);
    -- Derive a best-effort record id from common id-like fields to support tables
    -- that don't use a generic `id` column (for example `user_profiles.user_id`).
    v_record_id := COALESCE(
      to_jsonb(OLD)->>'id',
      to_jsonb(OLD)->>'user_id',
      to_jsonb(OLD)->>'record_id'
    );
    INSERT INTO public.audit_logs(table_name, record_id, action, actor_id, diff, created_at)
    VALUES (TG_TABLE_NAME, v_record_id, TG_OP, v_actor, v_payload, now());
    RETURN OLD;
  ELSE
    v_payload := to_jsonb(NEW);
    v_record_id := COALESCE(
      to_jsonb(NEW)->>'id',
      to_jsonb(NEW)->>'user_id',
      to_jsonb(NEW)->>'record_id'
    );
    INSERT INTO public.audit_logs(table_name, record_id, action, actor_id, diff, created_at)
    VALUES (TG_TABLE_NAME, v_record_id, TG_OP, v_actor, v_payload, now());
    RETURN NEW;
  END IF;
END;
$$;

-- Attach triggers to core tables: records, complaints, user_profiles, users, classes
DO $$
 
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_audit'
   THEN
    CREATE TRIGGER trg_users_audit
      AFTER INSERT OR UPDATE OR DELETE ON public.users
      FOR EACH ROW EXECUTE PROCEDURE public.fn_audit_log();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_classes_audit'
  ) THEN
    CREATE TRIGGER trg_classes_audit
      AFTER INSERT OR UPDATE OR DELETE ON public.classes
      FOR EACH ROW EXECUTE PROCEDURE public.fn_audit_log();
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- Sync: create user_profiles when a public.users row is inserted
-- (kept in the auth.users sync section)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_user_profile_on_user_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name, created_at, updated_at)
  VALUES (NEW.id, '', now(), now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_create_user_profile_after_insert') THEN
    CREATE TRIGGER trg_create_user_profile_after_insert
      AFTER INSERT ON public.users
      FOR EACH ROW EXECUTE PROCEDURE public.create_user_profile_on_user_insert();
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- Sync: create user_profiles when a public.users row is inserted
-- -----------------------------------------------------------------------------

-- Function: create a minimal user_profiles row for every new public.users row
-- (moved to the auth.users sync section below)
 
 

-- -----------------------------------------------------------------------------
-- Notifications: create table + policies + trigger on records insert
-- Sends in-app notifications to the affected student and homeroom teacher
-- -----------------------------------------------------------------------------

-- Table for in-app notifications (addressed by auth user id for simple RLS)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  receiver_auth_uid uuid NOT NULL REFERENCES auth.users(id),
  actor_user_id uuid NULL REFERENCES public.users(id),
  record_id uuid NULL REFERENCES public.records(id),
  title text,
  body text,
  payload jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: users can select and update only their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='select_own_notifications'
  ) THEN
    CREATE POLICY select_own_notifications ON public.notifications
      FOR SELECT USING (receiver_auth_uid = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='update_own_notifications'
  ) THEN
    CREATE POLICY update_own_notifications ON public.notifications
      FOR UPDATE USING (receiver_auth_uid = auth.uid());
  END IF;

  -- Allow inserts via triggers: rows can be inserted for any receiver
  -- We keep SELECT/UPDATE restricted to the receiver via policies above.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='insert_notifications_any'
  ) THEN
    CREATE POLICY insert_notifications_any ON public.notifications
      FOR INSERT WITH CHECK (true);
  END IF;
END$$;

-- Trigger function: when a record is inserted, notify student and homeroom teacher
CREATE OR REPLACE FUNCTION public.fn_notify_on_record_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_auth uuid;
  v_teacher_auth uuid;
  v_criteria_name text;
  v_class_name text;
  v_actor uuid;
BEGIN
  -- try resolve actor via auth.uid(); may be null on service role
  BEGIN v_actor := auth.uid(); EXCEPTION WHEN others THEN v_actor := NULL; END;

  -- Resolve student auth uid
  IF NEW.student_id IS NOT NULL THEN
    SELECT u.auth_uid INTO v_student_auth FROM public.users u WHERE u.id = NEW.student_id LIMIT 1;
  END IF;
  -- Resolve homeroom teacher auth uid
  IF NEW.class_id IS NOT NULL THEN
    SELECT c.name, t.auth_uid INTO v_class_name, v_teacher_auth
    FROM public.classes c
    LEFT JOIN public.users t ON t.id = c.homeroom_teacher_id
    WHERE c.id = NEW.class_id;
  END IF;

  -- Resolve criteria name (best-effort)
  IF NEW.criteria_id IS NOT NULL THEN
    SELECT name INTO v_criteria_name FROM public.criteria WHERE id = NEW.criteria_id;
  END IF;

  -- Build body
  IF v_criteria_name IS NULL THEN v_criteria_name := 'Vi phạm'; END IF;
  IF v_class_name IS NULL THEN v_class_name := 'Lớp'; END IF;

  -- Student notification
  IF v_student_auth IS NOT NULL THEN
    INSERT INTO public.notifications(receiver_auth_uid, actor_user_id, record_id, title, body, payload)
    VALUES (
      v_student_auth,
      NEW.recorded_by,
      NEW.id,
      'Ghi nhận vi phạm',
      format('%s - %s (%s điểm)', v_class_name, v_criteria_name, NEW.score),
      jsonb_build_object('class_id', NEW.class_id, 'student_id', NEW.student_id, 'criteria_id', NEW.criteria_id)
    );
  END IF;

  -- Homeroom teacher notification
  IF v_teacher_auth IS NOT NULL THEN
    INSERT INTO public.notifications(receiver_auth_uid, actor_user_id, record_id, title, body, payload)
    VALUES (
      v_teacher_auth,
      NEW.recorded_by,
      NEW.id,
      'Lớp có ghi nhận mới',
      format('%s - %s (%s điểm)', v_class_name, v_criteria_name, NEW.score),
      jsonb_build_object('class_id', NEW.class_id, 'student_id', NEW.student_id, 'criteria_id', NEW.criteria_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_records_notify_insert') THEN
    CREATE TRIGGER trg_records_notify_insert
      AFTER INSERT ON public.records
      FOR EACH ROW EXECUTE PROCEDURE public.fn_notify_on_record_insert();
  END IF;
END$$;

-- NOTE: When performing writes from server code (service role key) auth.uid() will be NULL.
-- To record the real actor for server-side operations, call the Edge Function below which
-- performs the DB write using the service role key AND also inserts an explicit audit row
-- with the actor_id supplied by the caller. See `edge-functions/record-ops/index.ts`.

-- -----------------------------------------------------------------------------
-- Sync auth.users -> public.users triggers
-- Creates a public.users row when a new auth.user is created, deletes it when
-- the auth.user is removed, and keeps public.user_profiles.email in sync when
-- the auth.users.email changes.
-- -----------------------------------------------------------------------------


-- Function: create public.users row when auth user is created
CREATE OR REPLACE FUNCTION public.fn_auth_user_created() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_err text;
  v_sqlstate text;
BEGIN
  BEGIN
    -- Insert a corresponding row in public.users with a new uuid id and link via auth_uid
  INSERT INTO public.users(id, auth_uid, created_at, updated_at)
  VALUES (gen_random_uuid(), NEW.id::text, now(), now())
    ON CONFLICT (auth_uid) DO NOTHING;
  EXCEPTION WHEN others THEN
    -- Capture native error and SQLSTATE for diagnostics
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    v_err := SQLERRM;
    -- Attempt to record the sync failure to public.audit_logs, but don't let
    -- any failure here block the original auth operation. If audit insert
    -- itself fails, just emit a NOTICE.
    BEGIN
      INSERT INTO public.audit_logs(table_name, record_id, action, actor_id, diff, meta, created_at)
      VALUES (
        'auth.users',
        NEW.id::text,
        'auth_user_created_sync_error',
        NULL,
        jsonb_build_object('error', v_err, 'sqlstate', v_sqlstate, 'new', to_jsonb(NEW)),
        jsonb_build_object('function', 'fn_auth_user_created'),
        now()
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE '[fn_auth_user_created] audit insert failed: %', SQLERRM;
    END;
    -- Also emit a short notice for immediate debugging
    RAISE NOTICE '[fn_auth_user_created] sync failed: % (SQLSTATE=%)', v_err, v_sqlstate;
  END;

  RETURN NEW;
END;
$$;

-- Function: remove public.users row when auth user is deleted
CREATE OR REPLACE FUNCTION public.fn_auth_user_deleted() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_err text;
  v_sqlstate text;
BEGIN
  BEGIN
  DELETE FROM public.users WHERE auth_uid = OLD.id::text;
  EXCEPTION WHEN others THEN
    -- Capture native error and SQLSTATE
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    v_err := SQLERRM;
    -- Attempt to record the sync failure to public.audit_logs, but don't let
    -- any failure here block the original auth operation. If audit insert
    -- itself fails, just emit a NOTICE.
    BEGIN
      INSERT INTO public.audit_logs(table_name, record_id, action, actor_id, diff, meta, created_at)
      VALUES (
        'auth.users',
        OLD.id::text,
        'auth_user_deleted_sync_error',
        NULL,
        jsonb_build_object('error', v_err, 'sqlstate', v_sqlstate, 'old', to_jsonb(OLD)),
        jsonb_build_object('function', 'fn_auth_user_deleted'),
        now()
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE '[fn_auth_user_deleted] audit insert failed: %', SQLERRM;
    END;
    RAISE NOTICE '[fn_auth_user_deleted] sync failed: % (SQLSTATE=%)', v_err, v_sqlstate;
  END;

  RETURN OLD;
END;
$$;

-- Function: sync email from auth.users -> public.user_profiles when changed
CREATE OR REPLACE FUNCTION public.fn_auth_user_updated() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_err text;
  v_sqlstate text;
BEGIN
  -- Only react when email actually changed
  BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
  SELECT id INTO v_user_id FROM public.users WHERE auth_uid = NEW.id::text LIMIT 1;
      IF v_user_id IS NOT NULL THEN
        -- Upsert into user_profiles to keep email in sync
        INSERT INTO public.user_profiles(user_id, full_name, email, created_at, updated_at)
        VALUES (v_user_id, COALESCE(NEW.user_metadata->>'full_name', ''), NEW.email, now(), now())
        ON CONFLICT (user_id) DO UPDATE
        SET email = EXCLUDED.email,
            updated_at = now();
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    -- Capture native error and SQLSTATE
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    v_err := SQLERRM;
    -- Attempt to record the sync failure to public.audit_logs, but don't let
    -- any failure here block the original auth operation. If audit insert
    -- itself fails, just emit a NOTICE.
    BEGIN
      INSERT INTO public.audit_logs(table_name, record_id, action, actor_id, diff, meta, created_at)
      VALUES (
        'auth.users',
        COALESCE(NEW.id, OLD.id)::text,
        'auth_user_updated_sync_error',
        NULL,
        jsonb_build_object('error', v_err, 'sqlstate', v_sqlstate, 'old', to_jsonb(OLD), 'new', to_jsonb(NEW)),
        jsonb_build_object('function', 'fn_auth_user_updated'),
        now()
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE '[fn_auth_user_updated] audit insert failed: %', SQLERRM;
    END;
    RAISE NOTICE '[fn_auth_user_updated] sync failed: % (SQLSTATE=%)', v_err, v_sqlstate;
  END;

  RETURN NEW;
END;
$$;

-- Create triggers on auth.users if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auth_users_created') THEN
    CREATE TRIGGER trg_auth_users_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.fn_auth_user_created();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auth_users_deleted') THEN
    CREATE TRIGGER trg_auth_users_deleted
      AFTER DELETE ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.fn_auth_user_deleted();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auth_users_updated') THEN
    CREATE TRIGGER trg_auth_users_updated
      AFTER UPDATE OF email ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.fn_auth_user_updated();
  END IF;
END$$;

