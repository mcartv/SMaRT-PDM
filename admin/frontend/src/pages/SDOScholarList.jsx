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

// ─── Theme (matching Admin Dashboard) ───────────────────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  brownLight: '#92500f',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  yellow: '#fbbf24',
  sand: '#fdf6ec',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  border: '#e8d5b7',
  muted: '#78716c',
  text: '#1c1917',
  bg: '#faf7f2',
};

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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: C.muted }} />
        <p className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>
          Loading scholar list...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2" style={{ background: C.bg }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Scholar List
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            Update probation status, add comments, and keep admin monitoring in sync.
          </p>
        </div>
      </div>

      {/* Main Card */}
      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-4 px-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.muted }} />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search scholar name, PDM ID, or program"
                  className="h-10 rounded-lg border-stone-200 pl-9 text-sm bg-white"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-10 w-full rounded-lg border-stone-200 bg-white md:w-[140px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-sm">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {feedback && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: C.greenSoft, color: C.green, border: `1px solid #bbf7d0` }}
              >
                {feedback}
              </div>
            )}

            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: C.redSoft, color: C.red, border: `1px solid #fecaca` }}
              >
                {error}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-stone-50/80">
              <TableRow className="border-stone-100 hover:bg-transparent">
                <TableHead className="text-xs font-medium py-3 px-5" style={{ color: C.muted }}>Scholar</TableHead>
                <TableHead className="text-xs font-medium py-3" style={{ color: C.muted }}>Program</TableHead>
                <TableHead className="text-xs font-medium py-3 w-[160px]" style={{ color: C.muted }}>Probation Status</TableHead>
                <TableHead className="text-xs font-medium py-3" style={{ color: C.muted }}>Comment</TableHead>
                <TableHead className="text-xs font-medium py-3 text-right pr-5" style={{ color: C.muted }}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScholars.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm" style={{ color: C.muted }}>
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
                    <TableRow
                      key={scholar.scholar_id}
                      className="border-stone-100 hover:bg-amber-50/20 transition-colors"
                    >
                      <TableCell className="align-top py-3.5 px-5">
                        <p className="font-medium text-sm" style={{ color: C.text }}>{scholar.student_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: C.muted }}>{scholar.student_number}</p>
                      </TableCell>
                      <TableCell className="align-top py-3.5 text-sm" style={{ color: C.muted }}>
                        {scholar.program_name}
                      </TableCell>
                      <TableCell className="align-top py-3.5">
                        <Select
                          value={draft.status}
                          onValueChange={(value) => handleDraftChange(scholar.scholar_id, 'status', value, scholar)}
                        >
                          <SelectTrigger className="h-9 rounded-lg border-stone-200 bg-white text-sm w-[110px]">
                            <SelectValue>{normalizeStatus(draft.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="text-sm">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top py-3.5">
                        <textarea
                          value={draft.comment}
                          onChange={(e) =>
                            handleDraftChange(scholar.scholar_id, 'comment', e.target.value, scholar)
                          }
                          rows={3}
                          className="min-h-[88px] w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-800/30 focus:ring-2 focus:ring-amber-800/10"
                          placeholder="Add disciplinary note or probation comment"
                        />
                      </TableCell>
                      <TableCell className="align-top py-3.5 pr-5 text-right">
                        <Button
                          onClick={() => handleSave(scholar)}
                          disabled={savingId === scholar.scholar_id}
                          className="h-8 rounded-lg text-white text-xs px-4"
                          style={{ background: C.brownMid, hover: { background: '#5c2d0e' } }}
                        >
                          {savingId === scholar.scholar_id ? (
                            <>
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              Saving
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-3.5 w-3.5" />
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

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SDO PDM · Scholar Management Portal
        </p>
      </footer>
    </div>
  );
}