import React,{useState} from 'react';
import {SlidersHorizontal} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
export default function MaintenanceFilters({title,fields,value,onChange}) {
 const [open,setOpen]=useState(false),[draft,setDraft]=useState({});
 const count=Object.values(value).filter(Boolean).length;
 return <><Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg border-stone-200 text-xs" onClick={()=>{setDraft({...value});setOpen(true);}}><SlidersHorizontal className="size-3.5"/>Filters{count>0 && <span className="rounded-full bg-stone-100 px-1.5 text-[10px]">{count}</span>}</Button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-md"><DialogHeader className="shrink-0 border-b p-4 pr-12"><DialogTitle>{title}</DialogTitle><DialogDescription>Refine the current list. Search and status tabs still apply.</DialogDescription></DialogHeader>
 <div className="min-h-0 space-y-4 p-4" style={{overflowY:'auto',overflowX:'hidden'}}>{fields.map(field=><label key={field.key} className="block min-w-0 space-y-1.5 text-xs font-medium"><span>{field.label}</span><select aria-label={field.label} value={draft[field.key] || ''} onChange={event=>setDraft(previous=>({...previous,[field.key]:event.target.value}))} className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm font-normal"><option value="">All</option>{field.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div>
 <DialogFooter className="m-0 shrink-0 flex-row flex-wrap rounded-none p-4"><Button variant="outline" onClick={()=>setDraft({})}>Clear filters</Button><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button style={{background:'var(--portal-base)',color:'white'}} onClick={()=>{onChange(draft);setOpen(false);}}>Apply filters</Button></DialogFooter></DialogContent></Dialog></>;
}
