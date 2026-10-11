import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export default function StudentRecordsPagination({ page, totalPages, onPageChange, disabled = false }) {
  return <nav aria-label="Student records pagination" className="flex flex-wrap items-center gap-2">
    <Button type="button" variant="outline" className="size-8 shrink-0 rounded-lg p-0" aria-label="Previous page" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="size-4" /></Button>
    <span aria-current="page" className="flex h-8 min-w-8 items-center justify-center rounded-lg border bg-background px-2 text-xs">{page}</span>
    <Button type="button" variant="outline" className="size-8 shrink-0 rounded-lg p-0" aria-label="Next page" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight className="size-4" /></Button>
    <Select value={String(page)} onValueChange={value => onPageChange(Number(value))} disabled={disabled}>
      <SelectTrigger aria-label="Go to page" className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{Array.from({ length: totalPages }, (_, index) => index + 1).map(number => <SelectItem key={number} value={String(number)}>Page {number}</SelectItem>)}</SelectContent>
    </Select>
  </nav>;
}
