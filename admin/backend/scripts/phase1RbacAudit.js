'use strict';
// PHASE1_RBAC_AUDIT_20261021. Run from admin/backend with: node scripts/phase1RbacAudit.js
// Strictly read-only. Uses the application's existing configured PostgreSQL pool.
const db = require('../config/db');
const queries = [
  ['role_inventory', `SELECT r.role_code,r.role_name,r.role_scope,r.is_active,c.app_role_code,c.db_user_role,c.is_active AS catalog_active,(SELECT count(*)::int FROM public.rbac_role_permissions rp WHERE rp.role_id=r.role_id) AS permissions,(SELECT count(*)::int FROM public.rbac_user_roles ur WHERE ur.role_id=r.role_id AND ur.is_active) AS active_assignments FROM public.rbac_roles r LEFT JOIN public.rbac_staff_role_catalog c ON c.role_id=r.role_id ORDER BY r.role_scope,r.role_code`],
  ['orphan_assignments', `SELECT count(*)::int AS count FROM public.rbac_user_roles ur LEFT JOIN public.users u ON u.user_id=ur.user_id LEFT JOIN public.rbac_roles r ON r.role_id=ur.role_id WHERE u.user_id IS NULL OR r.role_id IS NULL`],
  ['inactive_role_active_assignments', `SELECT count(*)::int AS count FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.role_id=ur.role_id WHERE ur.is_active AND NOT r.is_active`],
  ['invalid_active_catalog', `SELECT count(*)::int AS count FROM public.rbac_staff_role_catalog c JOIN public.rbac_roles r ON r.role_id=c.role_id WHERE c.is_active AND (NOT r.is_active OR r.role_scope<>'staff')`],
  ['admin_safety', `SELECT (SELECT count(*)::int FROM public.rbac_roles WHERE role_code='admin' AND role_scope='staff' AND is_active) AS active_roles,(SELECT count(*)::int FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.role_id=ur.role_id WHERE r.role_code='admin' AND ur.is_active AND r.is_active) AS active_assignments`],
  ['user_role_backing', `SELECT u.role AS legacy_user_role,count(*)::int AS accounts FROM public.users u JOIN public.admin_profiles ap ON ap.user_id=u.user_id GROUP BY u.role ORDER BY u.role`],
];
async function main() {
  const report={phase:1,read_only:true,checks:{},warnings:[],failures:[]};
  try {
    for(const [key,sql] of queries){const result=await db.query(sql);report.checks[key]=result.rows;}
    for(const key of ['orphan_assignments','inactive_role_active_assignments','invalid_active_catalog']){
      if(Number(report.checks[key][0]?.count||0)>0) report.warnings.push(`${key}: review records before Phase 2`);
    }
    const admin=report.checks.admin_safety[0];
    if(!admin||admin.active_roles!==1||admin.active_assignments<1)report.failures.push('Missing active administrator role or assignments');
    const catalog=(report.checks.role_inventory||[]).filter(x=>x.catalog_active);
    if(catalog.length<1)report.failures.push('No active catalog roles found; halt migration');
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    if(report.failures.length)process.exitCode=2;
  }catch(err){process.stderr.write('Phase 1 audit failed: '+err.message+'\n');process.exitCode=1;}
  finally { if(typeof db.end==='function') await db.end(); }
}
main();
