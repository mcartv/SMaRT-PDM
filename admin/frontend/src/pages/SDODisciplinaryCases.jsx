import { useCallback, useEffect, useRef, useState } from 'react';
import { buildApiUrl } from '@/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import StudentRecordsPagination from '@/components/StudentRecordsPagination';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRbacPermissions } from '@/context/RbacPermissionContext';
import { useSocketEvent } from '@/hooks/useSocket';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getImportPreviewPage } from '@/utils/sdoImportPreview';
import { validateSdoImportFile, buildImportIssuesCsv } from '@/utils/sdoImportFile';
import { Upload, Download, Loader2, X, Pencil, Inbox, FileUp } from 'lucide-react';

const PAGE_SIZE = 20;

function downloadCsv(name, content) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  toast.success('Download started', { description: name });
}

function RecordCards({ rows, preview = false, onEdit }) {
  return <div className="space-y-3 md:hidden">
    {rows.map(row => <div key={preview ? row.row_number : row.record_id} className="min-w-0 rounded-xl border p-3">
      <p className="break-words font-medium">{[row.first_name, row.last_name].filter(Boolean).join(' ') || row.student_number || 'Missing Student Number'}</p>
      <p className="mt-1 break-all text-xs text-muted-foreground">{row.student_number}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {[['Course', row.course_code], ['Year Level', row.year_level], ['Offense', row.offense_type], ['Incident Date', row.offense_incident_date]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value || '—'}</dd></div>)}
      </dl>
      {!preview && row.remarks && <div className="mt-3 text-sm"><p className="text-xs text-muted-foreground">Remarks</p><p className="mt-1 break-words">{row.remarks}</p></div>}
      {preview && <p className={`mt-3 break-words rounded-lg p-2 text-xs ${row.status === 'ready' ? 'bg-muted text-foreground' : 'bg-destructive/10 text-destructive'}`}>Row {row.row_number}: {row.reason}</p>}
      {onEdit && <Button variant="outline" className="mt-3" onClick={() => onEdit(row)}><Pencil className="size-4" />Edit record</Button>}
    </div>)}
    {!rows.length && <p className="py-6 text-center text-sm text-muted-foreground">No records match your search or filters.</p>}
  </div>;
}

function PageControls({ page, total, rowCount, onPageChange, disabled = false, label }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-xs text-muted-foreground">Showing {rowCount ? page * PAGE_SIZE + 1 : 0}–{rowCount ? page * PAGE_SIZE + rowCount : 0} of {total} {label}</p>
    <StudentRecordsPagination page={page + 1} totalPages={totalPages} disabled={disabled} onPageChange={next => onPageChange(next - 1)} />
  </div>;
}

function OffenseFilter({ value, onChange, id }) {
  return <div className="min-w-0 space-y-2">
    <label className="text-sm font-medium" htmlFor={id}>Offense</label>
    <Select value={value} onValueChange={onChange}><SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent>
      <SelectItem value="all">All Offenses</SelectItem>
      {['No Offense', 'Minor Offense', 'Major Offense'].map(offense => <SelectItem key={offense} value={offense}>{offense}</SelectItem>)}
    </SelectContent></Select>
  </div>;
}

async function request(path, options = {}) {
  const response = await fetch(buildApiUrl(`/api/student-registry/disciplinary${path}`), {
    ...options,
    headers: { Authorization: `Bearer ${sessionStorage.getItem('sdoToken')}`, ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to load disciplinary cases.');
  return data;
}

export default function SDODisciplinaryCases({ embedded = false, search = '', filtersOpen = false }) {
  const { hasPermission } = useRbacPermissions();
  const allowed = hasPermission('discipline.manage');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [records, setRecords] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(0);
  const [offense, setOffense] = useState('all');
  const [previewPage, setPreviewPage] = useState(0);
  const [previewOffense, setPreviewOffense] = useState('all');
  const [previewStatus, setPreviewStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);
  const fileRequestVersion = useRef(0);
  const requestVersion = useRef(0);
  const previewData = getImportPreviewPage(preview?.rows || [], {
    search, offense: previewOffense, status: previewStatus, page: previewPage, pageSize: PAGE_SIZE,
  });
  const caseSearch = search;

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const query = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: caseSearch, offense });
      const data = await request(`?${query}`);
      if (version === requestVersion.current) { setRecords(data); }
    } catch (err) { if (version === requestVersion.current) toast.error('Unable to load disciplinary records', { id: 'sdo-records-load-error', description: err.message }); }
  }, [page, caseSearch, offense]);
  useSocketEvent('scholar:updated', () => load(), [load]);

  useEffect(() => { setPage(0); }, [caseSearch, offense]);
  useEffect(() => { setPreviewPage(0); }, [search, previewOffense, previewStatus, preview]);
  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(records.total / PAGE_SIZE) - 1);
    if (page > lastPage) setPage(lastPage);
  }, [records.total, page]);

  useEffect(() => {
    if (allowed) void load();
    return () => { requestVersion.current++; };
  }, [allowed, load]);

  async function importSelectedFile() {
    if (!file || !allowed || busy) return;
    const fileError = validateSdoImportFile(file);
    if (fileError) { toast.error('Unable to import file', { description: fileError }); return; }
    setBusy(true);
    setOperation('import');
    const body = new FormData();
    body.append('file', file);
    try {
      const data = await request('/import', { method: 'POST', body });
        const skippedRows = [
          ...(data.invalid_rows || []).map(row => ({ ...row, status: 'invalid' })),
          ...(data.unmatched_rows || []).map(row => ({ ...row, status: 'unmatched', reason: 'Student ID was not found in the Student Registry.' })),
          ...(data.duplicate_details || []).map(row => ({ ...row, status: 'duplicate' })),
        ];
        const skipped = (data.duplicate_rows || 0) + (data.invalid_rows?.length || 0) + (data.unmatched_rows?.length || 0);
        toast[skipped ? 'warning' : 'success'](skipped ? 'Import completed with issues' : 'Disciplinary records imported', {
          description: `${data.added || 0} students added, ${data.updated || 0} updated${skipped ? `, ${skipped} rows skipped` : ''}.`,
          ...(skippedRows.length ? { action: { label: 'Download skipped rows', onClick: () => downloadCsv('SDO-import-issues.csv', buildImportIssuesCsv(skippedRows)) } } : {}),
        });
        setPreview(null);
        setFile(null);
        setImportOpen(false);
        if (fileInput.current) fileInput.current.value = '';
        await load();
    } catch (err) { toast.error('Disciplinary import failed', { description: err.message }); }
    finally { setBusy(false); }
  }

  async function chooseFile(nextFile) {
    if (busy) return;
    const version = ++fileRequestVersion.current;
    setPreview(null);
    const message = validateSdoImportFile(nextFile);
    setFile(message ? null : nextFile);
    setPreviewOffense('all');
    setPreviewStatus('all');
    if (message) { toast.error('Unable to read file', { description: message }); return; }
    if (!nextFile) return;
    setBusy(true);
    setOperation('preview');
    const body = new FormData();
    body.append('file', nextFile);
    try {
      const data = await request('/preview', { method: 'POST', body });
      if (version === fileRequestVersion.current) {
        setPreview(data);
        toast.success('Import preview ready', { description: `${data.counts.ready} of ${data.counts.total} rows are ready to import.` });
      }
    } catch (err) { if (version === fileRequestVersion.current) toast.error('Unable to preview file', { description: err.message }); }
    finally { if (version === fileRequestVersion.current) setBusy(false); }
  }

  function openEdit(row) {
    setEditing({ ...row, course_code: row.course_code || '', year_level: String(row.year_level || ''), offense_incident_date: row.offense_incident_date || '', remarks: row.remarks || '' });
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    try {
      await request(`/${editing.record_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        course_code: editing.course_code, year_level: editing.year_level,
        offense_type: editing.offense_type, offense_incident_date: editing.offense_incident_date, remarks: editing.remarks,
      }) });
      setEditing(null);
      toast.success('Disciplinary record updated', { description: editing.student_number });
      await load();
    } catch (err) { toast.error('Unable to update disciplinary record', { description: err.message }); }
    finally { setSaving(false); }
  }

  if (!allowed) return <p className="p-6 text-muted-foreground">You do not have access to disciplinary cases.</p>;

  return (
    <div className={`min-w-0 max-w-full space-y-6 text-foreground ${embedded ? '' : 'p-4 sm:p-6'}`}>
      {!embedded && <div>
        <h1 className="text-2xl font-semibold">Disciplinary Records</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage disciplinary standing for students, including those without scholarships.</p>
      </div>}
      {preview && <Card>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Import preview</h2><Button variant="outline" disabled={busy} onClick={() => { setPreview(null); setFile(null); }}>Dismiss preview</Button></div></CardHeader>
        <CardContent className="min-w-0 space-y-4">
          {filtersOpen && <div id="import-filters" className="grid gap-3 sm:grid-cols-2">
            <OffenseFilter id="import-offense-filter" value={previewOffense} onChange={setPreviewOffense} />
            {preview && <div className="space-y-2">
              <label htmlFor="import-status-filter" className="text-sm font-medium">Import result</label>
              <Select value={previewStatus} onValueChange={setPreviewStatus}><SelectTrigger id="import-status-filter"><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                {[['ready', 'Ready to Import'], ['duplicate', 'Duplicates'], ['invalid', 'Invalid Rows'], ['unmatched', 'Unmatched Students']].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent></Select>
            </div>}
          </div>}
          {preview && <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[['ready', 'Ready'], ['duplicate', 'Duplicates'], ['invalid', 'Invalid'], ['unmatched', 'Unmatched']].map(([status, label]) => <button key={status} type="button" onClick={() => setPreviewStatus(value => value === status ? 'all' : status)} aria-pressed={previewStatus === status} className={`min-w-0 rounded-xl border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${previewStatus === status ? 'bg-muted' : 'bg-card'}`}><span className="text-xs text-muted-foreground">{label}</span><span className="mt-1 block text-xl font-semibold">{preview.counts[status]}</span></button>)}
            </div>
            <RecordCards rows={previewData.rows} preview />
            <div className="hidden max-h-96 min-w-0 overflow-auto rounded-lg border md:block">
              <Table><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Student Number</TableHead><TableHead>Course</TableHead><TableHead>Year Level</TableHead><TableHead>Offense</TableHead><TableHead>Incident Date</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
                <TableBody>{previewData.rows.map(row => <TableRow key={row.row_number}><TableCell>{row.row_number}</TableCell><TableCell>{row.student_number}</TableCell><TableCell>{row.course_code || '—'}</TableCell><TableCell>{row.year_level || '—'}</TableCell><TableCell>{row.offense_type}</TableCell><TableCell>{row.offense_incident_date || '—'}</TableCell><TableCell className="min-w-48 whitespace-normal">{row.reason}</TableCell></TableRow>)}
                  {!previewData.rows.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No preview rows match your search or filters.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <PageControls page={previewData.page} total={previewData.total} rowCount={previewData.rows.length} onPageChange={setPreviewPage} disabled={busy} label="preview rows" />
            <p className="text-xs text-muted-foreground">Search and filters affect the preview. Import processes all ready rows in the file.</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button className="h-auto min-h-10 whitespace-normal py-2" disabled={!file || busy} onClick={() => setImportOpen(true)}>Continue import</Button>
              <Button variant="outline" className="h-auto min-h-10 whitespace-normal py-2" disabled={busy || !preview.rows.some(row => row.status !== 'ready')} onClick={() => downloadCsv('SDO-import-issues.csv', buildImportIssuesCsv(preview.rows))}><Download className="size-4" />Download skipped rows</Button>
            </div>
          </>}
        </CardContent>
      </Card>}
      <Card>
        <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">Disciplinary Records ({records.total})</h2><p className="mt-1 text-sm text-muted-foreground">Student offenses, incident dates, and remarks.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => { setImportOpen(true); }}><Upload className="size-4" />Import</Button><Button variant="outline" onClick={() => downloadCsv('SDO-import-template.csv', 'Student Number,Offense Type,Course,Year Level,Incident Date,Remarks\r\n')}><Download className="size-4" />Download template</Button></div></div></CardHeader>
        <CardContent className="space-y-4">
          {filtersOpen && <div id="cases-filters" className="max-w-sm">
            <OffenseFilter id="offense-filter" value={offense} onChange={setOffense} />
          </div>}
          <RecordCards rows={records.items} onEdit={openEdit} />
          <div className="hidden min-w-0 overflow-x-auto md:block">
            <Table><TableHeader><TableRow><TableHead>Student Number</TableHead><TableHead>Student</TableHead><TableHead>Course</TableHead><TableHead>Year Level</TableHead><TableHead>Offense</TableHead><TableHead>Incident Date</TableHead><TableHead>Remarks</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
              <TableBody>{records.items.map(row => <TableRow key={row.record_id}><TableCell>{row.student_number}</TableCell><TableCell>{[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}</TableCell><TableCell>{row.course_code || '—'}</TableCell><TableCell>{row.year_level || '—'}</TableCell><TableCell>{row.offense_type}</TableCell><TableCell>{row.offense_incident_date || '—'}</TableCell><TableCell className="max-w-64 whitespace-normal break-words">{row.remarks || '—'}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => openEdit(row)}><Pencil className="size-4" />Edit</Button></TableCell></TableRow>)}
                {!records.items.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No disciplinary records found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <PageControls page={page} total={records.total} rowCount={records.items.length} onPageChange={setPage} disabled={busy} label="records" />
        </CardContent>
      </Card>
      <Dialog open={importOpen} onOpenChange={open => { if (!busy) setImportOpen(open); }}>
        <DialogContent showCloseButton={false} aria-busy={busy} overlayClassName="bg-black/35 backdrop-blur-sm" className="min-w-0 max-h-[calc(100dvh-2rem)] grid-cols-1 gap-0 overflow-x-hidden overflow-y-auto rounded-2xl border p-0 shadow-xl sm:max-w-xl">
          <DialogHeader className="min-w-0 flex-row items-center justify-between border-b bg-muted/30 px-4 py-4 sm:px-5">
            <DialogTitle className="min-w-0 break-words text-sm font-semibold">Import disciplinary records</DialogTitle>
            <DialogDescription className="sr-only">Upload an Excel or CSV file to preview and import disciplinary records.</DialogDescription>
            <Button variant="ghost" size="icon-sm" aria-label="Close import" disabled={busy} onClick={() => setImportOpen(false)} className="shrink-0 text-muted-foreground"><X className="size-4" /></Button>
          </DialogHeader>
          <div className="min-w-0 space-y-4 p-4 sm:p-5">
            <input ref={fileInput} aria-label="Disciplinary records file" type="file" accept=".xlsx,.csv" disabled={busy} className="hidden" onChange={event => chooseFile(event.target.files?.[0])} />
            <button type="button" disabled={busy} onClick={() => { if (fileInput.current) { fileInput.current.value = ''; fileInput.current.click(); } }} onDragOver={event => { event.preventDefault(); if (!busy) setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={event => { event.preventDefault(); setIsDragging(false); if (!busy) chooseFile(event.dataTransfer.files?.[0]); }} className={`w-full rounded-2xl border-2 border-dashed p-6 text-center transition-colors disabled:cursor-wait sm:p-8 ${isDragging ? 'border-primary bg-muted' : 'border-border bg-muted/30 hover:bg-muted/50'}`}>
              <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border bg-background"><Inbox className="size-5 text-muted-foreground" /></span>
              <span className="block text-sm font-medium">Drag and drop disciplinary file</span>
              <span className="mt-1 block text-xs text-muted-foreground">or click to browse</span>
              <span className="mt-3 block text-[11px] text-muted-foreground">Accepted: .xlsx, .csv</span>
            </button>
            {file && <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
              <div className="min-w-0 text-xs"><p className="break-all font-medium">{file.name}</p><span className="block text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span></div>
              <Button variant="ghost" size="icon-sm" aria-label="Remove file" disabled={busy} onClick={() => { setFile(null); setPreview(null); if (fileInput.current) fileInput.current.value = ''; }} className="shrink-0 text-muted-foreground"><X className="size-4" /></Button>
            </div>}
            {busy && operation === 'preview' && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading file preview...</p>}
            <div className="flex min-w-0 items-start gap-2 rounded-xl border bg-muted/30 px-4 py-3">
              <FileUp className="mt-1 size-4 shrink-0 text-muted-foreground" /><p className="min-w-0 break-words text-xs leading-6 text-muted-foreground">Upload a .xlsx or .csv disciplinary file. The selected file will be previewed before import.</p>
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 min-w-0 flex-row flex-wrap justify-end rounded-none border-t bg-muted/30 px-4 py-4 sm:px-5">
            <Button variant="outline" className="h-8 rounded-lg text-xs" disabled={busy} onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button className="h-8 rounded-lg text-xs" disabled={!file || busy || !preview} onClick={importSelectedFile}><Upload className="size-3.5" />{busy && operation === 'import' ? 'Importing' : 'Import'}</Button>
          </DialogFooter>
          {busy && operation === 'import' && <div role="status" aria-live="polite" className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-background/95 px-6 text-center">
            <Loader2 className="mb-4 size-9 animate-spin text-primary" /><p className="text-sm font-semibold">Importing disciplinary records</p><p className="mt-1 max-w-full break-all text-xs text-muted-foreground">{file?.name}</p><p className="mt-3 text-xs text-muted-foreground">Please keep this window open while the records are processed.</p>
          </div>}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open && !saving) setEditing(null); }}>
        <DialogContent className="min-w-0 max-h-[calc(100dvh-2rem)] grid-cols-1 overflow-x-hidden overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Edit disciplinary record</DialogTitle><DialogDescription>{editing?.student_number}</DialogDescription></DialogHeader>
          {editing && <form onSubmit={saveEdit} className="min-w-0 space-y-4">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 [&>div]:min-w-0">
              <div className="space-y-2"><label htmlFor="edit-course" className="text-sm font-medium">Course</label><Select value={editing.course_code} disabled={saving} onValueChange={value => setEditing(row => ({ ...row, course_code: value }))}><SelectTrigger id="edit-course" className="w-full"><SelectValue placeholder="Select course" /></SelectTrigger><SelectContent>{(records.course_options || []).map(course => <SelectItem key={course.course_code} value={course.course_code}>{course.course_code}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><label htmlFor="edit-year" className="text-sm font-medium">Year Level</label><Select value={editing.year_level} disabled={saving} onValueChange={value => setEditing(row => ({ ...row, year_level: value }))}><SelectTrigger id="edit-year" className="w-full"><SelectValue placeholder="Select year level" /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6].map(year => <SelectItem key={year} value={String(year)}>Year {year}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><label htmlFor="edit-offense" className="text-sm font-medium">Offense</label><Select value={editing.offense_type} disabled={saving} onValueChange={value => setEditing(row => ({ ...row, offense_type: value }))}><SelectTrigger id="edit-offense" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{['No Offense', 'Minor Offense', 'Major Offense'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><label htmlFor="edit-incident" className="text-sm font-medium">Incident Date</label><Input id="edit-incident" type="date" min={records.incident_date_bounds?.earliest} max={records.incident_date_bounds?.today} value={editing.offense_incident_date} disabled={saving} onChange={event => setEditing(row => ({ ...row, offense_incident_date: event.target.value }))} /></div>
            </div>
            <div className="space-y-2"><label htmlFor="edit-remarks" className="text-sm font-medium">Remarks</label><Textarea id="edit-remarks" value={editing.remarks} disabled={saving} onChange={event => setEditing(row => ({ ...row, remarks: event.target.value }))} /></div>
            <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Save changes</Button></DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
