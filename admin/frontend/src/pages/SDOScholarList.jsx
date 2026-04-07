import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = 'http://localhost:5000/api';
const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'clear', label: 'Clear' },
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
];

const STATUS_OPTIONS = [
  { value: 'clear', label: 'Clear' },
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
];

function getToken() {
  return localStorage.getItem('sdoToken');
}

function normalizeStatus(status) {
  if (status === 'minor') return 'Minor';
  if (status === 'major') return 'Major';
  return 'Clear';
}

function getEditableStatus(status) {
  return status === 'minor' || status === 'major' ? status : 'clear';
}

export default function SDOScholarList() {
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchScholars = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${API_BASE}/scholars`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to load scholar list');
        }

        setScholars(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load scholar list.');
      } finally {
        setLoading(false);
      }
    };

    fetchScholars();
  }, []);

  const filteredScholars = useMemo(() => {
    return scholars.filter((scholar) => {
      const matchesSearch =
        scholar.student_name?.toLowerCase().includes(search.toLowerCase()) ||
        scholar.student_number?.toLowerCase().includes(search.toLowerCase()) ||
        scholar.program_name?.toLowerCase().includes(search.toLowerCase());

      const scholarStatus = getEditableStatus(scholar.sdu_level);
      const matchesFilter = filter === 'all' ? true : scholarStatus === filter;
      return matchesSearch && matchesFilter;
    });
  }, [filter, scholars, search]);

  const handleDraftChange = (scholarId, field, value, scholar) => {
    setDrafts((current) => ({
      ...current,
      [scholarId]: {
        status: current[scholarId]?.status || getEditableStatus(scholar.sdu_level),
        comment: current[scholarId]?.comment ?? scholar.sdo_comment ?? '',
        [field]: value,
      },
    }));
  };

  const handleSave = async (scholar) => {
    const draft = drafts[scholar.scholar_id] || {
      status: getEditableStatus(scholar.sdu_level),
      comment: scholar.sdo_comment || '',
    };

    try {
      setSavingId(scholar.scholar_id);
      setFeedback('');
      setError('');

      const response = await fetch(`${API_BASE}/scholars/${scholar.scholar_id}/sdo-status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: draft.status,
          comment: draft.comment,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save scholar update');
      }

      setScholars((current) =>
        current.map((item) =>
          item.scholar_id === scholar.scholar_id
            ? {
                ...item,
                sdu_level: draft.status,
                sdo_comment: draft.comment,
              }
            : item
        )
      );

      setFeedback(`Updated ${scholar.student_name}'s probation status.`);
    } catch (err) {
      setError(err.message || 'Failed to save scholar update.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading scholar list...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-stone-900">Scholar List</h2>
          <p className="mt-1 text-sm text-stone-500">
            Update probation status, add comments, and keep admin monitoring in sync.
          </p>
        </div>
      </div>

      <Card className="rounded-3xl border-stone-200 shadow-none">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search scholar name, PDM ID, or program"
                className="h-11 rounded-2xl border-stone-200 pl-10"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-11 w-full rounded-2xl border-stone-200 md:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {feedback && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedback}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scholar</TableHead>
                <TableHead>Program</TableHead>
                <TableHead className="w-[180px]">Probation Status</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScholars.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-stone-500">
                    No scholars match the current filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredScholars.map((scholar) => {
                  const draft = drafts[scholar.scholar_id] || {
                    status: getEditableStatus(scholar.sdu_level),
                    comment: scholar.sdo_comment || '',
                  };

                  return (
                    <TableRow key={scholar.scholar_id}>
                      <TableCell className="align-top">
                        <p className="font-medium text-stone-900">{scholar.student_name}</p>
                        <p className="text-xs text-stone-500">{scholar.student_number}</p>
                      </TableCell>
                      <TableCell className="align-top text-sm text-stone-600">
                        {scholar.program_name}
                      </TableCell>
                      <TableCell className="align-top">
                        <Select
                          value={draft.status}
                          onValueChange={(value) => handleDraftChange(scholar.scholar_id, 'status', value, scholar)}
                        >
                          <SelectTrigger className="h-10 rounded-xl border-stone-200">
                            <SelectValue>{normalizeStatus(draft.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">
                        <textarea
                          value={draft.comment}
                          onChange={(e) =>
                            handleDraftChange(scholar.scholar_id, 'comment', e.target.value, scholar)
                          }
                          rows={3}
                          className="min-h-[92px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-900/30 focus:ring-2 focus:ring-emerald-900/10"
                          placeholder="Add disciplinary note or probation comment"
                        />
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Button
                          onClick={() => handleSave(scholar)}
                          disabled={savingId === scholar.scholar_id}
                          className="rounded-xl bg-[#2e4b43] text-white hover:bg-[#274038]"
                        >
                          {savingId === scholar.scholar_id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
