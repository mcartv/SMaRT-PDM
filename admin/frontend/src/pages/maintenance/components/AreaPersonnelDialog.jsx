import React, {useMemo,useRef,useState} from 'react';
import {UsersRound} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {useRbacPermissions} from '@/context/RbacPermissionContext';
import {buildApiUrl} from '@/api';
import {showAppToast} from '@/utils/appToast';
export default function AreaPersonnelDialog({area,candidates,onSaved,disabled=false}) {
    const {hasPermission}=useRbacPermissions();
    const people=useMemo(()=>area.coordinators || (area.coordinator ? [area.coordinator] : []),[area.coordinators,area.coordinator]);
    const [open,setOpen]=useState(false),[selected,setSelected]=useState([]),[original,setOriginal]=useState([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
    const lock=useRef(false);
    const options=useMemo(()=>[...candidates,...people.filter(person=>!candidates.some(candidate=>candidate.user_id===person.user_id)).map(person=>({...person,unavailable:true}))].filter(person=>(person.name+' '+person.position).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name)),[candidates,people,query]);
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
    return <><Button variant="outline" size="sm" disabled={disabled} className="h-7 gap-1.5 rounded-lg border-stone-200 px-2 text-xs" onClick={()=>{setOriginal(people.map(p=>p.user_id));setSelected(people.filter(p=>!p.is_archived && candidates.some(candidate=>candidate.user_id===p.user_id)).map(p=>p.user_id));setQuery('');setError('');setOpen(true);}}><UsersRound className="size-3.5"/>Personnel ({people.filter(p=>!p.is_archived).length})</Button>
        <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={!busy}>
            <DialogHeader className="shrink-0 border-b p-4 pr-12"><DialogTitle>Assign Personnel-In-Charge</DialogTitle><DialogDescription className="break-words">{area.department_name}</DialogDescription></DialogHeader>
            <div className="min-h-0 space-y-3 overflow-y-auto p-4">
                <p className="text-xs text-muted-foreground">Select the people who can process requests for this area. Each person can access only the scholars assigned to their own requests. Each decision records its processor.</p>
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <Input aria-label="Search personnel" placeholder="Search by name or position..." value={query} onChange={e=>setQuery(e.target.value)} disabled={busy}/>
                <p className="text-xs text-muted-foreground">{selected.length} selected</p>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">{options.map(person=><label key={person.user_id} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted"><input type="checkbox" name="area-personnel" className="mt-1 shrink-0" disabled={busy || person.unavailable} checked={selected.includes(person.user_id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,person.user_id]:ids.filter(id=>id!==person.user_id))}/><span className="min-w-0 break-words text-sm"><span className="block font-medium">{person.name}</span><span className="block text-xs text-muted-foreground">{person.position}{person.unavailable ? ' (Unavailable)' : ''}</span></span></label>)}{!options.length && <p className="p-3 text-sm text-muted-foreground">No matching accounts.</p>}</div>
            </div>
            <DialogFooter className="m-0 shrink-0 flex-row flex-wrap rounded-none p-4"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy || !changed} style={{background:'var(--portal-base)',color:'white'}} onClick={save}>{busy?'Saving...':'Save assignments'}</Button></DialogFooter>
        </DialogContent></Dialog></>;
}
