-- MANUAL REVIEW ONLY. No application startup code executes this migration.
BEGIN;
ALTER TABLE public.ref_offices ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
-- Existing records have no reliable creation timestamp: do not invent one.
ALTER TABLE public.ref_offices ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.ref_offices ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.ref_offices ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.ref_offices ALTER COLUMN updated_at SET DEFAULT now();
-- Preserve the existing portal identity when a Dean position replaces its label,
-- including while all account roles are disabled during archival.
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS institutional_primary_role text;
CREATE INDEX IF NOT EXISTS academic_course_office_id_idx ON public.academic_course(office_id);

CREATE TABLE IF NOT EXISTS public.office_leadership_position_rules (
    leadership_kind text NOT NULL CHECK (leadership_kind IN ('dean')),
    position_id uuid NOT NULL REFERENCES public.ref_staff_positions(position_id),
    PRIMARY KEY (leadership_kind,position_id)
);
-- Approved rule: Dean requires the Dean position; no automatic user promotion.
INSERT INTO public.ref_staff_positions(position_name,is_active)
SELECT 'Dean',true WHERE NOT EXISTS (
    SELECT 1 FROM public.ref_staff_positions WHERE lower(btrim(position_name))='dean'
);
INSERT INTO public.office_leadership_position_rules(leadership_kind,position_id)
SELECT 'dean',position_id FROM public.ref_staff_positions WHERE lower(btrim(position_name))='dean'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.office_academic_leaders (
    office_id uuid NOT NULL REFERENCES public.ref_offices(office_id),
    leadership_kind text NOT NULL CHECK (leadership_kind IN ('dean')),
    user_id uuid NOT NULL REFERENCES public.admin_profiles(user_id),
    assigned_by_user_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (office_id,leadership_kind)
);
CREATE INDEX IF NOT EXISTS office_academic_leaders_user_idx ON public.office_academic_leaders(user_id);
-- Supplemental role: deliberately no portal catalog entry and no permission grants.
INSERT INTO public.rbac_roles(role_code,role_name,role_scope,is_active)
SELECT 'dean','Dean','staff',true WHERE NOT EXISTS(SELECT 1 FROM public.rbac_roles WHERE role_code='dean');
CREATE TABLE IF NOT EXISTS public.office_dean_role_grants (
    user_id uuid PRIMARY KEY REFERENCES public.users(user_id),
    role_id uuid NOT NULL REFERENCES public.rbac_roles(role_id)
);
CREATE TABLE IF NOT EXISTS public.institutional_service_area_links (
    department_id uuid PRIMARY KEY REFERENCES public.ro_departments(department_id),
    office_id uuid NOT NULL UNIQUE REFERENCES public.ref_offices(office_id),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_dean_role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_service_area_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_dean_role_grants,public.institutional_service_area_links FROM anon,authenticated;
ALTER TABLE public.office_leadership_position_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_academic_leaders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_leadership_position_rules,public.office_academic_leaders FROM anon,authenticated;
-- Only the permission-protected backend PostgreSQL connection manages these tables.
CREATE INDEX IF NOT EXISTS audit_logs_office_history_idx
    ON public.audit_logs(entity_id,"timestamp" DESC) WHERE entity_type='ref_offices';
COMMIT;

-- Post-application verification (read only):
SELECT to_regclass('public.office_academic_leaders') AS leadership_table,
       to_regclass('public.office_leadership_position_rules') AS eligibility_table;
