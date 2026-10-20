// SMARTPDM_RBAC_COMPACT_UI_20261013_SELECTOR_SAFE_V2
// SMARTPDM_RBAC_MIGRATION_20261013_V1
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import { ShieldCheck, RefreshCw, Plus, Save, Search, X } from 'lucide-react';
import { buildApiUrl } from '@/api';
import AccountsPanel from './AccountsPanel';
import { MAINTENANCE_CARD_TITLE_CLASS,MAINTENANCE_CARD_SUBTITLE_CLASS } from './components/maintenanceTypography';
// Friendly labels are presentation-only. API/database codes are never changed.
const SPECIAL_PERMISSION_LABELS = Object.freeze({
  'endorsements.review_pd': 'Review Endorsements (Program Director)',
  'endorsements.review_gco': 'Review Endorsements (Guidance)',
  'endorsements.review_sdo': 'Review Endorsements (Student Discipline)',
  'payouts.review_proofs': 'Review Payment Proofs',
  'ro.settings_manage': 'Manage Community Service Settings',
});
const PERMISSION_ACTIONS = Object.freeze({
  view: 'View', create: 'Create', update: 'Edit', manage: 'Manage', archive: 'Archive',
  assign: 'Assign', validate: 'Verify', review: 'Review', generate: 'Generate',
  finalize: 'Finalize', settings_manage: 'Manage Settings', review_proofs: 'Review Proofs',
  review_pd: 'Review as Program Director', review_gco: 'Review as Guidance',
  review_sdo: 'Review as Student Discipline Officer',
});
const PERMISSION_SUBJECTS = Object.freeze({
  accounts: 'User Accounts', announcements: 'Announcements', applications: 'Applications',
  audit: 'System Logs', courses: 'Courses', discipline: 'Discipline Records',
  documents: 'Documents', endorsements: 'Endorsements', payouts: 'Payouts',
  programs: 'Scholarship Programs', reports: 'Reports', ro: 'Community Service',
  settings: 'System Settings', students: 'Students',
});
function formatPermissionLabel(code) {
  if (SPECIAL_PERMISSION_LABELS[code]) return SPECIAL_PERMISSION_LABELS[code];
  const [subject, ...actionParts] = String(code || '').split('.');
  const action = actionParts.join('.');
  const noun = PERMISSION_SUBJECTS[subject] || subject.replaceAll('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  const verb = PERMISSION_ACTIONS[action] || action.replaceAll('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  return verb + ' ' + noun;
}

const tabs=[['accounts','User Accounts'],['roles','Roles'],['permissions','Role Permissions']];
export default function RBACPanel(){
 const [capabilities,setCapabilities]=useState(null);
 const [eligibleUsers,setEligibleUsers]=useState([]);
 const [selectedUser,setSelectedUser]=useState(''); // SMARTPDM_CONSOLIDATED_ROLE_ASSIGNMENTS_V1

 const [tab,setTab]=useState('accounts'),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[role,setRole]=useState('');
 // SMARTPDM_ATOMIC_CREATE_ROLE_MODAL_V1
 // SMARTPDM_ROLES_TABLE_UX_20261013_V1
 // SMARTPDM_FIVE_ROLE_UI_SIMPLIFY_V1: fixed-role display; no archived/active selector.
 const [roleSearch,setRoleSearch]=useState('');
 const [roleAction,setRoleAction]=useState(null);
 const [roleActionName,setRoleActionName]=useState('');
 const [roleActionBusy,setRoleActionBusy]=useState(false);
 const [roleActionFeedback,setRoleActionFeedback]=useState(null);
 const [permissionSearch,setPermissionSearch]=useState('');
 const [dialog,setDialog]=useState(null); // {title,message,kind,submit?,initial?,onSave?}
 const [dialogValue,setDialogValue]=useState('');
 const [notice,setNotice]=useState(null);
 function showNotice(message,kind='success'){setNotice({message,kind})}
 function confirmChange(title,message,run){setDialog({title,message,kind:'confirm',run})}
 // SMARTPDM_RBAC_UX_POLISH_20261013_V3
 const request=useCallback(async(path,init={})=>{const res=await fetch(buildApiUrl('/api/rbac-management'+path),{...init,headers:{Authorization:`Bearer ${sessionStorage.getItem('adminToken')||''}`,'Content-Type':'application/json',...(init.headers||{})}});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||`Request failed (${res.status})`);return body;},[]);
 const reload=useCallback(async()=>{setError('');try{const [overview,access]=await Promise.all([request('/overview'),request('/capabilities')]);setData(overview);setCapabilities(access);const usersResponse=await request('/eligible-users');setEligibleUsers(usersResponse.users||[])}catch(e){setError(e.message)}},[request]);
 useEffect(()=>{if(tab!=='accounts')reload()},[tab,reload]);
 useEffect(()=>{const refresh=()=>{if(tab!=='accounts')reload()};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh)},[tab,reload]);
 const userRoles=(data?.roles||[]).filter(r=>r.role_scope==='staff'&&r.role_code!=='benefactor');
 const selected=userRoles.find(r=>r.role_id===role)||userRoles[0];
 const grants=useMemo(()=>new Set((data?.rolePermissions||[]).filter(x=>x.role_id===selected?.role_id).map(x=>x.permission_code)),[data,selected]);
 // Granted permissions appear first. Sorting is display-only; grants and codes are unchanged.
 const sortedRolePermissions = useMemo(() => [...(data?.permissions || [])].filter(p=>!permissionSearch.trim() || (formatPermissionLabel(p.permission_code)+' '+p.permission_code+' '+(p.description||'')).toLowerCase().includes(permissionSearch.trim().toLowerCase())).sort((a,b) => {
  const aGranted = grants.has(a.permission_code) ? 1 : 0;
  const bGranted = grants.has(b.permission_code) ? 1 : 0;
  if(aGranted !== bGranted) return bGranted - aGranted;
  const label = p => typeof formatPermissionLabel === 'function' ? formatPermissionLabel(p.permission_code) : p.permission_code;
  return label(a).localeCompare(label(b));
 }), [data?.permissions, grants, permissionSearch]);
 const visibleRoles=(data?.roles||[]).filter(r=>r.role_scope==='staff'&&r.role_code!=='benefactor')
  .filter(r=>r.role_name.toLowerCase().includes(roleSearch.trim().toLowerCase()));
 const roleGrantCounts=new Map();
 for(const x of data?.rolePermissions||[])roleGrantCounts.set(x.role_id,(roleGrantCounts.get(x.role_id)||0)+1);
 async function submitRoleAction(){
  if(!roleAction||roleActionBusy)return;
  const {role:target,mode}=roleAction;
  if(mode==='edit' && (roleActionName.trim().length<3||roleActionName.trim().length>80))return;
  setRoleActionBusy(true);
  try{
   const route=mode==='edit'?'/roles/'+target.role_id:'/roles/'+target.role_id+'/status';
   const method=mode==='edit'?'PATCH':'PATCH';
   const payload=mode==='edit'?{role_name:roleActionName.trim()}:{is_active:mode==='restore'};
   await request(route,{method,body:JSON.stringify(payload)});
   await reload();
   setRoleAction(null);
   setRoleActionFeedback({success:true,message:mode==='edit'?'Role updated successfully.':mode==='restore'?'Role restored successfully.':'Role archived successfully.'});
  }catch(e){setRoleActionFeedback({success:false,message:e.message})}finally{setRoleActionBusy(false)}
 }

 // Account roles and permissions are managed here; user records remain under User Accounts.
 async function applyChange(path,method,payload){setBusy(true);setError('');try{await request(path,{method,body:JSON.stringify(payload)});await reload();showNotice('Changes saved successfully.')}catch(e){showNotice(e.message,'error')}finally{setBusy(false)}}
  function change(path,method,payload){confirmChange('Confirm RBAC change','This change may immediately affect user access. Do you want to continue?',()=>applyChange(path,method,payload))}
 return <div className="space-y-3">
   {roleAction?<div role="dialog" aria-modal="true" aria-label={roleAction.mode==='edit'?'Edit role':'Confirm role action'} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-bold text-stone-900">{roleAction.mode==='edit'?'Edit Role':roleAction.mode==='archive'?'Archive Role':'Restore Role'}</h3><p className="mt-2 text-sm text-stone-600">{roleAction.mode==='edit'?'Change the display name of this role.':roleAction.mode==='archive'?'Archiving this role stops it from granting access.':'Restore this role and its configured grants?'} </p>{roleAction.mode==='edit'?<label className="mt-4 block text-sm font-semibold">Role name<input autoFocus value={roleActionName} maxLength={80} onChange={e=>setRoleActionName(e.target.value)} className="mt-2 w-full rounded-xl border p-3 text-sm"/></label>:<p className="mt-4 rounded-xl bg-stone-50 p-3 text-sm font-semibold">{roleAction.role.role_name}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" disabled={roleActionBusy} onClick={()=>setRoleAction(null)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button type="button" disabled={roleActionBusy||(roleAction.mode==='edit'&&roleActionName.trim().length<3)} onClick={submitRoleAction} className="rounded-xl bg-[#67452f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{roleActionBusy?'Saving...':roleAction.mode==='edit'?'Save Changes':roleAction.mode==='archive'?'Archive Role':'Restore Role'}</button></div></div></div>:null}
   {roleActionFeedback?<div role="alertdialog" aria-modal="true" aria-label={roleActionFeedback.success?'Success':'Error'} className="fixed inset-0 z-[170] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-semibold">{roleActionFeedback.success?'Changes Saved':'Action Failed'}</h3><p className="mt-2 text-sm text-stone-600">{roleActionFeedback.message}</p><div className="mt-6 flex justify-end"><button autoFocus type="button" onClick={()=>setRoleActionFeedback(null)} className="rounded-xl bg-[#67452f] px-5 py-2 text-sm font-semibold text-white">OK</button></div></div></div>:null}
   {notice?<div role="status" className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 className="font-semibold text-lg">{notice.kind==='error'?'Unable to complete action':'Success'}</h3><p className="mt-2 text-sm text-stone-600">{notice.message}</p><div className="mt-5 flex justify-end"><button autoFocus onClick={()=>setNotice(null)} className="rounded-lg bg-stone-800 px-5 py-2 text-white">OK</button></div></div></div>:null}
   {dialog?<div role="dialog" aria-modal="true" aria-label={dialog.title} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{dialog.title}</h3><button aria-label="Close dialog" onClick={()=>setDialog(null)}><X size={20}/></button></div><p className="mt-2 text-sm text-stone-600">{dialog.message}</p>{dialog.kind==='edit'?<input autoFocus aria-label="Role name" value={dialogValue} maxLength={80} onChange={e=>setDialogValue(e.target.value)} className="mt-4 w-full rounded-lg border p-2"/>:null}<div className="mt-6 flex justify-end gap-2"><button disabled={busy} onClick={()=>setDialog(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy||(dialog.kind==='edit'&&dialogValue.trim().length<3)} onClick={()=>{const action=dialog.run;const value=dialogValue;setDialog(null);action(value)}} className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white">{dialog.kind==='edit'?'Save Changes':'Confirm'}</button></div></div></div>:null}
  <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
   <div className="flex flex-wrap items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4e9dc] text-[#704b35]"><ShieldCheck size={20}/></div><div><h2 className="text-base font-bold tracking-tight text-stone-900">Access Management</h2><p className="text-xs text-stone-500">Manage users and permissions across the configured roles.</p></div></div>
   <div className="mt-4 flex flex-wrap gap-2">{tabs.map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab===key?'text-white shadow-sm':'bg-stone-100 text-stone-600 hover:bg-stone-200'}`} style={tab===key?{background:'var(--portal-base)'}:{}}>{label}</button>)}</div>
  </div>
  {tab==='accounts'?<AccountsPanel/>:<div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4 shadow-sm">
   <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3"><div><h3 className="text-base font-bold text-stone-900">{tabs.find(x=>x[0]===tab)?.[1]}</h3><p className="mt-0.5 text-xs text-stone-500">{tab==='permissions'?'Select a role and fine-tune its access.':'Review configured system roles.'}</p></div><button type="button" onClick={reload} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50" title="Refresh data"><RefreshCw size={15}/> Refresh</button></div>
   {error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} {error.includes('401') ? 'Please sign out and sign in again if your Admin session has expired.' : ''}</p>:null}
   {!data&&!error?<p className="text-sm text-stone-500">Loading...</p>:tab==='roles'?<>

    <div className="flex flex-wrap items-center justify-between gap-3">
     
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
     <input aria-label="Search roles" value={roleSearch} onChange={e=>setRoleSearch(e.target.value)} placeholder="Search roles..." className="w-full max-w-sm rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm focus:border-[#967458] focus:outline-none focus:ring-2 focus:ring-[#967458]/20"/>
     <span className="text-xs text-stone-500">{visibleRoles.length} {visibleRoles.length===1?'role':'roles'} shown</span>
    </div>
    
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
     <table className="w-full min-w-[360px] text-left text-sm">
      <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">User Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Granted Permissions</th><th className="px-4 py-3">Role Type</th></tr></thead>
      <tbody className="divide-y divide-stone-100">{visibleRoles.map(r=><tr key={r.role_id} className="transition-colors hover:bg-[#faf7f4]">
       <td className="px-4 py-4 font-semibold text-stone-800">{r.role_name}</td>
       <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${r.is_active?'bg-emerald-100 text-emerald-800':'bg-stone-100 text-stone-600'}`}>{r.is_active?'Active':'Archived'}</span></td>
       <td className="px-4 py-4"><span className="rounded-full bg-[#f4ede7] px-3 py-1 text-xs font-semibold text-[#684a35]">{roleGrantCounts.get(r.role_id)||0} granted</span></td>
       <td className="px-4 py-4"><div className="flex justify-end gap-2">{r.role_code.startsWith('custom_')?<>
        <button type="button" disabled={busy} onClick={()=>{setRoleActionName(r.role_name);setRoleAction({mode:'edit',role:r})}} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">Edit</button>
        <button type="button" disabled={busy} onClick={()=>setRoleAction({mode:r.is_active?'archive':'restore',role:r})} className={`rounded-xl border px-4 py-2 text-xs font-semibold ${r.is_active?'border-red-200 bg-red-50 text-red-700 hover:bg-red-100':'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{r.is_active?'Archive':'Restore'}</button>
       </>:<span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">Built-in</span>}</div></td>
      </tr>)}</tbody>
     </table>
     {visibleRoles.length===0?<div className="px-5 py-12 text-center"><h4 className="text-sm font-semibold text-stone-700">{roleSearch?'No matching roles':'No roles found'}</h4><p className="mt-1 text-xs text-stone-500">{roleSearch?'Try another search term.':'Check the role catalog and refresh.'}</p></div>:null}
    </div>
   </>:tab==='permissions'?<>
    <select value={selected?.role_id||''} onChange={e=>setRole(e.target.value)} className="max-w-md rounded-lg border p-2 text-sm">{userRoles.map(r=><option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}</select>
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-2">
     <h4 className="text-sm font-semibold text-stone-800">Assign role to a user</h4>
     <p className="text-xs text-stone-500">Additional access only. This does not change the user's primary login portal or OSFA Coordinator status.</p>
     <div className="flex flex-wrap gap-2">
      <select className="min-w-56 flex-1 rounded-lg border border-stone-200 p-2 text-sm" value={selectedUser} onChange={e=>setSelectedUser(e.target.value)}>
       <option value="">Select an existing active user</option>
       {eligibleUsers.filter(u=>!u.is_archived).map(u=><option key={u.user_id} value={u.user_id}>{u.display_name||u.username} ({u.username})</option>)}
      </select>
      <button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={busy||!selectedUser||!selected||selected.role_code==='admin'||!selected.is_active} onClick={()=>change('/roles/'+selected.role_id+'/users/'+selectedUser,'PUT',{granted:true})}>Grant role</button>
      <button className="rounded-lg bg-stone-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={busy||!selectedUser||!selected||selected.role_code==='admin'} onClick={()=>change('/roles/'+selected.role_id+'/users/'+selectedUser,'PUT',{granted:false})}>Revoke role</button>
     </div>
     {selectedUser?<p className="text-xs text-stone-600">Current assignment: {(data?.assignments||[]).some(a=>a.user_id===selectedUser&&a.role_id===selected?.role_id&&a.is_active)?'Active':'Not assigned'}</p>:null}
    </div>
    <p className="text-xs text-stone-500">OSFA Coordinator grants are protected against lockout. Changes are confirmed before saving.</p>
    <details className="group rounded-xl border border-stone-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-stone-800 [&::-webkit-details-marker]:hidden"><span>Advanced access <span className="ml-1 text-xs font-normal text-stone-500">Portal and role-group settings</span></span><span className="text-xs text-stone-400 group-open:rotate-180">⌄</span></summary><div className="space-y-3 border-t border-stone-100 px-4 py-4"><h4 className="font-semibold text-xs uppercase tracking-wide text-stone-600">Portal access</h4><div className="flex flex-wrap gap-3">{['sdo','guidance','pd','ro_coordinator'].map(portal=><label key={portal} className="flex gap-2 text-xs items-center"><input type="checkbox" disabled={busy||selected?.role_code==='admin'||!selected?.is_active} checked={(capabilities?.portals||[]).some(x=>x.role_id===selected?.role_id&&x.portal_code===portal)} onChange={e=>change('/roles/'+selected.role_id+'/portals/'+portal,'PUT',{granted:e.target.checked})}/>{portal.replaceAll('_',' ')}</label>)}</div><h4 className="font-semibold text-sm">Role groups (database-configured)</h4><div className="flex flex-wrap gap-3">{(capabilities?.groups||[]).filter(g=>g.group_code!=='ADMIN_ONLY').map(g=><label key={g.group_id} className="flex gap-2 text-xs items-center"><input type="checkbox" disabled={busy||selected?.role_code==='admin'||!selected?.is_active} checked={(capabilities?.groupMembers||[]).some(x=>x.role_id===selected?.role_id&&x.group_id===g.group_id)} onChange={e=>change('/roles/'+selected.role_id+'/groups/'+g.group_id,'PUT',{granted:e.target.checked})}/>{g.group_code.replaceAll('_',' ')}</label>)}</div></div></details>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3"><div><p className="text-sm font-bold text-stone-900">Permission checklist <span className="ml-2 rounded-full bg-[#eee2d7] px-2.5 py-1 text-xs font-semibold text-[#704b35]">{grants.size} granted</span></p><p className="mt-1 text-xs text-stone-500">Granted items are shown first. Select a permission to change access.</p></div><div className="relative min-w-56 flex-1 sm:max-w-xs"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-stone-400"/><input aria-label="Search role permissions" placeholder="Search permissions..." value={permissionSearch} onChange={e=>setPermissionSearch(e.target.value)} className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"/></div></div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{sortedRolePermissions.length===0?<p className="text-sm text-stone-500">No matching permissions.</p>:null}{sortedRolePermissions.map(p=><label key={p.permission_id} className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${grants.has(p.permission_code) ? 'border-[#d5bba7] bg-[#fbf6f1] shadow-sm' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'}`}><span className="relative flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true"><span className={`flex h-4 w-4 items-center justify-center rounded border ${grants.has(p.permission_code) ? 'border-[#704b35] bg-[#704b35]' : 'border-stone-400 bg-white'}`}>{grants.has(p.permission_code) ? <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7"/></svg> : null}</span></span><input type="checkbox" className="sr-only" checked={grants.has(p.permission_code)} disabled={busy||selected?.role_code==='admin'||!selected?.is_active} onChange={e=>change(`/roles/${selected.role_id}/permissions/${p.permission_id}`,'PUT',{granted:e.target.checked})}/><span title={p.description || p.permission_code}>{formatPermissionLabel(p.permission_code)}</span></label>)}</div>
   </>:null}
  </div>}
 </div>
}
