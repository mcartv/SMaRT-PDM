import React, {useMemo,useRef,useState} from 'react';
import {UsersRound} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {useRbacPermissions} from '@/context/RbacPermissionContext';
import {buildApiUrl} from '@/api';
import {showAppToast} from '@/utils/appToast';
export default function AreaPersonnelDialog({area,candidates=[],onSaved,disabled=false}) {
    const {hasPermission}=useRbacPermissions();
    const people=useMemo(()=>area.coordinators || (area.coordinator ? [area.coordinator] : []),[area.coordinators,area.coordinator]);
    const [open,setOpen]=useState(false),[selected,setSelected]=useState([]),[original,setOriginal]=useState([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
    const [assignmentFilter,setAssignmentFilter]=useState('all');
    const [sortOrder,setSortOrder]=useState('asc');
    const lock=useRef(false);
    const options=useMemo(()=>{
        const isAssigned=person=>original.includes(person.user_id) || (person.active_areas || []).length>0;
        return [...candidates,...people.filter(person=>!candidates.some(candidate=>candidate.user_id===person.user_id)).map(person=>({...person,unavailable:true}))]
            .filter(person=>((person.name || '')+' '+(person.position || '')).toLowerCase().includes(query.trim().toLowerCase()))
            .filter(person=>assignmentFilter==='all' || (assignmentFilter==='unassigned' ? !isAssigned(person) : assignmentFilter==='current' ? original.includes(person.user_id) : (person.active_areas || []).some(item=>item.department_id!==area.department_id)))
            .sort((a,b)=>Number(isAssigned(a))-Number(isAssigned(b)) || (sortOrder==='asc'?1:-1)*(a.name || '').localeCompare(b.name || '',undefined,{sensitivity:'base',numeric:true}));
    },[candidates,people,query,original,assignmentFilter,sortOrder,area.department_id]);
    const changed=[...selected].sort().join()!==[...original].sort().join();
    async function save() {
        if(lock.current)return;lock.current=true;setBusy(true);setError('');
        try {
            const response=await fetch(buildApiUrl('/api/ro-settings/departments/'+area.department_id+'/coordinator'),{method:'PUT',headers:{Authorization:'Bearer '+sessionStorage.getItem('adminToken'),'Content-Type':'application/json'},body:JSON.stringify({user_ids:selected,expected_user_ids:original})});
            const payload=await response.json();if(!response.ok)throw Error(payload.error || 'Unable to update Personnel-In-Charge.');
            showAppToast('success','Personnel-In-Charge updated');setOpen(false);onSaved?.();
        }catch(err){setError(err.message);showAppToast('error','Unable to update assignments',err.message);}
        finally{lock.current=false;setBusy(false);}
    }
    if(!hasPermission('ro.settings_manage'))return null;
    return <><Button variant="outline" size="sm" disabled={disabled} className="h-7 gap-1.5 rounded-lg border-stone-200 px-2 text-xs" onClick={()=>{setOriginal(people.map(p=>p.user_id));setSelected(people.filter(p=>!p.is_archived && candidates.some(candidate=>candidate.user_id===p.user_id)).map(p=>p.user_id));setQuery('');setAssignmentFilter('all');setSortOrder('asc');setError('');setOpen(true);}}><UsersRound className="size-3.5"/>Personnel ({people.filter(p=>!p.is_archived).length})</Button>
        <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={!busy}>
            <DialogHeader className="shrink-0 border-b p-4 pr-12"><DialogTitle>Assign Personnel-In-Charge</DialogTitle><DialogDescription className="break-words">{area.department_name}</DialogDescription></DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4" style={{overflowY:'auto',overflowX:'hidden'}}>
                <p className="text-xs text-muted-foreground">Select the people who can process requests for this area. Each person can access only the scholars assigned to their own requests. Each decision records its processor.</p>
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <Input aria-label="Search personnel" placeholder="Search by name or position..." value={query} onChange={e=>setQuery(e.target.value)} disabled={busy}/>
                <div className="grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                    <label className="min-w-0 space-y-1 text-xs text-muted-foreground"><span className="block">Assignment</span><select aria-label="Filter personnel by assignment" value={assignmentFilter} disabled={busy} onChange={event=>setAssignmentFilter(event.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-foreground"><option value="all">All accounts</option><option value="unassigned">Unassigned</option><option value="current">Assigned to this area</option><option value="other">Assigned elsewhere</option></select></label>
                    <label className="min-w-0 space-y-1 text-xs text-muted-foreground"><span className="block">Sort by name</span><select aria-label="Sort personnel by name" value={sortOrder} disabled={busy} onChange={event=>setSortOrder(event.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-foreground"><option value="asc">A to Z</option><option value="desc">Z to A</option></select></label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{selected.length} selected</span><span>{options.length} shown accounts</span></div>
                <div role="group" aria-label="Available Personnel-In-Charge" tabIndex={0} className="min-h-0 shrink-0 space-y-1 rounded-lg border p-2" style={{maxHeight:'min(20rem, 40dvh)',overflowY:'scroll',overflowX:'hidden',scrollbarGutter:'stable',scrollbarWidth:'auto',scrollbarColor:'#a8a29e #f5f5f4',overscrollBehavior:'contain'}}>{options.map(person=>{const assigned=(person.active_areas || []).filter(item=>item.department_id!==area.department_id);const rowDisabled=busy || person.unavailable || (assigned.length>0 && !selected.includes(person.user_id));return <label key={person.user_id} aria-disabled={rowDisabled} className={`flex items-start gap-3 rounded-md border p-2 ${rowDisabled ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-500' : 'cursor-pointer border-transparent hover:bg-muted'}`}><input type="checkbox" name="area-personnel" className="mt-1 shrink-0" disabled={rowDisabled} checked={selected.includes(person.user_id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,person.user_id]:ids.filter(id=>id!==person.user_id))}/><span className="min-w-0 break-words text-sm [overflow-wrap:anywhere]"><span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium"><span className="min-w-0 break-words">{person.name}</span>{rowDisabled && <span className="shrink-0 rounded border border-stone-300 bg-stone-200/70 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">Not available</span>}</span><span className="block text-xs text-muted-foreground">{person.position}{person.unavailable ? ' (Unavailable)' : ''}</span>{assigned.length>0 && <span className={`block text-xs ${rowDisabled ? 'text-stone-500' : 'text-amber-700'}`}>Assigned to {assigned.map(item=>item.department_name).join(', ')}</span>}</span></label>})}{!options.length && <p className="p-3 text-sm text-muted-foreground">No matching accounts.</p>}</div>
                <p className="text-xs text-muted-foreground">Unassigned accounts appear first; assigned PICs appear last. You can select multiple people.</p>
            </div>
            <DialogFooter className="m-0 shrink-0 flex-row flex-wrap rounded-none p-4"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy || !changed} style={{background:'var(--portal-base)',color:'white'}} onClick={save}>{busy?'Saving...':'Save assignments'}</Button></DialogFooter>
        </DialogContent></Dialog></>;
}
