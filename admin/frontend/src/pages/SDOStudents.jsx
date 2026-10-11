import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRbacPermissions } from '@/context/RbacPermissionContext';
import SDOScholarList, { SDOScholarSummary } from './SDOScholarList';
import SDODisciplinaryCases from './SDODisciplinaryCases';

export default function SDOStudents() {
  const { hasPermission } = useRbacPermissions();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [summary, setSummary] = useState({ total: 0, clear: 0, minor: 0, major: 0 });
  const views = [
    ...(hasPermission('students.view') ? [{ value: 'scholars', label: 'Scholar List' }] : []),
    ...(hasPermission('discipline.manage') ? [{ value: 'cases', label: 'Disciplinary Records' }] : []),
  ];
  const requestedView = params.get('view') === 'import' ? 'cases' : params.get('view');
  const view = views.find(item => item.value === requestedView)?.value || views[0]?.value;
  if (!view) return <p className="p-6">You do not have access to student records.</p>;

  return <div className="min-w-0 max-w-full space-y-5 py-2">
    <div><h1 className="text-2xl font-semibold">Student Records</h1>
      <p className="mt-1 text-sm text-muted-foreground">View scholarship recipients and manage student disciplinary records.</p>
    </div>
    {view === 'scholars' && <SDOScholarSummary stats={summary} />}
    <Tabs className="min-w-0" value={view} onValueChange={value => { setParams({ view: value }); setSearch(''); setFiltersOpen(false); }}>
      <div className="flex flex-col gap-3 rounded-[22px] border bg-card p-4 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search student records" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by student name or PDM ID..." className="h-10 rounded-xl pl-9" />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:ml-auto">
          <TabsList aria-label="Student record views" style={{ height: 'auto' }} className="w-full max-w-full flex-wrap gap-1 rounded-xl p-1 sm:w-auto">
            {views.map(item => <TabsTrigger key={item.value} value={item.value} style={{ minHeight: 40, height: 'auto' }} className="min-w-0 whitespace-normal rounded-lg px-3 py-2 text-center leading-snug">{item.label}</TabsTrigger>)}
          </TabsList>
          <Button variant="outline" aria-expanded={filtersOpen} aria-controls={`${view}-filters`} onClick={() => setFiltersOpen(value => !value)} className="h-10 rounded-xl"><SlidersHorizontal className="size-4" />Filters</Button>
        </div>
      </div>
      {hasPermission('students.view') && <TabsContent value="scholars" forceMount hidden={view !== 'scholars'}><SDOScholarList embedded onSummaryChange={setSummary} searchValue={view === 'scholars' ? search : ''} filtersOpen={filtersOpen && view === 'scholars'} /></TabsContent>}
      {hasPermission('discipline.manage') && <TabsContent value="cases" forceMount hidden={view !== 'cases'}><SDODisciplinaryCases embedded search={view === 'cases' ? search : ''} filtersOpen={filtersOpen && view === 'cases'} /></TabsContent>}
    </Tabs>
  </div>;
}
