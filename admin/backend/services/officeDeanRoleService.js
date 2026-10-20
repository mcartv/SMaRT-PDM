'use strict';
// Dean is a supplemental organizational role, never a portal or administrator role.
async function grantDean(client, userId) {
    await client.query(`UPDATE public.admin_profiles a SET institutional_primary_role=(
        SELECT CASE r.role_code WHEN 'gco' THEN 'guidance' WHEN 'ro_personnel' THEN 'ro_coordinator' ELSE r.role_code END
        FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.role_id=ur.role_id
        WHERE ur.user_id=a.user_id AND ur.is_active=true AND r.is_active=true AND r.role_scope='staff' AND r.role_code<>'dean'
        ORDER BY CASE WHEN r.role_code='admin' THEN 1 ELSE 0 END,r.role_code LIMIT 1)
        WHERE a.user_id=$1 AND a.institutional_primary_role IS NULL`, [userId]);
    await client.query(`WITH granted AS (
        INSERT INTO public.rbac_user_roles(user_id,role_id,is_active)
        SELECT $1,role_id,true FROM public.rbac_roles WHERE role_code='dean' AND is_active=true
        AND EXISTS(SELECT 1 FROM public.admin_profiles a JOIN public.ref_staff_positions p ON p.position_id=a.position_id
            WHERE a.user_id=$1 AND COALESCE(a.is_archived,false)=false AND p.is_active=true AND lower(btrim(p.position_name))='dean')
        ON CONFLICT(user_id,role_id) DO UPDATE SET is_active=true
        WHERE rbac_user_roles.is_active=false RETURNING user_id,role_id
    ) INSERT INTO public.office_dean_role_grants(user_id,role_id)
      SELECT user_id,role_id FROM granted ON CONFLICT DO NOTHING`, [userId]);
}
async function revokeUnusedDean(client) {
    await client.query(`UPDATE public.rbac_user_roles ur SET is_active=false
        FROM public.office_dean_role_grants managed WHERE ur.user_id=managed.user_id AND ur.role_id=managed.role_id
        AND NOT EXISTS(SELECT 1 FROM public.office_academic_leaders l
          JOIN public.ref_offices o ON o.office_id=l.office_id
          WHERE l.user_id=managed.user_id AND l.leadership_kind='dean' AND o.is_active=true)`);
    await client.query(`DELETE FROM public.office_dean_role_grants managed
        WHERE NOT EXISTS(SELECT 1 FROM public.office_academic_leaders l JOIN public.ref_offices o ON o.office_id=l.office_id
          WHERE l.user_id=managed.user_id AND l.leadership_kind='dean' AND o.is_active=true)`);
}
module.exports = { grantDean, revokeUnusedDean };
