import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowRight, ClipboardList, ShieldCheck, UsersRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function WorkspaceHome(){
 const {role_name,modules,permissions}=useOutletContext();const navigate=useNavigate();
 return <div className="space-y-6">
   <div className="rounded-2xl border border-stone-200 bg-white px-6 py-6 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-widest text-[var(--portal-base)]">Office Dashboard</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Welcome, {role_name}</h1><p className="mt-2 text-sm text-stone-500">Access the scholarship records and services assigned to your office.</p></div>
   <div className="grid gap-4 sm:grid-cols-3">{[[ClipboardList,'Office modules',modules.length],[ShieldCheck,'Access status','Active'],[UsersRound,'Office access','Assigned']].map(([Icon,label,value])=><Card key={label} className="rounded-2xl border-stone-200 shadow-none"><CardContent className="flex items-center gap-3 p-5"><span className="rounded-xl bg-stone-100 p-3 text-[var(--portal-base)]"><Icon size={19}/></span><div><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-xl font-bold text-stone-900">{value}</p></div></CardContent></Card>)}</div>
   <div><h2 className="text-lg font-bold text-stone-900">Your Office Modules</h2><p className="mt-1 text-xs text-stone-500">Modules are shown according to the access assigned by the administrator.</p></div>
   {modules.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{modules.map(m=><Card key={m.key} className="rounded-2xl border-stone-200 shadow-none transition hover:border-[var(--portal-base)]"><CardContent className="flex h-full flex-col p-5"><span className="w-fit rounded-xl bg-stone-100 p-3 text-[var(--portal-base)]"><m.icon size={21}/></span><h3 className="mt-4 text-base font-bold text-stone-900">{m.label}</h3><p className="mt-1 flex-1 text-sm leading-6 text-stone-500">{m.detail}</p><button className="mt-5 flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-semibold text-[var(--portal-base)] hover:bg-stone-50" onClick={()=>navigate('/workspace/'+m.key)}>Open {m.label}<ArrowRight size={16}/></button></CardContent></Card>)}</div>:<div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">No office modules assigned. Please contact your administrator.</div>}
 </div>;
}
