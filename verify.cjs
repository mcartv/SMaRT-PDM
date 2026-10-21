'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||process.cwd();let passed=0;
const checks=[
 ['account create/edit selection', 'admin/backend/services/accountService.js',s=>s.includes('officeAccountAccessService')&&s.includes('rawPayload.permission_codes')&&s.includes('payload.permission_codes')],
 ['account read endpoint','admin/backend/routes/accountRoutes.js',s=>s.includes("'/access-options'")],
 ['global RBAC permission restrictions','admin/backend/services/rbacService.js',s=>s.includes('workspace_account_permission_denials')&&s.includes('NOT EXISTS')&&s.includes('assignment.is_active=TRUE')],
 ['workspace account permission denial','admin/backend/routes/workspaceRoutes.js',s=>s.includes('accountAccess.allowed(db,userId,roles.rows[0].role_id,permission)')],
 ['workspace office course restriction','admin/backend/routes/workspaceRoutes.js',s=>s.includes('workspaceScope.effective(db,userId,roles.rows[0].role_id)')],
 ['account office access preview','admin/frontend/src/pages/maintenance/AccountsPanel.jsx',s=>s.includes('OfficeAccessPreview')&&s.includes("setField('permission_codes'")],
 ['workspace scopes menu removed','admin/frontend/src/pages/maintenance/Maintenance.jsx',s=>!s.includes('WorkspaceScopesPanel')],
 ['access service active role verification','admin/backend/services/officeAccountAccessService.js',s=>s.includes('rbac_staff_role_catalog')&&s.includes('workspace_account_permission_denials')],
 ['office refresh on edits','admin/backend/services/officeService.js',s=>s.includes('officeAccountAccessService')&&s.includes('refreshOffice(client')],
 ['access course membership','admin/backend/services/officeAccountAccessService.js',s=>s.includes('a.office_id')&&s.includes('c.office_id=o.office_id')]
];
for(const [name,file,test] of checks){const p=path.join(root,file);let valid=false;try{valid=test(fs.readFileSync(p,'utf8'))}catch{}console.log((valid?'PASS ':'FAIL ')+name);if(valid)passed++;}
console.log(`${passed}/${checks.length} static checks passed`);if(passed!==checks.length)process.exitCode=1;
