import usePortalLogo from '@/hooks/usePortalLogo';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PanelLeftClose, PanelLeftOpen, LogOut, Menu, RefreshCw, ShieldCheck, X, Bell } from 'lucide-react';
import pdmLogo from '@/assets/pdm-logo.png';
import { buildApiUrl } from '@/api';
import { getPortalDefaultTheme } from '@/config/portalThemes';
import { getWorkspaceModules, WORKSPACE_MODULES } from './workspaceModuleRegistry';

const linkStyle = ({ isActive }) => `flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition-colors ${isActive ? 'bg-[var(--portal-accent-soft)] text-[var(--portal-base)]' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}`;

export default function WorkspaceLayout() {
  const portalLogo = usePortalLogo('workspaceToken');
  const navigate = useNavigate();
  const theme = getPortalDefaultTheme('admin');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [state,setState] = useState({ loading:true, permissions:[], role_name:'', error:'' });
  const [refreshing,setRefreshing] = useState(false);
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(buildApiUrl('/api/workspace/me'), {headers:{Authorization:`Bearer ${sessionStorage.getItem('workspaceToken')||''}`},cache:'no-store'});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw Error(data.message || 'Workspace access denied.');
      setState({loading:false,error:'',has_ro_coordinator_access:data.has_ro_coordinator_access===true,role_name:data.role_name||'Office Staff',permissions:Array.isArray(data.permissions)?data.permissions:[]});
    } catch(e) { setState({loading:false,error:e.message||'Access unavailable.',role_name:'',permissions:[]}); }
    finally {setRefreshing(false);}
  },[]);
  useEffect(()=>{ reload(); const onFocus=()=>reload(); window.addEventListener('focus',onFocus); return ()=>window.removeEventListener('focus',onFocus); },[reload]);
  const modules = useMemo(()=>{ const items=getWorkspaceModules(state.permissions); if(state.has_ro_coordinator_access && !items.some(item=>item.key==='ro')) items.push({key:'ro',...WORKSPACE_MODULES.ro}); return items; },[state.permissions,state.has_ro_coordinator_access]);
  const context = useMemo(()=>({ ...state, modules, reload }),[state,modules,reload]);
  const logout=()=>{for(const store of [sessionStorage,localStorage]){store.removeItem('workspaceToken');store.removeItem('workspaceProfile');}navigate('/login',{replace:true});};
  const aside=<>
    <div className="flex h-[86px] items-center justify-between border-b border-stone-200 px-4">
      <div className={`flex items-center gap-2.5 ${collapsed?'lg:hidden':''}`}><img src={portalLogo} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=pdmLogo;}} alt="SMaRT-PDM logo" className="h-11 w-11 object-contain"/><div className="min-w-0"><div className="text-[15px] font-extrabold tracking-tight text-stone-900">SMaRT-PDM</div><div className="text-[11px] font-medium text-stone-500">Office Portal</div></div></div>
      <button aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} className="hidden rounded-lg p-2 text-stone-500 hover:bg-stone-100 lg:block" onClick={()=>setCollapsed(v=>!v)}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button>
      <button aria-label="Close navigation" className="lg:hidden" onClick={()=>setMobileOpen(false)}><X size={20}/></button>
    </div>
    <div className="flex-1 overflow-y-auto px-3 py-5"><div className={`${collapsed?'lg:hidden':''} px-3 pb-2 text-[10px] font-bold uppercase tracking-[.15em] text-stone-400`}>Overview</div>
      <NavLink to="/workspace/dashboard" title="Dashboard" onClick={()=>setMobileOpen(false)} className={linkStyle}><LayoutDashboard size={19}/><span className={collapsed?'lg:hidden':''}>Dashboard</span></NavLink>
      <div className={`${collapsed?'lg:hidden':''} px-3 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[.15em] text-stone-400`}>Office Modules</div>
      {modules.map(m=><NavLink key={m.key} to={`/workspace/${m.key}`} title={m.label} onClick={()=>setMobileOpen(false)} className={linkStyle}><m.icon size={19} className="shrink-0"/><span className={collapsed?'lg:hidden':''}>{m.label}</span></NavLink>)}
    </div>
    <div className="border-t border-stone-200 p-3"><button onClick={logout} title="Log out" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-stone-600 hover:bg-rose-50 hover:text-rose-700"><LogOut size={19}/><span className={collapsed?'lg:hidden':''}>Log out</span></button></div>
  </>;
  return <div className="flex min-h-screen bg-[var(--portal-main-bg,#f8f7f5)] font-sans text-stone-800" style={{'--portal-base':theme.base,'--portal-accent-soft':theme.accentSoft,'--portal-main-bg':theme.mainBg}}>
    {mobileOpen&&<button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`${mobileOpen?'translate-x-0':'-translate-x-full'} ${collapsed?'lg:w-[78px]':'lg:w-[256px]'} fixed bottom-0 left-0 top-0 z-50 flex w-[270px] flex-col border-r border-stone-200 bg-white shadow-sm transition-all lg:sticky lg:translate-x-0`}>{aside}</aside>
    <div className="flex min-w-0 flex-1 flex-col"><header className="sticky top-0 z-30 flex h-[75px] items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 sm:px-7">
      <div className="flex items-center gap-3"><button aria-label="Open navigation" className="rounded-lg border border-stone-200 p-2 lg:hidden" onClick={()=>setMobileOpen(true)}><Menu size={20}/></button><div><p className="text-[13px] font-bold text-stone-900">{state.role_name || 'Office Workspace'}</p><p className="text-[11px] text-stone-500">Scholarship Management System</p></div></div>
      <div className="flex items-center gap-3"><div className="hidden items-center gap-1 text-xs text-stone-500 sm:flex"><ShieldCheck size={15}/> Authorized office access</div><button disabled={refreshing} onClick={reload} title="Refresh access" aria-label="Refresh access" className="rounded-lg border border-stone-200 p-2.5 hover:bg-stone-50 disabled:opacity-60"><RefreshCw size={17} className={refreshing?'animate-spin':''}/></button></div>
    </header><main className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8"><div className="mx-auto w-full max-w-[1440px]">
      {state.loading?<p className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">Loading office workspace…</p>:state.error?<div role="alert" className="rounded-xl border border-rose-200 bg-white p-6"><h2 className="font-semibold text-rose-700">Workspace unavailable</h2><p className="mt-1 text-sm">{state.error}</p><button className="mt-3 text-sm font-bold underline" onClick={reload}>Retry</button></div>:<Outlet context={context}/>}
    </div></main></div>
  </div>;
}
