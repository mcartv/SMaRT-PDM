// PHASE6D2B_WORKSPACE_SCOPE_UI_V1
// Administrator-managed limits; all access enforced by backend.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '@/api';

const normalizeIds = ids => Array.isArray(ids) ? ids.map(String) : [];

export default function WorkspaceScopesPanel() {
  const [catalog,setCatalog] = useState({ offices:[], courses:[] });
  const [roles,setRoles] = useState([]);
  const [users,setUsers] = useState([]);
  const [roleId,setRoleId] = useState('');
  const [userId,setUserId] = useState('');
  const [scope,setScope] = useState({office_ids:[],course_ids:[]});
  const [roleScope,setRoleScope] = useState({office_ids:[],course_ids:[]});
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const request=useCallback(async (suffix,options={})=>{
    const response=await fetch(buildApiUrl('/api/rbac-management'+suffix),{
      ...options, cache:'no-store', headers:{Authorization:'Bearer '+(sessionStorage.getItem('adminToken')||''),'Content-Type':'application/json',...(options.headers||{})}
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||data.message||'Scope request failed ('+response.status+').');
    return data;
  },[]);
  const refresh=useCallback(async()=>{
    setError('');setLoading(true);
    try {
      const [c,overview,eligible]=await Promise.all([request('/workspace-scopes/catalog'),request('/overview'),request('/eligible-users')]);
      setCatalog({offices:c.offices||[],courses:c.courses||[]});
      setRoles((overview.roles||[]).filter(r=>r.role_scope==='staff'&&r.is_active&&String(r.role_code).startsWith('custom_')));
      setUsers((eligible.users||[]).filter(u=>!u.is_archived));
    }catch(e){setError(e.message)}finally{setLoading(false)}
  },[request]);
  useEffect(()=>{refresh()},[refresh]);
  useEffect(()=>{
    let cancelled=false;
    setScope({office_ids:[],course_ids:[]});setRoleScope({office_ids:[],course_ids:[]});setError('');setNotice('');
    if(!roleId)return;
    setLoading(true);
    (async()=>{
      try{
        const role=await request('/workspace-scopes/roles/'+roleId);
        if(cancelled)return;
        const parent={office_ids:normalizeIds(role.office_ids),course_ids:normalizeIds(role.course_ids)};
        setRoleScope(parent);
        if(userId){const own=await request('/workspace-scopes/roles/'+roleId+'/users/'+userId);if(!cancelled)setScope({office_ids:normalizeIds(own.office_ids),course_ids:normalizeIds(own.course_ids)});}
        else setScope(parent);
      }catch(e){if(!cancelled)setError(e.message)}finally{if(!cancelled)setLoading(false)}
    })();
    return()=>{cancelled=true};
  },[roleId,userId,request]);
  const offices=useMemo(()=>catalog.offices.filter(o=>!userId||roleScope.office_ids.includes(String(o.office_id))),[catalog,userId,roleScope]);
  const courses=useMemo(()=>catalog.courses.filter(c=>scope.office_ids.includes(String(c.office_id))&&(!userId||roleScope.course_ids.includes(String(c.course_id)))),[catalog,scope.office_ids,userId,roleScope]);
  const toggleOffice=(id,checked)=>setScope(previous=>({
    office_ids:checked?[...previous.office_ids,id]:previous.office_ids.filter(x=>x!==id),
    course_ids:checked?previous.course_ids:previous.course_ids.filter(x=>!catalog.courses.some(c=>String(c.course_id)===x&&String(c.office_id)===id))
  }));
  const toggleCourse=(id,checked)=>setScope(previous=>({...previous,course_ids:checked?[...previous.course_ids,id]:previous.course_ids.filter(x=>x!==id)}));
  const save=async()=>{
    if(!roleId||busy||loading)return;
    setBusy(true);setError('');setNotice('');
    try{
      const path='/workspace-scopes/roles/'+roleId+(userId?'/users/'+userId:'');
      await request(path,{method:'PUT',body:JSON.stringify(scope)});
      setNotice('Scope saved. Access is still subject to active permissions and server-side checks.');
      if(!userId)setRoleScope(scope);
    }catch(e){setError(e.message)}finally{setBusy(false)}
  };
  return <section className="space-y-5" data-phase6d2b="true">
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-bold text-stone-900">Workspace Office &amp; Course Scopes</h2>
      <p className="mt-1 text-sm text-stone-600">Grant role limits first, then restrict each assigned user. Permissions control actions; office and course scopes control which records may be accessed.</p>
      <p className="mt-2 text-xs font-medium text-amber-800">An empty scope grants no record access. Restricted workspace modules remain blocked until Phase 6D-2C/D is verified.</p>
    </div>
    <div className="grid gap-4 rounded-xl border border-stone-200 bg-white p-5 md:grid-cols-2">
      <label className="space-y-2 text-sm font-semibold">Custom role
        <select value={roleId} onChange={e=>{setRoleId(e.target.value);setUserId('')}} className="block w-full rounded-lg border border-stone-300 p-2.5" disabled={busy}>
          <option value="">Select a custom role</option>{roles.map(r=><option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
        </select>
      </label>
      <label className="space-y-2 text-sm font-semibold">Scope to configure
        <select value={userId} onChange={e=>setUserId(e.target.value)} className="block w-full rounded-lg border border-stone-300 p-2.5" disabled={!roleId||busy}>
          <option value="">Role limits (configure first)</option>{users.map(u=><option key={u.user_id} value={u.user_id}>{u.display_name||u.username||u.email}</option>)}
        </select>
      </label>
      <div className="md:col-span-2 text-xs text-stone-500">For user scope, choose only an account assigned to this role. The backend will reject other accounts. Users may only receive a subset of the role's office/course limits.</div>
    </div>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {notice&&<div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    {loading?<p className="p-4 text-sm text-stone-500">Loading scope configuration…</p>:roleId?<>
      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset className="rounded-xl border border-stone-200 bg-white p-5"><legend className="px-2 font-bold">Authorized offices</legend>
          {offices.length?offices.map(o=><label key={o.office_id} className="flex items-center gap-2 border-b border-stone-100 py-2 text-sm"><input type="checkbox" checked={scope.office_ids.includes(String(o.office_id))} onChange={e=>toggleOffice(String(o.office_id),e.target.checked)}/>{o.office_name}</label>):<p className="text-sm text-stone-500">No eligible offices. Configure role limits first.</p>}
        </fieldset>
        <fieldset className="rounded-xl border border-stone-200 bg-white p-5"><legend className="px-2 font-bold">Authorized courses</legend>
          {courses.length?courses.map(c=><label key={c.course_id} className="flex items-center gap-2 border-b border-stone-100 py-2 text-sm"><input type="checkbox" checked={scope.course_ids.includes(String(c.course_id))} onChange={e=>toggleCourse(String(c.course_id),e.target.checked)}/><span>{c.course_code} — {c.course_name}</span></label>):<p className="text-sm text-stone-500">Select an eligible office to see its courses.</p>}
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4"><p className="text-sm text-stone-600">Selected: {scope.office_ids.length} office(s), {scope.course_ids.length} course(s).</p><button type="button" disabled={busy||loading} onClick={save} className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?'Saving…':'Save scope'}</button></div>
    </>:<p className="rounded-xl bg-stone-50 p-5 text-sm text-stone-500">Select a custom role to configure its limits.</p>}
    <button type="button" className="text-sm font-medium text-teal-700 underline" onClick={refresh} disabled={busy}>Refresh role and office catalog</button>
  </section>;
}
