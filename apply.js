'use strict';
// Checked, all-or-nothing patcher. --check is default. No SQL or network access.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.argv.slice(2).find(s=>!s.startsWith('--'))||process.cwd();
const apply=process.argv.includes('--apply');
const base=__dirname;
const expectedShas=Object.freeze({
 'admin/backend/services/accountService.js':'a5e839773cdaf9f23a6f8bcf73b3f91303057650',
 'admin/backend/routes/accountRoutes.js':'171dea3ae1b59f5566e22340264e15eccc6953ad',
 'admin/backend/routes/workspaceRoutes.js':'45f0ccd497678d73751ce452712caa2e271310ca',
 'admin/backend/services/officeService.js':'a497449b74319930304ba37711d4fc5f4162ecf7',
 'admin/backend/services/rbacService.js':'3b4d67552045ef32e725b5d3fd92fbd001556e46',
 'admin/frontend/src/pages/maintenance/Maintenance.jsx':'9e5630aaa167b7c3ff20e072c8eca632e9ae9ad8',
 'admin/frontend/src/pages/maintenance/AccountsPanel.jsx':'e46cb7063e0c1895ccd03e3e3ea6a076f0a038fd'
});
const edits=[];
function fail(s){throw new Error('STOPPED: '+s)}
function edit(file,fn){const target=path.join(root,file);if(!fs.existsSync(target))fail('missing '+file);const original=fs.readFileSync(target,'utf8');const blob=crypto.createHash('sha1').update('blob '+Buffer.byteLength(original)+'\0').update(original).digest('hex');if(blob!==expectedShas[file])fail('source revision differs from reviewed GitHub: '+file+'; no files changed');const revised=fn(original);if(revised===original)fail('nothing changed '+file);edits.push({target,original,revised});}
function replaceOnce(s,from,to,label){const parts=s.split(from);if(parts.length!==2)fail(label+': expected once; found '+(parts.length-1));return parts.join(to)}
try{
 const marker='OFFICE_ACCOUNT_AUTOLINK_V1';
 edit('admin/backend/services/accountService.js',s=>{
  if(s.includes(marker))fail('account service already patched');
  s=replaceOnce(s,"        if (selectedOffice) await setAccountOffice(client,user.user_id,selectedOffice);",`        if (selectedOffice) await setAccountOffice(client,user.user_id,selectedOffice);
        // ${marker}: atomic automatic assignments and account-specific permission choices.
        await require('./officeAccountAccessService').autoAssign(client,user.user_id,role);
        if(rawPayload.permission_codes!==undefined)await require('./officeAccountAccessService').saveSelections(client,user.user_id,role,rawPayload.permission_codes);`,'create office assignment');
  s=replaceOnce(s,"        if (selectedOffice) await setAccountOffice(client,userId,selectedOffice);",`        if (selectedOffice) await setAccountOffice(client,userId,selectedOffice);
        // ${marker}: reflect new role/office and preserve account-specific permission choices.
        await require('./officeAccountAccessService').autoAssign(client,userId,nextRole);
        if(payload.permission_codes!==undefined && !nextIsArchived)await require('./officeAccountAccessService').saveSelections(client,userId,nextRole,payload.permission_codes);`,'update office assignment');
  return s;
 });
 edit('admin/backend/routes/accountRoutes.js',s=>{
  if(s.includes(marker))fail('account routes already patched');
  const route=`// ${marker}: role permissions available for one account. Read only.\nrouter.get('/access-options', protect, authorizeRoles('admin'), requirePermission('accounts.view'), async(req,res)=>{\n try {\n  const code=String(req.query.role||'');\n  if(!/^[a-z0-9_]{1,90}$/.test(code))return res.status(400).json({error:'Choose a valid role.'});\n  const id=req.query.user_id?String(req.query.user_id):null;\n  if(id&&!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Invalid account.'});\n  const result=await require('../services/officeAccountAccessService').choices(require('../config/db'),code,id);\n  res.set('Cache-Control','no-store').json(result);\n }catch(e){console.error('[Account access options]',e.message);res.status(e.status||503).json({error:e.status?e.message:'Permissions are temporarily unavailable.'});}\n});\n`;
  return replaceOnce(s,'module.exports = router;',route+'\nmodule.exports = router;','account routes export');
 });
 edit('admin/backend/services/rbacService.js',s=>{
  if(s.includes(marker))fail('rbac service already patched');
  s=replaceOnce(s,"     AND r.is_active = TRUE AND r.role_scope = 'staff'",`     AND r.is_active = TRUE AND r.role_scope = 'staff'
     AND NOT EXISTS (
       SELECT 1 FROM public.workspace_account_permission_denials d
       JOIN public.rbac_user_roles assignment ON assignment.user_id=d.user_id
            AND assignment.role_id=d.role_id AND assignment.is_active=TRUE
       JOIN public.rbac_roles active_role ON active_role.role_id=d.role_id AND active_role.is_active=TRUE
       WHERE d.user_id=ur.user_id AND d.permission_id=p.permission_id
     ) /* ${marker} */`,'global per-account permission deny');
  return s;
 });
 edit('admin/backend/routes/workspaceRoutes.js',s=>{
  if(s.includes(marker))fail('workspace routes already patched');
  s=replaceOnce(s,"const workspaceScope=require('../services/workspaceScopeService');",`const workspaceScope=require('../services/workspaceScopeService');\nconst accountAccess=require('../services/officeAccountAccessService'); // ${marker}`,'workspace import');
  s=replaceOnce(s,"permissions:permissions.rows.map(x=>x.permission_code)","permissions:(await Promise.all(permissions.rows.map(async x=>({code:x.permission_code,permitted:await accountAccess.allowed(db,userId,roles.rows[0].role_id,x.permission_code)})))).filter(x=>x.permitted).map(x=>x.code)",'workspace me permissions');
  s=replaceOnce(s,"  const scoped=await workspaceScope.effective(db,userId,roles.rows[0].role_id);",`  // ${marker}: permissions are role grants minus this account's explicit removals.\n  if(!await accountAccess.allowed(db,userId,roles.rows[0].role_id,permission))return res.status(403).json({message:'This account does not have permission.'});\n  // Office assignments are automatically maintained; retain the existing four-way gate.\n  const scoped=await workspaceScope.effective(db,userId,roles.rows[0].role_id);`,'workspace scope lookup');
  return s;
 });
 edit('admin/backend/services/officeService.js',s=>{
   if(s.includes(marker))fail('office service already patched');
   const needle='        // Only an explicitly selected eligible Dean receives the supplemental Dean role.';
   return replaceOnce(s,needle,`        // ${marker}: keep access in sync with current office courses.
        await require('./officeAccountAccessService').refreshOffice(client, office.office_id);
        // Updates affecting course transfers also refresh prior owning offices.
        if (id) await require('./officeAccountAccessService').refreshOffice(client,id);
        for (const old of new Set(selected.rows.map(c=>c.office_id).filter(Boolean)))
          await require('./officeAccountAccessService').refreshOffice(client,old);
`+needle,'office save refresh');
 });
 edit('admin/frontend/src/pages/maintenance/Maintenance.jsx',s=>{
  if(s.includes(marker))fail('maintenance already patched');
  s=replaceOnce(s,"import WorkspaceScopesPanel from './WorkspaceScopesPanel'; // PHASE6D2B_WORKSPACE_SCOPE_UI_V1\n",'', 'scope import');
  s=replaceOnce(s,"  { key: 'workspace-scopes', label: 'Workspace Scopes', icon: UsersRound },\n",'','scope tab');
  s=replaceOnce(s,"      case 'workspace-scopes':\n        return <WorkspaceScopesPanel />;\n\n",'','scope render');
  return '// '+marker+'\n'+s;
 });
 edit('admin/frontend/src/pages/maintenance/AccountsPanel.jsx',s=>{
  if(s.includes(marker))fail('accounts panel already patched');
  // Self-contained access chooser: edits account draft, the backend validates all permissions.
  const component=`// ${marker}: no extra scope-management screen needed.\nfunction OfficeAccessPreview({form, courses, setField, disabled=false, accountId=null}) {\n  const isCustom=String(form.role||'').startsWith('custom_');\n  const [catalog,setCatalog]=useState(null);\n  const [busy,setBusy]=useState(false);\n  const [error,setError]=useState('');\n  useEffect(()=>{\n    if(!isCustom){setCatalog(null);return;}\n    let cancelled=false;setBusy(true);setCatalog(null);setError('');\n    const p=new URLSearchParams({role:form.role});if(accountId)p.set('user_id',String(accountId));\n    fetch(buildApiUrl('/api/accounts/access-options?'+p),{headers:{Authorization:'Bearer '+(sessionStorage.getItem('adminToken')||'')},cache:'no-store'})\n      .then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Unable to load permissions');return data;})\n      .then(data=>{if(cancelled)return;setCatalog(data);setField('permission_codes',data.allowed||[]);})\n      .catch(e=>{if(!cancelled)setError(e.message)})\n      .finally(()=>{if(!cancelled)setBusy(false)});\n    return()=>{cancelled=true};\n  },[isCustom,form.role,accountId]);\n  if(!isCustom)return null;\n  const matched=courses.filter(c=>c.office_name===form.department&&!c.is_archived);\n  const selected=new Set(form.permission_codes||[]);\n  return <section className=\"mt-3 rounded-lg border border-stone-200 p-3 space-y-2\">\n    <p className=\"text-sm font-semibold\">Office courses and access</p>\n    <p className=\"text-xs text-stone-600\">{matched.length?matched.map(c=>c.course_code||c.course_name).join(', '):'No active courses are assigned to this office.'} Courses follow the office automatically.</p>\n    <p className=\"text-sm font-semibold\">Available permissions</p>\n    {busy?<p className=\"text-xs\">Loading permissions…</p>:error?<p role=\"alert\" className=\"text-xs text-red-700\">{error}</p>:(catalog?.permissions||[]).map(p=><label key={p.permission_id} className=\"flex gap-2 items-center text-sm\"><input type=\"checkbox\" disabled={disabled} checked={selected.has(p.permission_code)} onChange={e=>setField('permission_codes',e.target.checked?[...selected,p.permission_code]:[...selected].filter(x=>x!==p.permission_code))}/>{(p.permission_code.split('.')[1]||'Access').replaceAll('_',' ')+' '+(p.permission_code.split('.')[0]||'').replaceAll('_',' ')}</label>)}\n    {!matched.length&&<p className=\"text-xs text-amber-700\">Application records will stay unavailable until this office has courses.</p>}\n  </section>;\n}\n\n`;
  s=replaceOnce(s,'// AccountCreateModal: handles account create modal for the Accounts flow.',component+'// AccountCreateModal: handles account create modal for the Accounts flow.','create component anchor');
  // Insert before existing PD-only course assignment on create; this retains built-in PD behavior.
  s=replaceOnce(s,'                    <CourseAssignmentField\n                        form={form}',`                    <OfficeAccessPreview form={form} courses={courses} setField={setField} disabled={saving} />\n                    <CourseAssignmentField\n                        form={form}`,'create preview');
  // Edit form has its own setField and account id.
  s=replaceOnce(s,"                    {form.role === 'pd' ? (\n                        <div className=\"mt-3\">",`                    <OfficeAccessPreview form={form} courses={courses} setField={setField} disabled={saving} accountId={currentUserId} />\n                    {form.role === 'pd' ? (\n                        <div className=\"mt-3\">`,'edit preview');
  return s;
 });
 const target=path.join(root,'admin/backend/services/officeAccountAccessService.js');
 if(fs.existsSync(target))fail('access service already exists; manual review required');
 edits.push({target,original:null,revised:fs.readFileSync(path.join(base,'officeAccountAccessService.js'),'utf8')});
 console.log('VALIDATED: '+edits.length+' files; no SQL run; no live data changed.');
 if(apply){
   const written=[];
   try {
     for(const e of edits){
       fs.mkdirSync(path.dirname(e.target),{recursive:true});
       const backup=e.target+'.office-account-before.bak';
       if(e.original!==null){if(fs.existsSync(backup))fail('backup exists; do not overwrite '+backup);fs.writeFileSync(backup,e.original);}
       const temp=e.target+'.office-account-tmp';
       fs.writeFileSync(temp,e.revised);fs.renameSync(temp,e.target);
       written.push(e);
     }
   }catch(error){
     for(const e of written.reverse()){
       if(e.original===null)fs.rmSync(e.target,{force:true});else fs.writeFileSync(e.target,e.original);
     }
     throw error;
   }
   console.log('APPLIED: '+edits.length+' files. Database migration must be reviewed separately.');
 }
 else console.log('CHECK ONLY: use --apply after reviewing migration and backups.');
}catch(e){console.error(e.message);process.exitCode=1;}
