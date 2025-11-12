-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_name text,
  record_id text,
  action text,
  actor_id uuid,
  diff jsonb,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  grade_id uuid,
  name text NOT NULL UNIQUE,
  homeroom_teacher_id uuid,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT fk_classes_grade FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT fk_classes_teacher FOREIGN KEY (homeroom_teacher_id) REFERENCES public.users(id)
);
CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  record_id uuid,
  submitted_by uuid,
  handled_by uuid,
  status text CHECK (status = ANY (ARRAY['pending'::text, 'resolved'::text, 'rejected'::text])),
  content text NOT NULL,
  response text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT complaints_pkey PRIMARY KEY (id),
  CONSTRAINT fk_complaints_record FOREIGN KEY (record_id) REFERENCES public.records(id),
  CONSTRAINT fk_complaints_submitted_by FOREIGN KEY (submitted_by) REFERENCES public.users(id),
  CONSTRAINT fk_complaints_handled_by FOREIGN KEY (handled_by) REFERENCES public.users(id)
);
CREATE TABLE public.criteria (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text DEFAULT 'normal'::text CHECK (type = ANY (ARRAY['normal'::text, 'serious'::text, 'critical'::text])),
  score integer CHECK (score > 0),
  category text DEFAULT 'student'::text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  group text,
  subgroup text,
  CONSTRAINT criteria_pkey PRIMARY KEY (id)
);
CREATE TABLE public.grades (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT grades_pkey PRIMARY KEY (id)
);
CREATE TABLE public.permissions (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  scope text CHECK (scope = ANY (ARRAY['school'::text, 'class'::text])),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id uuid,
  student_id uuid,
  criteria_id uuid,
  score integer,
  note text,
  recorded_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  deleted_at timestamp without time zone,
  CONSTRAINT records_pkey PRIMARY KEY (id),
  CONSTRAINT fk_records_class FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT fk_records_student FOREIGN KEY (student_id) REFERENCES public.users(id),
  CONSTRAINT fk_records_criteria FOREIGN KEY (criteria_id) REFERENCES public.criteria(id),
  CONSTRAINT fk_records_recorded_by FOREIGN KEY (recorded_by) REFERENCES public.users(id)
);
CREATE TABLE public.user_profiles (
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  avatar_url text,
  phone_number text,
  address text,
  date_of_birth date,
  gender text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  user_name text UNIQUE,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id text NOT NULL,
  target text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT fk_user_roles_permission FOREIGN KEY (role_id) REFERENCES public.permissions(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_uid uuid NOT NULL UNIQUE,
  class_id uuid,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  user_name text UNIQUE,
  email text UNIQUE,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT fk_users_class FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT users_auth_uid_fkey FOREIGN KEY (auth_uid) REFERENCES auth.users(id)
);