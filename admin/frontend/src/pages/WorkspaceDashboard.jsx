// SMARTPDM_WORKSPACE_PORTAL_FACELIFT_20261022_V1
// Presentation only; all navigation and data remain permission-gated by the existing API.
// SMARTPDM_WORKSPACE_UI_PHASE2_20261013
// SMARTPDM_WORKSPACE_UI_PHASE1_20261013
// Dynamic RBAC workspace presentation. Module operations will be wired in Phase 2.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowLeft, ArrowRight, Bell, BookOpen, BriefcaseBusiness, CalendarDays,
  CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, CreditCard, FileCheck2,
  FileText, GraduationCap, LayoutDashboard, LogOut, Menu, RefreshCw, Search,
  Settings, ShieldCheck, Sparkles, Users, Wallet, X,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { WORKSPACE_MODULES, getWorkspaceModules } from './workspaceModuleRegistry';
import WorkspaceRecords from './WorkspaceRecords'; // SMARTPDM_WORKSPACE_PHASE3_REAL_DATA_V1

// PHASE6C_WORKSPACE_REGISTRY_V1
const MODULES = WORKSPACE_MODULES;
// SMARTPDM_PHASE6B_WORKSPACE_TEMPLATE_V1: workspace module presentation is independent of authorization.
// A visible permission is not proof that the scoped API is available.
const workspaceModuleStatus = key => {
  if (['accounts','applications'].includes(key)) return {label:'Office records',detail:'Shows only the records your office is allowed to view.'};
  if (key==='payouts') return {label:'Coming soon',detail:'Payout records will become available after office filtering is complete.'};
  if (key === 'reports') return {label:'Read-only overview',detail:'A read-only summary is available when reports.view is granted.'};
  return {label:'Integration pending',detail:'Your permission is listed, but this workspace module has no connected data workflow yet.'};
};
const title = action => String(action || '').replaceAll('_', ' ').replace(/\b\w/g, s=>s.toUpperCase());
const DISPLAY_DATE = new Intl.DateTimeFormat('en-PH', { weekday:'long', month:'long', day:'numeric', year:'numeric', timeZone:'Asia/Manila' });

export default function WorkspaceDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, '') || '/workspace/dashboard';
  const routeSegment = pathname.startsWith('/workspace/') ? pathname.slice('/workspace/'.length) : 'dashboard';
  const selected = routeSegment || 'dashboard';
  const [state,setState] = useState({loading:true,permissions:[],role_name:'',error:''});
  const [search,setSearch] = useState('');
  const [compact,setCompact] = useState(false);
  const [mobileOpen,setMobileOpen] = useState(false);
  const [refreshing,setRefreshing] = useState(false);
  const load = useCallback(async()=>{
    setRefreshing(true);
    try {
      const response = await fetch(buildApiUrl('/api/workspace/me'), {
        headers: {Authorization:`Bearer ${sessionStorage.getItem('workspaceToken')||''}`}, cache:'no-store',
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw Error(data.message||'Workspace access denied.');
      setState({loading:false,permissions:Array.isArray(data.permissions)?data.permissions:[],role_name:data.role_name||'Custom Role',error:''});
    } catch(error) {
      setState({loading:false,permissions:[],role_name:'',error:error.message||'Cannot load workspace access.'});
    } finally {setRefreshing(false)}
  },[]);
  useEffect(()=>{
    let active=true;
    const reload=()=>{if(active)load()};
    reload();
    window.addEventListener('focus',reload);
    return()=>{active=false;window.removeEventListener('focus',reload)};
  },[load]);
  const modules=useMemo(()=>getWorkspaceModules(state.permissions),[state.permissions]);
  const filtered=modules.filter(m=>(m.label+' '+m.actions.join(' ')).toLowerCase().includes(search.trim().toLowerCase()));
  const active=modules.find(m=>m.key===selected);
  useEffect(()=>{
    if(!state.loading && !state.error && selected !== 'dashboard' && !modules.some(m=>m.key===selected)) {
      navigate('/workspace/dashboard', {replace:true});
    }
  },[modules,selected,state.loading,state.error,navigate]);
  const logout=()=>{
    sessionStorage.removeItem('workspaceToken');
    sessionStorage.removeItem('workspaceProfile');
    localStorage.removeItem('workspaceToken');
    localStorage.removeItem('workspaceProfile');
    navigate('/login',{replace:true});
  };
  const choose=(key)=>{if(key==='dashboard'||modules.some(m=>m.key===key)){navigate('/workspace/'+key);setMobileOpen(false)}};
  return <div className="min-h-screen bg-[#f1f6fa] text-slate-800">
    <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-7">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Open sidebar" onClick={()=>setMobileOpen(true)} className="rounded-xl border border-slate-200 p-2 lg:hidden"><Menu size={19}/></button>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#126379] text-white"><GraduationCap size={22}/></span>
        <div><div className="text-sm font-extrabold tracking-tight text-slate-900">SMaRT-PDM <span className="font-normal text-slate-400">/ Workspace</span></div><div className="text-[11px] text-slate-500">Office access portal</div></div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <span className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 md:inline-flex"><CalendarDays size={14}/>{DISPLAY_DATE.format(new Date())}</span>
        <button type="button" disabled={refreshing} onClick={load} title="Refresh permissions" aria-label="Refresh permissions" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={17} className={refreshing?'animate-spin':''}/></button>
        <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"><LogOut size={15}/><span className="hidden sm:inline">Log out</span></button>
      </div>
    </header>
    <div className="flex min-h-[calc(100vh-64px)]">
      {mobileOpen&&<button type="button" aria-label="Close sidebar" onClick={()=>setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden"/>}
      <aside className={`${mobileOpen?'translate-x-0':'-translate-x-full'} ${compact?'lg:w-[80px]':'lg:w-[240px]'} fixed bottom-0 left-0 top-[64px] z-40 flex w-[260px] flex-col border-r border-[#d5e4ef] bg-[#224d70] px-3 py-5 text-white transition-all duration-200 lg:sticky lg:top-[64px] lg:h-[calc(100vh-64px)] lg:translate-x-0`}>
        <div className="mb-4 flex items-center justify-between px-2"><span className={`${compact?'lg:hidden':''} text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-100`}>Your office</span><button type="button" aria-label={compact?'Expand sidebar':'Collapse sidebar'} onClick={()=>{setCompact(v=>!v);setMobileOpen(false)}} className="hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:block">{compact?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}</button><button type="button" aria-label="Close navigation" onClick={()=>setMobileOpen(false)} className="lg:hidden"><X size={18}/></button></div>
        <nav aria-label="Workspace navigation" className="flex-1 space-y-1 overflow-y-auto">
          <button type="button" onClick={()=>choose('dashboard')} title="Dashboard" className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${selected==='dashboard'?'bg-[#3a719a] text-white':'text-blue-50 hover:bg-white/10'}`}><LayoutDashboard size={18}/><span className={compact?'lg:hidden':''}>Dashboard</span></button>
          <div className={`${compact?'lg:hidden':''} px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-widest text-blue-100`}>Office modules</div>
          {modules.map(m=><button key={m.key} type="button" title={m.label} onClick={()=>choose(m.key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${selected===m.key?'bg-[#3a719a] text-white':'text-blue-50 hover:bg-white/10'}`}><m.icon size={18} className="shrink-0"/><span className={`${compact?'lg:hidden':''} flex-1 truncate`}>{m.label}</span><span className={`${compact?'lg:hidden':''} text-[10px] text-slate-400`}>{m.actions.length}</span></button>)}
        </nav>
        <div className="mt-4 rounded-xl bg-white/10 p-3 text-blue-50"><div className="flex items-center gap-2"><ShieldCheck size={17}/><span className={`${compact?'lg:hidden':''} text-xs font-bold`}>Access protected</span></div><p className={`${compact?'lg:hidden':''} mt-1 text-[11px] leading-relaxed text-blue-100`}>Only the modules approved for your role are shown.</p></div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-7 lg:px-9">
        {state.loading?<div className="animate-pulse space-y-5"><div className="h-44 rounded-[24px] bg-slate-200"/><div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i=><div key={i} className="h-24 rounded-2xl bg-slate-200"/>)}</div></div>:state.error?<section role="alert" className="rounded-2xl border border-rose-200 bg-white p-6"><h2 className="font-semibold text-rose-700">Unable to load your permissions</h2><p className="mt-2 text-sm text-slate-600">{state.error}</p><button onClick={load} className="mt-4 rounded-lg bg-[#16687b] px-4 py-2 text-sm font-bold text-white">Try again</button></section>:<>
          <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-r from-[#27547a] via-[#347ba6] to-[#48a0d2] p-6 text-white shadow-sm sm:p-8">
            <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[40px] border-white/10"/><div className="pointer-events-none absolute bottom-[-110px] right-[18%] h-56 w-56 rounded-full bg-white/5"/>
            <div className="relative flex flex-wrap items-center justify-between gap-4"><div className="max-w-xl"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em]"><Sparkles size={12}/> Office dashboard</span><h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{selected==='dashboard'?`${state.role_name || 'Office'} Dashboard`:active?.label}</h1><p className="mt-2 text-sm text-white/80">{selected==='dashboard'?'Review the applications, staff, and reports available to your office—all in one place.':active?.detail}</p><div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs"><ShieldCheck size={15}/><span className="truncate">{state.role_name}</span></div></div><span className="rounded-2xl border border-white/20 bg-white/10 p-4"><LayoutDashboard size={30}/></span></div>
          </section>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><div className="flex items-center gap-4 rounded-2xl border border-[#dae6ee] bg-white p-4 shadow-sm"><span className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><BriefcaseBusiness size={22}/></span><div><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Available sections</div><div className="text-2xl font-bold text-slate-900">{modules.length}</div></div></div><div className="flex items-center gap-4 rounded-2xl border border-[#dae6ee] bg-white p-4 shadow-sm"><span className="rounded-xl bg-violet-50 p-3 text-violet-700"><CheckCircle2 size={22}/></span><div><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Available actions</div><div className="text-2xl font-bold text-slate-900">{new Set(state.permissions).size}</div></div></div><div className="flex items-center gap-4 rounded-2xl border border-[#dae6ee] bg-white p-4 shadow-sm"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><ShieldCheck size={22}/></span><div><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Office access</div><div className="mt-1 text-sm font-bold text-emerald-700">Access ready</div></div></div></div>
          {selected==='dashboard'?<>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-900">Quick access</h2><p className="text-xs text-slate-500">Choose a section to view the records available to your office.</p></div><div className="relative w-full sm:w-64"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a section" aria-label="Find a section" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-500"/></div></div>
            {filtered.length?<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((m,i)=><article key={m.key} className="group flex flex-col rounded-2xl border border-[#dae6ee] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"><div className="flex items-start justify-between"><span className={`rounded-2xl p-3 ${i%3===0?'bg-cyan-50 text-cyan-700':i%3===1?'bg-violet-50 text-violet-700':'bg-amber-50 text-amber-700'}`}><m.icon size={23}/></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{m.actions.length} {m.actions.length===1?'grant':'grants'}</span></div><h3 className="mt-5 text-base font-bold text-slate-900">{m.label}</h3><p className="mt-1 text-[11px] font-bold text-amber-700">{workspaceModuleStatus(m.key).label}</p><p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{m.detail}</p><div className="mt-3 flex flex-wrap gap-1.5">{m.actions.slice(0,3).map(action=><span key={action} className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600">{title(action)}</span>)}{m.actions.length>3&&<span className="text-xs text-slate-400">+{m.actions.length-3}</span>}</div><button type="button" onClick={()=>choose(m.key)} className="mt-5 flex w-full items-center justify-between rounded-xl bg-[#28628a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#10495a]">Open section <ArrowRight size={16}/></button></article>)}</div>:<div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><Search size={26} className="mx-auto text-slate-400"/><h3 className="mt-3 font-semibold">{modules.length?'No matching modules':'No modules assigned yet'}</h3><p className="mt-1 text-sm text-slate-500">{modules.length?'Try another keyword.':'Contact your administrator to request access.'}</p></div>}
          </>:<section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6"><button type="button" onClick={()=>choose('dashboard')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#176a81]"><ArrowLeft size={15}/>Back to dashboard</button><div className="mt-5 flex items-start gap-4"><span className="rounded-2xl bg-cyan-50 p-4 text-cyan-700"><active.icon size={28}/></span><div><h2 className="text-xl font-extrabold text-slate-900">{active.label}</h2><p className="mt-1 text-sm text-slate-500">{active.detail}</p><p className="mt-2 text-xs font-semibold text-amber-700">{workspaceModuleStatus(active.key).label}: {workspaceModuleStatus(active.key).detail}</p></div></div><h3 className="mt-7 text-xs font-bold uppercase tracking-wider text-slate-400">What you can do</h3><div className="mt-3 flex flex-wrap gap-2">{active.actions.map(action=><span key={action} className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><CheckCircle2 size={15}/>{title(action)}</span>)}</div><WorkspaceRecords moduleKey={active.key} permissions={state.permissions}/></section>}
        </>}
      </main>
    </div>
  </div>;
}
