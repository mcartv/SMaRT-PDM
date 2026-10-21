-- REVIEW ONLY: run on smart-pdm-test after backup and approval, never auto-executed.
BEGIN;
CREATE TABLE IF NOT EXISTS public.workspace_account_permission_denials (
 user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
 role_id uuid NOT NULL REFERENCES public.rbac_roles(role_id) ON DELETE CASCADE,
 permission_id uuid NOT NULL REFERENCES public.rbac_permissions(permission_id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,role_id,permission_id)
);
REVOKE ALL ON public.workspace_account_permission_denials FROM PUBLIC,anon,authenticated;
ALTER TABLE public.workspace_account_permission_denials ENABLE ROW LEVEL SECURITY;
COMMIT;
