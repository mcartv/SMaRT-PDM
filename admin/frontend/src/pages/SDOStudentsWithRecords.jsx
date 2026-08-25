import {
  createElement,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileWarning,
  History,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';

import { buildApiUrl } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSocketEvent } from '@/hooks/useSocket';
import usePortalTheme from '@/hooks/usePortalTheme';

const API_URL = buildApiUrl('/api/student-registry/sdo-records');
const PAGE_SIZE = 12;

function buildHeaders() {
  return {
    Authorization: `Bearer ${sessionStorage.getItem('sdoToken')}`,
  };
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date);
}

function StudentHistoryModal({ studentNumber, onClose }) {
  const { theme } = usePortalTheme('sdo');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadHistory() {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(
          `${API_URL}/students/${encodeURIComponent(studentNumber)}`,
          { headers: buildHeaders(), signal: controller.signal }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || payload.error || 'Failed to load record history.');
        }
        if (active) setData(payload);
      } catch (requestError) {
        if (requestError.name !== 'AbortError' && active) {
          setError(requestError.message || 'Failed to load record history.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      active = false;
      controller.abort();
    };
  }, [studentNumber]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl border"
              style={{
                borderColor: theme.border,
                background: theme.accentSoft,
                color: theme.base,
              }}
            >
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900">Disciplinary History</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Complete record history for this student
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close disciplinary history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading disciplinary history...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-stone-900">
                      {data?.student?.student_name}
                    </p>
                    <p className="mt-1 font-mono text-xs text-stone-500">
                      {data?.student?.student_number}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-stone-200 bg-white">
                      {data?.student?.course_code || 'Course unavailable'}
                    </Badge>
                    <Badge
                      className="border-none"
                      style={{ background: theme.accentSoft, color: theme.base }}
                    >
                      {data?.student?.record_count || 0} records
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {(data?.records || []).map((record, index) => (
                  <div
                    key={record.record_id}
                    className="relative rounded-2xl border border-stone-200 bg-white p-4 pl-12"
                  >
                    <div
                      className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: theme.base }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">
                          {record.offense_type}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Incident: {formatDate(record.offense_incident_date)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            Recorded: {formatDate(record.created_at, true)}
                          </span>
                        </div>
                      </div>
                      {record.case_reference_number ? (
                        <Badge variant="outline" className="border-stone-200 font-mono text-[10px]">
                          {record.case_reference_number}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2.5 text-xs leading-5 text-stone-600">
                      {record.remarks || 'No remarks were recorded.'}
                    </div>
                    <p className="mt-2 text-[10px] text-stone-400">
                      Recorded by: {record.recorded_by ? 'SDO Staff' : 'Legacy/imported record'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SDOStudentsWithRecords() {
  const { theme } = usePortalTheme('sdo');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total_students: 0, total_records: 0 });
  const [courseOptions, setCourseOptions] = useState([]);
  const [offenseOptions, setOffenseOptions] = useState([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [course, setCourse] = useState('all');
  const [offense, setOffense] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadRows = useCallback(async ({ soft = false } = {}) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
        search: deferredSearch.trim(),
        course,
        offense,
      });
      const response = await fetch(`${API_URL}/students?${params}`, {
        headers: buildHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to load students with records.');
      }

      setRows(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setSummary({
        total_students: Number(data.total_students || 0),
        total_records: Number(data.total_records || 0),
      });
      setCourseOptions(Array.isArray(data.courses) ? data.courses : []);
      setOffenseOptions(Array.isArray(data.offenses) ? data.offenses : []);
    } catch (requestError) {
      setError(requestError.message || 'Failed to load students with records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [course, deferredSearch, offense, page]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    setPage(1);
  }, [course, deferredSearch, offense]);

  useSocketEvent('sdo-records:updated', () => {
    loadRows({ soft: true });
  }, [loadRows]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cards = useMemo(
    () => [
      {
        label: 'Students with records',
        value: summary.total_students,
        icon: Users,
        tone: 'bg-orange-50 text-orange-700',
      },
      {
        label: 'Record entries',
        value: summary.total_records,
        icon: FileWarning,
        tone: 'bg-red-50 text-red-700',
      },
      {
        label: 'Current results',
        value: total,
        icon: ShieldAlert,
        tone: 'bg-stone-100 text-stone-700',
      },
    ],
    [summary, total]
  );

  return (
    <div className="space-y-5 py-2">
      <section
        className="overflow-hidden rounded-[26px] border p-6"
        style={{
          borderColor: theme.border,
          background: `linear-gradient(135deg, ${theme.accentSoft}, white 70%)`,
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ background: theme.base, color: '#fff' }}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              SDO Records
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
              Students with Records
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Review students with recorded disciplinary entries and open their complete history.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-fit border-stone-200 bg-white"
            onClick={() => loadRows({ soft: true })}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-[20px] border-stone-200 shadow-none">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-xl p-2.5 ${card.tone}`}>
                {createElement(card.icon, { className: 'h-4 w-4' })}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  {card.label}
                </p>
                <p className="mt-1 text-xl font-semibold text-stone-900">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden rounded-[22px] border-stone-200 shadow-none">
        <div className="border-b border-stone-100 p-4">
          <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_190px_210px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student, PDM ID, course, or offense..."
                className="h-10 pl-9"
              />
            </div>
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courseOptions.map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={offense} onValueChange={setOffense}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Latest offense" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All latest offenses</SelectItem>
                {offenseOptions.map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-10"
              disabled={!search && course === 'all' && offense === 'all'}
              onClick={() => {
                setSearch('');
                setCourse('all');
                setOffense('all');
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {error ? (
          <div className="m-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-stone-50/80 text-[10px] uppercase tracking-[0.16em] text-stone-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">PDM ID</th>
                <th className="px-4 py-3 font-semibold">Course / Year</th>
                <th className="px-4 py-3 font-semibold">Latest Offense</th>
                <th className="px-4 py-3 font-semibold">Incident Date</th>
                <th className="px-4 py-3 text-center font-semibold">Records</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((student) => (
                <tr key={student.student_number} className="transition hover:bg-stone-50/70">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-stone-900">{student.student_name}</p>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-500">
                    {student.student_number}
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    {student.course_code || 'N/A'}
                    {student.year_level ? ` / Year ${student.year_level}` : ''}
                  </td>
                  <td className="px-4 py-4">
                    <Badge
                      variant="outline"
                      className="border-stone-200 bg-white font-medium text-stone-700"
                    >
                      {student.latest_offense || 'Not provided'}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    {formatDate(student.latest_incident_date)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className="inline-flex min-w-8 justify-center rounded-full px-2 py-1 text-xs font-semibold"
                      style={{ background: theme.accentSoft, color: theme.base }}
                    >
                      {student.record_count}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-stone-200"
                      onClick={() => setSelectedStudent(student.student_number)}
                    >
                      <Eye className="mr-2 h-3.5 w-3.5" />
                      View History
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-14 text-center">
                    <ShieldAlert className="mx-auto h-8 w-8 text-stone-300" />
                    <p className="mt-3 text-sm font-medium text-stone-700">
                      No students match the current filters
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      Imported disciplinary records will appear here automatically.
                    </p>
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-5 py-14 text-center text-sm text-stone-500">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Loading students with records...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-100 px-5 py-3 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {rows.length} of {total} students
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-20 text-center">Page {page} of {totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {selectedStudent ? (
        <StudentHistoryModal
          studentNumber={selectedStudent}
          onClose={() => setSelectedStudent('')}
        />
      ) : null}
    </div>
  );
}
