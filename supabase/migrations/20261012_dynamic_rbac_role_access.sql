-- SMaRT-PDM dynamic RBAC compatibility layer. Run once before deploying backend.
BEGIN;
CREATE TABLE IF NOT EXISTS public.rbac_role_portals (role_id uuid NOT NULL REFERENCES public.rbac_roles(role_id) ON DELETE CASCADE, portal_code text NOT NULL CHECK (portal_code IN ('admin','sdo','guidance','pd','ro_coordinator')), PRIMARY KEY(role_id,portal_code));
CREATE TABLE IF NOT EXISTS public.rbac_role_groups (group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_code text NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS public.rbac_role_group_members (group_id uuid NOT NULL REFERENCES public.rbac_role_groups(group_id) ON DELETE CASCADE,role_id uuid NOT NULL REFERENCES public.rbac_roles(role_id) ON DELETE CASCADE,PRIMARY KEY(group_id,role_id));
INSERT INTO public.rbac_role_groups(group_code) VALUES ('ALL_STAFF'),('ENDORSEMENT_STAFF'),('REPORT_STAFF'),('RO_COORDINATOR_CAPABLE'),('ADMIN_ONLY') ON CONFLICT DO NOTHING;
INSERT INTO public.rbac_role_portals(role_id,portal_code) SELECT role_id,role_code FROM public.rbac_roles WHERE role_code IN ('admin','sdo','guidance','pd','ro_coordinator') ON CONFLICT DO NOTHING;
INSERT INTO public.rbac_role_group_members(group_id,role_id) SELECT g.group_id,r.role_id FROM public.rbac_role_groups g CROSS JOIN public.rbac_roles r WHERE (g.group_code='ALL_STAFF' AND r.role_code IN ('admin','sdo','guidance','pd','ro_coordinator')) OR (g.group_code='ENDORSEMENT_STAFF' AND r.role_code IN ('admin','sdo','guidance','pd')) OR (g.group_code='REPORT_STAFF' AND r.role_code IN ('admin','sdo','guidance','pd','ro_coordinator')) OR (g.group_code='RO_COORDINATOR_CAPABLE' AND r.role_code IN ('sdo','guidance','pd','ro_coordinator')) OR (g.group_code='ADMIN_ONLY' AND r.role_code='admin') ON CONFLICT DO NOTHING;
COMMIT;
