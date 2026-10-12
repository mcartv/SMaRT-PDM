import React,{useCallback,useEffect,useMemo,useState} from 'react';
import { ShieldCheck, RefreshCw, Plus, Save } from 'lucide-react';
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
  accounts: 'Staff Accounts', announcements: 'Announcements', applications: 'Applications',
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

const tabs=[['accounts','Staff Accounts'],['roles','Roles'],['permissions','Role Permissions'],['assignments','Staff Access']];
export default function RBACPanel(){
 const [tab,setTab]=useState('accounts'),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[role,setRole]=useState(''),[code,setCode]=useState(''),[name,setName]=useState('');
 const token=sessionStorage.getItem('adminToken');
 const request=useCallback(async(path,init={})=>{const res=await fetch(buildApiUrl('/api/rbac-management'+path),{...init,headers:{Authorization:`Bearer ${sessionStorage.getItem('adminToken')||''}`,'Content-Type':'application/json',...(init.headers||{})}});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||`Request failed (${res.status})`);return body;},[]);
 const reload=useCallback(async()=>{setError('');try{setData(await request('/overview'))}catch(e){setError(e.message)}},[request]);
 useEffect(()=>{if(tab!=='accounts')reload()},[tab,reload]);
 const staffRoles=(data?.roles||[]).filter(r=>r.role_scope==='staff');
 const selected=staffRoles.find(r=>r.role_id===role)||staffRoles[0];
 const grants=useMemo(()=>new Set((data?.rolePermissions||[]).filter(x=>x.role_id===selected?.role_id).map(x=>x.permission_code)),[data,selected]);
 // Granted permissions appear first. Sorting is display-only; grants and codes are unchanged.
 const sortedRolePermissions = useMemo(() => [...(data?.permissions || [])].sort((a,b) => {
  const aGranted = grants.has(a.permission_code) ? 1 : 0;
  const bGranted = grants.has(b.permission_code) ? 1 : 0;
  if(aGranted !== bGranted) return bGranted - aGranted;
  const label = p => typeof formatPermissionLabel === 'function' ? formatPermissionLabel(p.permission_code) : p.permission_code;
  return label(a).localeCompare(label(b));
 }), [data?.permissions, grants]);
 // SMARTPDM_STAFF_ACCESS_GROUPED_V1
 // Account classifications are hidden in Staff Access, but remain intact in the database.
 const staffAccessRows = useMemo(() => {
  const staffRoleIds = new Set((data?.roles || []).filter(r => r.role_scope === 'staff').map(r => r.role_id));
  const byUser = new Map();
  for (const assignment of (data?.assignments || [])) {
   if (!staffRoleIds.has(assignment.role_id) || assignment.is_active !== true) continue;
   const id = String(assignment.user_id || '');
   if (!id) continue;
   if (!byUser.has(id)) byUser.set(id, { user_id: id, username: assignment.username || '', roles: new Set() });
   const entry = byUser.get(id);
   if (!entry.username && assignment.username) entry.username = assignment.username;
   const role = (data?.roles || []).find(r => r.role_id === assignment.role_id);
   if (role && role.is_active !== false) entry.roles.add(role.role_code === 'admin' ? 'System Administrator' : role.role_name);
  }
  return [...byUser.values()].map(entry => ({ ...entry, roles: [...entry.roles].sort((a,b) => a.localeCompare(b)) }))
   .filter(entry => entry.roles.length)
   .sort((a,b) => (a.username || a.user_id).localeCompare(b.username || b.user_id));
 }, [data]);
 async function change(path,method,payload){if(!window.confirm('Apply this RBAC change? It may affect active permissions.'))return;setBusy(true);setError('');try{await request(path,{method,body:JSON.stringify(payload)});await reload()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="space-y-4">
  <div className="rounded-2xl border border-stone-200 bg-white p-4">
   <h2 className={MAINTENANCE_CARD_TITLE_CLASS}>RBAC &amp; Account Management</h2><p className={MAINTENANCE_CARD_SUBTITLE_CLASS}>Manage staff accounts, review access grants, and maintain custom roles. Built-in roles are protected while enforcement is active.</p>
   <div className="mt-4 flex flex-wrap gap-2">{tabs.map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab===key?'text-white shadow-sm':'bg-stone-100 text-stone-600 hover:bg-stone-200'}`} style={tab===key?{background:'var(--portal-base)'}:{}}>{label}</button>)}</div>
  </div>
  {tab==='accounts'?<AccountsPanel/>:<div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-4">
   <div className="flex items-center justify-between gap-2"><div><h3 className={MAINTENANCE_CARD_TITLE_CLASS}>{tabs.find(x=>x[0]===tab)?.[1]}</h3><p className={MAINTENANCE_CARD_SUBTITLE_CLASS}>Review staff roles and their access permissions</p></div><button onClick={reload} className="rounded-lg border border-stone-200 p-2" title="Refresh"><RefreshCw size={16}/></button></div>
   {error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} {error.includes('401') ? 'Please sign out and sign in again if your Admin session has expired.' : ''}</p>:null}
   {!data&&!error?<p className="text-sm text-stone-500">Loading...</p>:tab==='roles'?<>
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><input className="rounded-lg border p-2 text-sm" placeholder="custom_role_code" value={code} onChange={e=>setCode(e.target.value)}/><input className="rounded-lg border p-2 text-sm" placeholder="New role name" value={name} onChange={e=>setName(e.target.value)}/><button disabled={busy} onClick={()=>change('/roles','POST',{role_code:code,role_name:name})} className="rounded-lg bg-stone-800 px-3 py-2 text-sm text-white"><Plus size={14} className="inline"/> Add Custom Role</button></div>
    <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-stone-500"><th className="p-2">Role</th><th>Code</th><th>Scope</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.roles.map(r=><tr key={r.role_id} className="border-b"><td className="p-2">{r.role_name}</td><td>{r.role_code}</td><td>{r.role_scope}</td><td>{r.is_active?'Active':'Archived'}</td><td>{r.role_code.startsWith('custom_')?<button className="text-sm underline" disabled={busy} onClick={()=>change('/roles/'+r.role_id+'/status','PATCH',{is_active:!r.is_active})}>{r.is_active?'Archive':'Restore'}</button>:<span className="text-xs text-stone-500">Protected</span>}</td></tr>)}</tbody></table></div>
   </>:tab==='permissions'?<>
    <select value={selected?.role_id||''} onChange={e=>setRole(e.target.value)} className="max-w-md rounded-lg border p-2 text-sm">{staffRoles.map(r=><option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}</select>
    <p className="text-xs text-stone-500">Built-in role grants are read-only to prevent accidental production lockout. Custom active role grants may be edited.</p>
    <p className="text-xs font-medium text-[#704b35]">Granted permissions are listed first and highlighted in brown.</p>
    <div className="grid gap-2 sm:grid-cols-2">{sortedRolePermissions.map(p=><label key={p.permission_id} className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${grants.has(p.permission_code) ? 'border-[#cfb19c] bg-[#f7f0e9]' : 'border-stone-200 bg-white'}`}><span className="relative flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true"><span className={`flex h-4 w-4 items-center justify-center rounded border ${grants.has(p.permission_code) ? 'border-[#704b35] bg-[#704b35]' : 'border-stone-400 bg-white'}`}>{grants.has(p.permission_code) ? <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7"/></svg> : null}</span></span><input type="checkbox" className="sr-only" checked={grants.has(p.permission_code)} disabled={busy||!selected?.role_code?.startsWith('custom_')||!selected?.is_active} onChange={e=>change(`/roles/${selected.role_id}/permissions/${p.permission_id}`,'PUT',{granted:e.target.checked})}/><span title={p.description || p.permission_code}>{formatPermissionLabel(p.permission_code)}</span></label>)}</div>
   </>:<><p className="text-sm text-stone-600">These are the roles currently linked to staff accounts. Manage staff details in Staff Accounts. Direct role changes are restricted to keep sign-in access consistent.</p><div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Username</th><th>Staff roles</th><th>Active</th></tr></thead><tbody>{staffAccessRows.map(a=><tr key={a.user_id} className="border-b"><td className="p-2"><span className="block font-semibold text-stone-800">{a.username || 'Username unavailable'}</span><span className="block break-all font-mono text-[10px] text-stone-400" title="Account ID">{a.user_id}</span></td><td>{a.roles.join(', ')}</td><td>Yes</td></tr>)}{staffAccessRows.length===0?<tr><td colSpan={3} className="p-4 text-center text-stone-500">No active staff role assignments found.</td></tr>:null}</tbody></table></div></>}
  </div>}
 </div>
}
