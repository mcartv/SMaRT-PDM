-- SMARTPDM_SEMESTER_AUTO_V1: operational schedule only; no existing cycle data modified.
CREATE TABLE IF NOT EXISTS public.academic_semester_schedules (
 period_id uuid PRIMARY KEY REFERENCES public.academic_period(period_id) ON DELETE CASCADE,
 start_date date NOT NULL,
 end_date date NOT NULL,
 auto_enabled boolean NOT NULL DEFAULT false,
 last_error text,
 last_attempt_at timestamptz,
 last_transition_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT academic_semester_date_order CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS academic_semester_schedules_due_idx ON public.academic_semester_schedules(auto_enabled,start_date,end_date);
