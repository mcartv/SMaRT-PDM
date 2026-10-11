import { useId, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Mount on opening so Cancel/closing discards the draft without changing results.
export default function StudentRecordsFilterModal({ title, fields, values, onApply, onClose }) {
  const [draft, setDraft] = useState(values);
  const id = useId();
  return <Dialog open onOpenChange={open => !open && onClose()}>
    <DialogContent showCloseButton className="min-w-0 max-h-[calc(100dvh-2rem)] grid-cols-1 gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-lg">
      <DialogHeader className="border-b bg-muted/30 p-4 pr-14 sm:p-5 sm:pr-14">
        <DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="size-4 shrink-0" />{title}</DialogTitle>
        <DialogDescription>Choose filters, then apply them to update the results.</DialogDescription>
      </DialogHeader>
      <form className="min-w-0" onSubmit={event => { event.preventDefault(); onApply(draft); onClose(); }}>
        <div className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          {fields.map(field => <div key={field.key} className="min-w-0 space-y-2">
            <label htmlFor={`${id}-${field.key}`} className="text-sm font-medium">{field.label}</label>
            <Select value={draft[field.key]} onValueChange={value => setDraft(current => ({ ...current, [field.key]: value }))}>
              <SelectTrigger id={`${id}-${field.key}`} className="w-full min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>{field.options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>)}
        </div>
        <DialogFooter className="mx-0 mb-0 flex-row flex-wrap justify-between rounded-none p-4 sm:justify-between sm:p-5">
          <Button type="button" variant="ghost" onClick={() => setDraft(Object.fromEntries(fields.map(field => [field.key, field.defaultValue])))}>Reset</Button>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Apply filters</Button></div>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
