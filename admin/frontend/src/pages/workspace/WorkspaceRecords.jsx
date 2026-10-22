// SMARTPDM_WORKSPACE_PHASE3_REAL_DATA_V1
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, LockKeyhole, Database, AlertCircle } from 'lucide-react';
import { buildApiUrl } from '@/api';

const VIEW_PERMISSION = { accounts:'accounts.view', applications:'applications.view', payouts:'payouts.view', reports:'reports.view' };
const HEADERS = {
  accounts: [['username','Username'],['name','Name'],['department','Office']],
  applications: [['application_id','Application ID'],['application_status','Status'],['document_status','Documents'],['submission_date','Submitted']],
  payouts: [['payout_title','Payout'],['course_code','Course'],['batch_status','Status'],['payout_date','Date'],['total_amount','Scholar amount']],
};
function display(value, field) {
  if (value == null || value === '') return '—';
  if (field.includes('date')) { const d = new Date(value); if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-PH'); }
  if (field==='total_amount') return Number(value).toLocaleString('en-PH',{style:'currency',currency:'PHP'});
  return String(value);
}
export default function WorkspaceRecords({ moduleKey, permissions = [] }) {
  const required=VIEW_PERMISSION[moduleKey];
  const canRead=Boolean(required && permissions.includes(required));
  const [state,setState]=useState({busy:false,rows:[],summary:null,error:''});
  const load=useCallback(async()=>{
    if(!canRead)return;
    setState(s=>({...s,busy:true,error:''}));
    try {
      const response=await fetch(buildApiUrl('/api/workspace/data/'+encodeURIComponent(moduleKey)),{
        headers:{Authorization:'Bearer '+(sessionStorage.getItem('workspaceToken')||'')},cache:'no-store'
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||`Unable to load records (${response.status}).`);
      setState({busy:false,rows:Array.isArray(payload.items)?payload.items:[],summary:payload.summary||null,error:''});
    }catch(error){setState({busy:false,rows:[],summary:null,error:error.message||'Could not load module records.'});}
  },[moduleKey,canRead]);
  useEffect(()=>{load()},[load]);
  if(!required) return <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">This module will be connected to its scoped workflow in a later phase. No additional data has been exposed.</div>;
  if(!canRead)return <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><LockKeyhole size={18} className="mt-0.5 shrink-0"/><div><strong>View permission required.</strong><p className="mt-1">Your role does not have {required}. Other actions assigned to this module do not automatically grant access to its records.</p></div></div>;
  const fields=HEADERS[moduleKey]||[];
  return <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-6"><div><h3 className="font-bold text-slate-900">{moduleKey==='reports'?'Overview':'Office records'}</h3><p className="mt-1 text-xs text-slate-500">Showing up to 30 records from your authorized office and courses.</p></div><button type="button" onClick={load} disabled={state.busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={state.busy?'animate-spin':''}/>Refresh</button></div>
    {state.error?<p role="alert" className="m-5 flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={17}/>{state.error}</p>:state.busy?<p className="p-6 text-sm text-slate-500">Loading your permitted records…</p>:moduleKey==='reports'&&state.summary?<div className="grid gap-3 p-5 sm:grid-cols-3">{Object.entries(state.summary).map(([key,value])=><div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs capitalize text-slate-500">{key.replaceAll('_',' ')}</div><div className="mt-2 text-2xl font-bold text-slate-900">{Number(value).toLocaleString()}</div></div>)}</div>:state.rows.length?<div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{fields.map(([key,label])=><th key={key} className="whitespace-nowrap px-5 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{state.rows.map((row,i)=><tr key={row.application_id||row.payout_entry_id||row.payout_batch_id||row.user_id||i} className="hover:bg-slate-50">{fields.map(([key])=><td key={key} className="max-w-72 truncate px-5 py-3 text-slate-700" title={display(row[key],key)}>{display(row[key],key)}</td>)}</tr>)}</tbody></table></div>:<div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-slate-500"><Database size={25}/><p className="text-sm">No records available for your office.</p></div>}
    <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Read-only view. Records are restricted to your assigned office and courses.</div>
  </section>;
}
