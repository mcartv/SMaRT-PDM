-- Part 1: OSFA Coordinator display name.
-- Prepared against smart_pdm_test (twehxvixkfgtbaohnnon).
-- Run manually in the Supabase SQL Editor. Safe to run again.
-- Keeps role_id, role_code, account assignments, and permission grants intact.
BEGIN;

UPDATE public.rbac_roles
SET role_name = 'OSFA Coordinator'
WHERE role_code = 'admin' AND role_scope = 'staff';

SELECT role_code, role_name, role_scope, is_active
FROM public.rbac_roles
WHERE role_code = 'admin';

COMMIT;
