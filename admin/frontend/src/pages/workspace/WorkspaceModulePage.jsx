import React from 'react';
import { Navigate, useOutletContext, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import DepartmentSettingsPage from '@/components/department/DepartmentSettingsPage';
import ROCoordinatorQueue from '../ROCoordinatorQueue';
import WorkspaceRecords from './WorkspaceRecords';
const CONNECTED=new Set(['applications','accounts','payouts','reports']);
export default function WorkspaceModulePage(){
 const {moduleKey}=useParams();const {modules,permissions,has_ro_coordinator_access}=useOutletContext();const current=modules.find(m=>m.key===moduleKey);
 if(!current)return <Navigate to="/workspace/dashboard" replace/>;
 if(moduleKey==='ro' && has_ro_coordinator_access)return <ROCoordinatorQueue tokenStorageKey="workspaceToken" portalKey="admin"/>;
 if(moduleKey==='settings' && permissions.includes('settings.view'))return <DepartmentSettingsPage portalKey="workspace" tokenStorageKey="workspaceToken" showTheme={false}/>;
 const Icon=current.icon;
 return <div className="space-y-5"><div className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-sm"><div className="flex items-center gap-4"><span className="rounded-xl bg-stone-100 p-3 text-[var(--portal-base)]"><Icon size={24}/></span><div><p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Office Module</p><h1 className="text-2xl font-bold text-stone-900">{current.label}</h1><p className="mt-1 text-sm text-stone-500">{current.detail}</p></div></div></div>
 {CONNECTED.has(moduleKey)?<WorkspaceRecords moduleKey={moduleKey} permissions={permissions}/>:<Card className="rounded-xl border-stone-200 shadow-none"><CardContent className="p-6"><h2 className="font-semibold">Module not yet available</h2><p className="mt-2 text-sm text-stone-500">This office feature has not been connected to its records. No additional access is provided.</p></CardContent></Card>}
 </div>;
}
