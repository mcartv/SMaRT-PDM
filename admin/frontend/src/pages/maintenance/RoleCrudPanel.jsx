// SMARTPDM_ROLE_LIST_CLEAN_UI_V1
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import { buildApiUrl } from '@/api';

const api = async (path, options={}) => {
  const token = sessionStorage.getItem('adminToken') || '';
  const response = await fetch(buildApiUrl('/api/rbac-management' + path), {
    ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || json.message || `Request failed (${response.status})`);
  return json;
};

const permissionLabel = p => String(p.permission_code || '').replaceAll('.', ' · ').replaceAll('_', ' ');

function RoleEditor({ role, permissions, granted, busy, onClose, onSave }) {
  const [name, setName] = useState(role?.role_name || '');
  const [selected, setSelected] = useState(() => new Set(granted));
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const canEditGrants = role?.role_code !== 'admin';
  const matching = useMemo(() => permissions.filter(p => `${p.permission_code} ${p.description || ''}`.toLowerCase().includes(search.toLowerCase().trim())), [permissions, search]);
  const allMatchingChecked = matching.length > 0 && matching.every(p => selected.has(p.permission_id));
  const toggleOne = id => setSelected(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelected(previous => {
    const next = new Set(previous);
    if (matching.every(p => next.has(p.permission_id))) matching.forEach(p => next.delete(p.permission_id));
    else matching.forEach(p => next.add(p.permission_id));
    return next;
  });
  async function submit(event) {
    event.preventDefault();
    if (name.trim().length < 3 || name.trim().length > 80) { setError('Role name must contain 3–80 characters.'); return; }
    setError('');
    try { await onSave({ role_name: name.trim(), permission_ids: [...selected] }); }
    catch (e) { setError(e.message); }
  }
  return <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-3 sm:p-6" role="presentation">
    <div role="dialog" aria-modal="true" aria-label={role ? 'Edit role and permissions' : 'Create role and permissions'} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex shrink-0 items-start justify-between border-b border-stone-200 p-4 sm:p-5">
        <div><h2 className="text-lg font-bold text-stone-900">{role ? 'Edit Role' : 'Add Role'}</h2><p className="mt-1 text-xs text-stone-500">Set the role name and select the permissions it can access.</p></div>
        <button type="button" aria-label="Close role editor" disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-stone-100"><X size={18}/></button>
      </div>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <label className="block text-sm font-semibold text-stone-800">Role Name<input autoFocus required minLength={3} maxLength={80} disabled={busy} value={name} onChange={e => setName(e.target.value)} placeholder="Enter role name" className="mt-2 h-10 w-full rounded-lg border border-stone-300 px-3 text-sm outline-none focus:border-[#8c6249]" /></label>
          <section className="rounded-xl border border-stone-200">
            <div className="space-y-3 border-b border-stone-200 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-stone-800">Permissions</h3><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">{selected.size} selected</span></div>
              {canEditGrants ? <><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-stone-400"/><input aria-label="Search permissions in editor" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search permissions..." className="h-10 w-full rounded-lg border border-stone-200 pl-9 pr-3 text-sm" /></div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700"><input type="checkbox" checked={allMatchingChecked} disabled={busy || matching.length===0} onChange={toggleAll} className="accent-[#704b35]"/>Select all matching ({matching.length})</label></> : <p className="text-xs text-stone-500">Administrator permissions are protected. You can update the display name only.</p>}
            </div>
            <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto p-3 sm:grid-cols-2">{matching.length ? matching.map(p => <label key={p.permission_id} className="flex min-w-0 items-start gap-2 rounded-lg px-2 py-2 text-xs hover:bg-stone-50"><input type="checkbox" disabled={busy || !canEditGrants} checked={selected.has(p.permission_id)} onChange={()=>toggleOne(p.permission_id)} className="mt-0.5 accent-[#704b35]"/><span className="min-w-0"><span className="block break-words font-semibold text-stone-800">{permissionLabel(p)}</span>{p.description && <span className="mt-1 block break-words text-stone-500">{p.description}</span>}</span></label>) : <p className="col-span-full py-6 text-center text-xs text-stone-500">No permissions match your search.</p>}</div>
          </section>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-stone-200 bg-stone-50 p-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={busy || name.trim().length < 3} className="rounded-lg bg-[#704b35] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving...' : role ? 'Save Changes' : 'Create Role'}</button></div>
      </form>
    </div>
  </div>;
}

export default function RoleCrudPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('current');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);
  const [action, setAction] = useState(null);
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { setData(await api('/overview')); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(()=>{ refresh(); }, [refresh]);
  const roles = useMemo(()=> (data?.roles || []).filter(r => r.role_scope === 'staff' && r.role_code !== 'benefactor'), [data]);
  const current = roles.filter(r=>r.is_active);
  const archived = roles.filter(r=>!r.is_active);
  const visible = roles.filter(r => r.is_active === (status === 'current') && `${r.role_name} ${r.role_code}`.toLowerCase().includes(search.trim().toLowerCase()));
  const grantsFor = role => (data?.rolePermissions || []).filter(x => x.role_id === role?.role_id).map(x => (data?.permissions || []).find(p => p.permission_code === x.permission_code)?.permission_id).filter(Boolean);
  async function save({role_name,permission_ids}) {
    setBusy(true);
    try {
      if (editor === 'new') await api('/roles/with-permissions', { method: 'POST', body: JSON.stringify({role_name,permission_ids}) });
      else await api(`/roles/${editor.role_id}/with-permissions`, { method: 'PATCH', body: JSON.stringify({role_name,permission_ids}) });
      setEditor(null); setMessage('Role and permissions saved successfully.'); await refresh();
    } finally { setBusy(false); }
  }
  async function updateStatus() {
    if (!action || busy) return;
    setBusy(true); setError('');
    try { await api(`/roles/${action.role_id}/status`, { method: 'PATCH', body: JSON.stringify({is_active: !action.is_active}) }); setAction(null); setMessage('Role status updated.'); await refresh(); }
    catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  return <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-base font-bold text-stone-900">Roles</h2><p className="mt-1 text-xs text-stone-500">Create roles, edit permissions, and manage archived roles.</p></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={loading||busy} onClick={refresh} className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold"><RefreshCw size={14}/>Refresh</button><button type="button" disabled={loading||busy} onClick={()=>setEditor('new')} className="flex items-center gap-2 rounded-lg bg-[#704b35] px-3 py-2 text-xs font-semibold text-white"><Plus size={14}/>Add Role</button></div></div>
    <div className="flex flex-col gap-3 border-t border-stone-100 pt-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2">{[['current',current.length],['archived',archived.length]].map(([key,count])=><button type="button" key={key} aria-pressed={status===key} onClick={()=>setStatus(key)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${status===key?'bg-white text-stone-900 shadow ring-1 ring-stone-200':'bg-stone-100 text-stone-500'}`}>{key==='current'?'Current':'Archived'} ({count})</button>)}</div><div className="relative w-full sm:max-w-sm"><Search size={16} className="absolute left-3 top-2.5 text-stone-400"/><input aria-label="Search roles" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search role..." className="h-10 w-full rounded-lg border border-stone-200 pl-9 pr-3 text-sm"/></div></div>
    <p className="text-xs text-stone-500">{current.length} active roles · {archived.length} archived · {roles.length} total roles</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-stone-100 p-3 text-sm">{message}</p>}
    {loading ? <p className="p-8 text-center text-sm text-stone-500">Loading roles...</p> : <div className="overflow-x-auto rounded-xl border border-stone-200"><table className="min-w-[480px] w-full text-left text-sm"><thead className="bg-stone-50 text-xs text-stone-500"><tr><th className="px-4 py-3">Role</th><th className="px-4 py-3">Permissions</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-stone-100">{visible.map(role=><tr key={role.role_id}><td className="px-4 py-3"><p className="font-semibold text-stone-900">{role.role_name}</p></td><td className="px-4 py-3 text-xs">{grantsFor(role).length} permissions</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" disabled={busy || !role.is_active} onClick={()=>setEditor(role)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Edit</button><button type="button" disabled={busy||(role.role_code==='admin'&&role.is_active)} onClick={()=>setAction(role)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">{role.is_active?'Archive':'Restore'}</button></div></td></tr>)}</tbody></table>{!visible.length && <p className="p-8 text-center text-sm text-stone-500">No {status} roles match your search.</p>}</div>}
    {editor && <RoleEditor key={editor==='new'?'new':editor.role_id} role={editor==='new'?null:editor} permissions={data?.permissions||[]} granted={editor==='new'?[]:grantsFor(editor)} busy={busy} onClose={()=>setEditor(null)} onSave={save}/>}
    {action && <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-label="Confirm role status" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><h3 className="font-bold text-stone-900">{action.is_active?'Archive':'Restore'} role?</h3><p className="mt-2 text-sm text-stone-600">{action.role_name}{action.is_active?' will stop granting permissions immediately.':' will become active again.'}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setAction(null)} disabled={busy} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button type="button" onClick={updateStatus} disabled={busy} className="rounded-lg bg-[#704b35] px-4 py-2 text-sm font-semibold text-white">Confirm</button></div></div></div>}
  </div>;
}
