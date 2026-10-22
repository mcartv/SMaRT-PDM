-- Run manually in Supabase SQL Editor. OSFA Coordinator grants are unchanged.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.rbac_permissions WHERE permission_code='settings.view') THEN
  RAISE EXCEPTION 'settings.view is missing. Apply the base RBAC schema first.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.rbac_role_groups WHERE group_code='ALL_STAFF') THEN
  RAISE EXCEPTION 'ALL_STAFF is missing. Apply the base RBAC role groups first.';
 END IF;
END $$;
INSERT INTO public.rbac_role_permissions(role_id,permission_id)
SELECT r.role_id,p.permission_id FROM public.rbac_roles r CROSS JOIN public.rbac_permissions p
WHERE r.role_scope='staff' AND r.role_code NOT IN ('admin','benefactor') AND p.permission_code='settings.view'
ON CONFLICT DO NOTHING;
-- This existing group enables authenticated self-service account endpoints.
INSERT INTO public.rbac_role_group_members(group_id,role_id)
SELECT g.group_id,r.role_id FROM public.rbac_role_groups g CROSS JOIN public.rbac_roles r
WHERE g.group_code='ALL_STAFF' AND r.role_scope='staff' AND r.role_code NOT IN ('admin','benefactor')
ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.default_staff_personal_settings() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.role_scope='staff' AND NEW.role_code NOT IN ('admin','benefactor') THEN
  INSERT INTO public.rbac_role_permissions(role_id,permission_id)
  SELECT NEW.role_id,permission_id FROM public.rbac_permissions WHERE permission_code='settings.view' ON CONFLICT DO NOTHING;
  INSERT INTO public.rbac_role_group_members(group_id,role_id)
  SELECT group_id,NEW.role_id FROM public.rbac_role_groups WHERE group_code='ALL_STAFF' ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS default_staff_personal_settings ON public.rbac_roles;
CREATE TRIGGER default_staff_personal_settings AFTER INSERT ON public.rbac_roles
FOR EACH ROW EXECUTE FUNCTION public.default_staff_personal_settings();
COMMIT;
-- Verify defaults; no settings.manage grant is added.
SELECT r.role_name,p.permission_code FROM public.rbac_roles r
JOIN public.rbac_role_permissions rp USING(role_id) JOIN public.rbac_permissions p USING(permission_id)
WHERE r.role_scope='staff' AND p.permission_code='settings.view' ORDER BY r.role_name;
