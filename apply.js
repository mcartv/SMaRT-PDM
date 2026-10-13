'use strict';
// SMaRT-PDM role UX improvements. No Supabase writes; local patch only.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const root=path.resolve(process.argv[2]||'.');const check=process.argv.includes('--check');
const relative='admin/frontend/src/pages/maintenance/RBACPanel.jsx';const target=path.join(root,relative);
if(!fs.existsSync(target)){console.error('Missing '+target);process.exit(1)}
let src=fs.readFileSync(target,'utf8');const marker='SMARTPDM_RBAC_UX_POLISH_20261013_V1';
if(src.includes(marker)){console.log('Already installed');process.exit(0)}
function swap(from,to,label){if(!src.includes(from))throw Error('Anchor not found ('+label+'); no files changed');src=src.replace(from,to)}
try{
swap("import { ShieldCheck, RefreshCw, Plus, Save } from 'lucide-react';", "import { ShieldCheck, RefreshCw, Plus, Save, Search, X } from 'lucide-react';",'icons');
swap("const [createOpen,setCreateOpen]=useState(false),[draftPermissions,setDraftPermissions]=useState([]);",`const [createOpen,setCreateOpen]=useState(false),[draftPermissions,setDraftPermissions]=useState([]);
 const [permissionSearch,setPermissionSearch]=useState(''),[createPermissionSearch,setCreatePermissionSearch]=useState('');
 const [showArchived,setShowArchived]=useState(false);
 const [dialog,setDialog]=useState(null); // {title,message,kind,submit?,initial?,onSave?}
 const [dialogValue,setDialogValue]=useState('');
 const [notice,setNotice]=useState(null);
 function showNotice(message,kind='success'){setNotice({message,kind})}
 function confirmChange(title,message,run){setDialog({title,message,kind:'confirm',run})}
 // ${marker}`,'state');
swap("const sortedRolePermissions = useMemo(() => [...(data?.permissions || [])].sort((a,b) => {", "const sortedRolePermissions = useMemo(() => [...(data?.permissions || [])].filter(p=>!permissionSearch.trim() || (formatPermissionLabel(p.permission_code)+' '+p.permission_code+' '+(p.description||'')).toLowerCase().includes(permissionSearch.trim().toLowerCase())).sort((a,b) => {",'search filtering');
swap("}), [data?.permissions, grants]);", "}), [data?.permissions, grants, permissionSearch]);",'search dependencies');
swap("setCreateOpen(false);setName('');setDraftPermissions([]);", "setCreateOpen(false);setName('');setDraftPermissions([]);setCreatePermissionSearch('');showNotice('Role and permissions saved successfully.');",'creation result');
// Scope error-feedback replacement to createRoleWithPermissions, not formatting-sensitive whitespace.
const createStart=src.indexOf('async function createRoleWithPermissions()');
const changeStart=src.indexOf('async function change(',createStart);
if(createStart<0||changeStart<0)throw Error('Cannot locate role-creation boundaries; no files changed');
let createBlock=src.slice(createStart,changeStart);
const createError=/\}catch\s*\(e\)\s*\{\s*setError\(e\.message\)\s*\}\s*finally\s*\{\s*setBusy\(false\)\s*\}/;
if(!createError.test(createBlock))throw Error('Cannot locate role-creation error handling; no files changed');
createBlock=createBlock.replace(createError,"}catch(e){showNotice(e.message,'error')}finally{setBusy(false)}");
src=src.slice(0,createStart)+createBlock+src.slice(changeStart);
// Match only the single-line handler. The preceding function's whitespace can vary.
const oldChange = src.match(/async function change\(path,method,payload\)\{[^\r\n]*window\.confirm\([^\r\n]*\}/);
if (!oldChange) throw Error('Cannot locate old change handler (change workflow); no files changed. The local RBACPanel may differ.');
swap(oldChange[0], `async function applyChange(path,method,payload){setBusy(true);setError('');try{await request(path,{method,body:JSON.stringify(payload)});await reload();showNotice('Changes saved successfully.')}catch(e){showNotice(e.message,'error')}finally{setBusy(false)}}
  function change(path,method,payload){confirmChange('Confirm RBAC change','This change may immediately affect user access. Do you want to continue?',()=>applyChange(path,method,payload))}
  function editRole(r){setDialogValue(r.role_name);setDialog({kind:'edit',title:'Edit Role',message:'Update the name of this role.',run:value=>applyChange('/roles/'+r.role_id,'PATCH',{role_name:value.trim()})})}`, 'change workflow');
swap("<div className=\"mt-2 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2\">{(data?.permissions||[]).map(p=>", `<div className="relative mt-2"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-stone-400"/><input aria-label="Search new role permissions" placeholder="Search permissions..." value={createPermissionSearch} onChange={e=>setCreatePermissionSearch(e.target.value)} className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"/></div>
         <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{(data?.permissions||[]).filter(p=>(formatPermissionLabel(p.permission_code)+' '+p.permission_code+' '+(p.description||'')).toLowerCase().includes(createPermissionSearch.trim().toLowerCase())).map(p=>`,'modal search');
swap("<div className=\"flex justify-end\"><button type=\"button\" onClick={()=>{setName('');setDraftPermissions([]);setCreateOpen(true)}}", `<div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Show archived roles</label><button type="button" onClick={()=>{setName('');setDraftPermissions([]);setCreatePermissionSearch('');setCreateOpen(true)}}`,'archive toggle');
swap("(data.roles||[]).filter(r=>r.role_scope==='staff'&&r.role_code!=='benefactor').map(r=>", "(data.roles||[]).filter(r=>r.role_scope==='staff'&&r.role_code!=='benefactor'&&(showArchived||r.is_active)).map(r=>",'archive filter');
swap("onClick={()=>{const value=window.prompt('Role name',r.role_name);if(value&&value.trim()!==r.role_name)change('/roles/'+r.role_id,'PATCH',{role_name:value.trim()})}}", "onClick={()=>editRole(r)}",'edit dialog');
swap("<p className=\"text-xs font-medium text-[#704b35]\">Granted permissions are listed first and highlighted in brown.</p>", `<div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-[#704b35]">Granted permissions are listed first and highlighted in brown.</p><div className="relative min-w-56 flex-1 sm:max-w-xs"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-stone-400"/><input aria-label="Search role permissions" placeholder="Search permissions..." value={permissionSearch} onChange={e=>setPermissionSearch(e.target.value)} className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"/></div></div>`, 'role permissions search');
swap("{sortedRolePermissions.map(p=><label", "{sortedRolePermissions.length===0?<p className=\"text-sm text-stone-500\">No matching permissions.</p>:null}{sortedRolePermissions.map(p=><label",'no results');
swap("  return <div className=\"space-y-4\">", `  return <div className="space-y-4">
   {notice?<div role="status" className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 className="font-semibold text-lg">{notice.kind==='error'?'Unable to complete action':'Success'}</h3><p className="mt-2 text-sm text-stone-600">{notice.message}</p><div className="mt-5 flex justify-end"><button autoFocus onClick={()=>setNotice(null)} className="rounded-lg bg-stone-800 px-5 py-2 text-white">OK</button></div></div></div>:null}
   {dialog?<div role="dialog" aria-modal="true" aria-label={dialog.title} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{dialog.title}</h3><button aria-label="Close dialog" onClick={()=>setDialog(null)}><X size={20}/></button></div><p className="mt-2 text-sm text-stone-600">{dialog.message}</p>{dialog.kind==='edit'?<input autoFocus aria-label="Role name" value={dialogValue} maxLength={80} onChange={e=>setDialogValue(e.target.value)} className="mt-4 w-full rounded-lg border p-2"/>:null}<div className="mt-6 flex justify-end gap-2"><button disabled={busy} onClick={()=>setDialog(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy||(dialog.kind==='edit'&&dialogValue.trim().length<3)} onClick={()=>{const action=dialog.run;const value=dialogValue;setDialog(null);action(value)}} className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white">{dialog.kind==='edit'?'Save Changes':'Confirm'}</button></div></div></div>:null}`, 'dialogs');
// Check without editing actual source: create temp stub and ask parser to check JSX using esbuild if installed.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smartpdm-rbac-ui-'));const temp=path.join(dir,'RBACPanel.jsx');fs.writeFileSync(temp,src); 
console.log('Anchors matched. '+(check?'CHECK ONLY':'Patch prepared')+'; file length '+src.length);
if(!check){const backup=target+'.rbac-ui-'+Date.now()+'.bak';fs.copyFileSync(target,backup);fs.writeFileSync(target,src);console.log('Updated '+relative+'; backup '+backup)}
fs.rmSync(dir,{recursive:true,force:true});
}catch(e){console.error(e.message);process.exit(1)}
