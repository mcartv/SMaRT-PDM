import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Loader2,
  AlertCircle,
  CalendarDays,
  Users,
  CheckCircle2,
  Clock3,
  ArrowRight,
  FolderOpen,
  CircleOff,
} from 'lucide-react';

const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
  border: '#e7e5e4',
};

function formatDate(value) {
  if (!value) return 'No date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getOpeningStatusMeta(opening) {
  const raw = (opening?.status || opening?.posting_status || '').toLowerCase();
  const remainingSlots = Math.max(
    0,
    Number(opening?.slot_count || opening?.allocated_slots || 0) -
    Number(opening?.qualified_count || 0)
  );

  if (raw === 'draft') {
    return { label: 'Draft', bg: '#f5f5f4', color: '#57534e' };
  }

  if (raw === 'archived') {
    return { label: 'Archived', bg: '#f5f5f4', color: '#78716c' };
  }

  if (raw === 'closed') {
    return { label: 'Closed', bg: C.redSoft, color: C.red };
  }

  if (raw === 'filled' || remainingSlots <= 0) {
    return { label: 'Filled', bg: C.amberSoft, color: C.amber };
  }

  return { label: 'Open', bg: C.greenSoft, color: C.green };
}

function StatusPill({ meta }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

async function parseErrorResponse(res, fallbackMessage) {
  try {
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload = await res.json();
      return payload?.message || payload?.error || fallbackMessage;
    }

    const text = await res.text();
    return text || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export default function ApplicationReview() {
  const navigate = useNavigate();

  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadOpenings = async ({ soft = false } = {}) => {
    try {
      if (soft) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError('');
      }

      const token = localStorage.getItem('adminToken');

      const res = await fetch('http://localhost:5000/api/program-openings/admin/applications-summary', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const message = await parseErrorResponse(res, 'Failed to fetch scholarship openings');
        throw new Error(message);
      }

      const data = await res.json();
      setOpenings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('OPENINGS FETCH ERROR:', err);
      setError(err.message || 'Failed to load scholarship openings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOpenings();
  }, []);

  const filteredOpenings = useMemo(() => {
    const q = search.trim().toLowerCase();

    return openings.filter((opening) => {
      if (!q) return true;

      const title = (opening.title || opening.opening_title || '').toLowerCase();
      const program = (opening.program_name || '').toLowerCase();
      const benefactor = (opening.benefactor_name || opening.organization_name || '').toLowerCase();

      return title.includes(q) || program.includes(q) || benefactor.includes(q);
    });
  }, [openings, search]);

  const stats = useMemo(() => {
    const total = openings.length;
    const openCount = openings.filter((o) => getOpeningStatusMeta(o).label === 'Open').length;
    const filledCount = openings.filter((o) => getOpeningStatusMeta(o).label === 'Filled').length;
    const totalApplicants = openings.reduce((sum, o) => sum + Number(o.application_count || 0), 0);

    return [
      {
        label: 'Total Openings',
        value: total,
        icon: FolderOpen,
        soft: C.amberSoft,
        accent: C.brown,
      },
      {
        label: 'Open Now',
        value: openCount,
        icon: CheckCircle2,
        soft: C.greenSoft,
        accent: C.green,
      },
      {
        label: 'Filled',
        value: filledCount,
        icon: CircleOff,
        soft: C.redSoft,
        accent: C.red,
      },
      {
        label: 'Total Applicants',
        value: totalApplicants,
        icon: Users,
        soft: C.blueSoft,
        accent: C.blueMid,
      },
    ];
  }, [openings]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">Loading scholarship openings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <AlertCircle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load openings</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <Button
          onClick={() => loadOpenings()}
          variant="outline"
          size="sm"
          className="mt-4 border-red-200 text-red-600 text-xs"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2" style={{ background: C.bg }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Applications
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            Review applicants by scholarship opening
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadOpenings({ soft: true })}
          className="rounded-lg text-xs border-stone-200 text-stone-600"
        >
          {refreshing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Clock3 className="mr-1.5 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: s.soft }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold" style={{ color: C.text }}>
                {s.value}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
        <Input
          placeholder="Search by opening title, scholarship program, or benefactor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 text-sm bg-white rounded-lg border-stone-200"
        />
      </div>

      {filteredOpenings.length === 0 ? (
        <Card className="border-stone-200 shadow-none">
          <CardContent className="py-14 text-center text-sm text-stone-400">
            No scholarship openings found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredOpenings.map((opening) => {
            const statusMeta = getOpeningStatusMeta(opening);
            const slotCount = Number(opening.slot_count || opening.allocated_slots || 0);
            const qualifiedCount = Number(opening.qualified_count || 0);
            const applicationCount = Number(opening.application_count || 0);
            const pendingCount = Number(opening.pending_count || 0);
            const reviewCount = Number(opening.review_count || 0);
            const remainingSlots = Math.max(0, slotCount - qualifiedCount);

            return (
              <Card
                key={opening.opening_id}
                className="border-stone-200 shadow-none hover:border-stone-300 transition-all"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold text-stone-900">
                        {opening.title || opening.opening_title || 'Untitled Opening'}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {opening.program_name || 'No Program'}
                        {opening.benefactor_name || opening.organization_name
                          ? ` · ${opening.benefactor_name || opening.organization_name}`
                          : ''}
                      </CardDescription>
                    </div>

                    <StatusPill meta={statusMeta} />
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-[11px] text-stone-500">Slots</p>
                      <p className="text-lg font-semibold text-stone-900">{slotCount}</p>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-[11px] text-stone-500">Qualified</p>
                      <p className="text-lg font-semibold text-stone-900">{qualifiedCount}</p>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-[11px] text-stone-500">Applicants</p>
                      <p className="text-lg font-semibold text-stone-900">{applicationCount}</p>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-[11px] text-stone-500">Remaining</p>
                      <p className="text-lg font-semibold text-stone-900">{remainingSlots}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {formatDate(opening.start_date || opening.application_start)} - {formatDate(opening.end_date || opening.application_end)}
                    </span>
                    <span>•</span>
                    <span>{pendingCount} pending</span>
                    <span>•</span>
                    <span>{reviewCount} under review</span>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="rounded-lg text-white text-xs border-none"
                      style={{ background: C.brownMid }}
                      onClick={() => navigate(`/admin/openings/${opening.opening_id}/applications`)}
                    >
                      View Applicants
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · Opening-Based Application Review
        </p>
      </footer>
    </div>
  );
}