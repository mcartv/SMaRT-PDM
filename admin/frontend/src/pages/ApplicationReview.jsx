import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  UserMinus, UserPlus, FileText, Users, CheckCircle2,
  Clock, AlertTriangle, AlertCircle, Loader2, X,
} from 'lucide-react';

// ─── Theme ───────────────────────────────────────────────────────
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
};

// ─── Constants ───────────────────────────────────────────────────
const DOC_STATUS_MAP = {
  'documents ready': { label: 'Documents Ready', bg: C.greenSoft, color: C.green },
  'missing docs': { label: 'Missing Docs', bg: C.redSoft, color: C.red },
  'under review': { label: 'Under Review', bg: C.amberSoft, color: C.amber },
};

const DISQ_REASONS = [
  'Failed GWA requirement',
  'AWOL / No contact',
  'SDU (Scholar Disciplinary Unit)',
  'Existing LGU / Sports scholarship',
  'Failed to complete RO',
  'Voluntarily withdrew',
  'Other',
];

const PAGE_SIZE = 10;

// ─── Disqualify Modal ────────────────────────────────────────────
function DisqModal({ app, onDisqualify, onClose }) {
  const [reason, setReason] = useState('');

  const displayName = app?.name || 'Unknown';
  const displayId = app?.student_number || app?.id || 'No ID';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/30"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md shadow-xl border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b bg-red-50 border-red-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-red-700">Disqualification Record</h3>
            <p className="text-xs text-stone-500 mt-0.5">{displayName} · {displayId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <CardContent className="p-4 space-y-2">
          <p className="text-xs text-stone-500 mb-3">Select a disqualification reason:</p>

          {DISQ_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all border ${reason === r
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-white border-stone-200 text-stone-600 hover:border-red-200 hover:bg-red-50'
                }`}
            >
              {r}
            </button>
          ))}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-9 text-xs rounded-lg border-stone-200"
            >
              Cancel
            </Button>
            <Button
              disabled={!reason}
              onClick={() => {
                onDisqualify(app.id, reason);
                onClose();
              }}
              className="flex-1 h-9 text-xs rounded-lg text-white border-none disabled:opacity-40"
              style={{ background: C.red }}
            >
              Confirm
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function ApplicationReview() {
  const navigate = useNavigate();

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());

  const [showRepl, setShowRepl] = useState(false);
  const [disqApp, setDisqApp] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('http://localhost:5000/api/applications', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch applications');
        }

        const data = await res.json();
        setApps(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('APPLICATION FETCH ERROR:', err);
        setError(err.message || 'Failed to load applications');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const programOptions = useMemo(() => {
    return ['All Programs', ...new Set(apps.map((a) => a.program).filter(Boolean))];
  }, [apps]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return apps.filter((a) => {
      const id = a.id || '';
      const fullName = (a.name || '').toLowerCase();
      const appProgram = a.program || '';
      const docStatus = (a.document_status || '').toLowerCase();

      const matchSearch =
        !q ||
        fullName.includes(q) ||
        String(id).toLowerCase().includes(q) ||
        String(a.student_number || '').toLowerCase().includes(q);

      const matchProgram =
        program === 'All Programs' || appProgram === program;

      const matchStatus =
        status === 'all' || docStatus === status;

      return matchSearch && matchProgram && matchStatus;
    });
  }, [apps, search, program, status]);

  useEffect(() => {
    setPage(1);
  }, [search, program, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  const allSel = useMemo(() => {
    return pageData.length > 0 && pageData.every((a) => selected.has(a.id));
  }, [pageData, selected]);

  const disqualifiedCount = useMemo(() => {
    return apps.filter((a) => a.disqualified).length;
  }, [apps]);

  const replacementCandidates = useMemo(() => {
    return apps.filter((a) => a.disqualified);
  }, [apps]);

  const STATS = useMemo(() => {
    return [
      {
        label: 'Total Applications',
        value: apps.length,
        icon: Users,
        accent: C.brown,
        soft: C.amberSoft,
      },
      {
        label: 'Documents Ready',
        value: apps.filter((a) => a.document_status === 'documents ready').length,
        icon: CheckCircle2,
        accent: C.green,
        soft: C.greenSoft,
      },
      {
        label: 'Under Review',
        value: apps.filter((a) => a.document_status === 'under review').length,
        icon: Clock,
        accent: C.amber,
        soft: C.amberSoft,
      },
      {
        label: 'Missing Docs',
        value: apps.filter((a) => a.document_status === 'missing docs').length,
        icon: AlertTriangle,
        accent: C.red,
        soft: C.redSoft,
      },
    ];
  }, [apps]);

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (allSel) {
        pageData.forEach((a) => next.delete(a.id));
      } else {
        pageData.forEach((a) => next.add(a.id));
      }

      return next;
    });
  };

  const handleDisqualify = async (id, reason) => {
    try {
      const res = await fetch(`http://localhost:5000/api/applications/${id}/disqualify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        throw new Error('Failed to disqualify application');
      }

      setApps((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
              ...a,
              disqualified: true,
              disqReason: reason,
            }
            : a
        )
      );
    } catch (err) {
      console.error('DISQUALIFY ERROR:', err);
      alert(err.message || 'Failed to disqualify application');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">Loading applications...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <AlertCircle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load applications</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <Button
          onClick={() => window.location.reload()}
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
      {disqApp && <DisqModal app={disqApp} onDisqualify={handleDisqualify} onClose={() => setDisqApp(null)} />}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Applications
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            {filtered.length} records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRepl(!showRepl)}
            className="rounded-lg text-xs border-stone-200 text-stone-600"
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Replacement Queue
            {disqualifiedCount > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                {disqualifiedCount}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            className="rounded-lg text-white text-xs border-none"
            style={{ background: C.brownMid }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((s) => (
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

      {showRepl && (
        <Card className="border-stone-200 shadow-none overflow-hidden">
          <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
            <CardTitle className="text-sm font-semibold text-stone-800">Replacement Queue</CardTitle>
            <CardDescription className="text-xs">
              Applications marked disqualified that may open scholarship slots
            </CardDescription>
          </CardHeader>

          <div className="p-4">
            {replacementCandidates.length === 0 ? (
              <div className="text-xs text-stone-400">No disqualified applications yet.</div>
            ) : (
              <div className="space-y-2">
                {replacementCandidates.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-stone-800">{app.name}</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {app.student_number}
                        {app.disqReason ? ` · ${app.disqReason}` : ''}
                      </p>
                    </div>
                    <Badge className="bg-red-50 text-red-600 border-red-100 text-[10px] font-medium">
                      Disqualified
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(DOC_STATUS_MAP).map(([key, s]) => {
          const count = apps.filter((a) => a.document_status === key).length;
          const isActive = status === key;

          return (
            <button
              key={key}
              onClick={() => {
                setStatus(isActive ? 'all' : key);
                setPage(1);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
              style={{
                background: isActive ? s.bg : '#fff',
                borderColor: isActive ? s.color : '#e5e7eb',
                color: isActive ? s.color : '#9ca3af',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
              {s.label}
              <span className="font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
          <Input
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
          />
        </div>

        <Select value={program} onValueChange={setProgram}>
          <SelectTrigger className="w-[180px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {programOptions.map((p) => (
              <SelectItem key={p} value={p} className="text-sm">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
          <CardTitle className="text-sm font-semibold text-stone-800">Application Registry</CardTitle>
          <CardDescription className="text-xs">Integrated scholarship management ledger</CardDescription>

          {selected.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 mt-2">
              <span className="text-xs font-medium text-amber-700">{selected.size} selected</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs rounded-md text-white border-none"
                  style={{ background: C.green }}
                >
                  Approve All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(new Set())}
                  className="h-7 text-xs rounded-md border-stone-200"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <Table>
          <TableHeader className="bg-stone-50/80">
            <TableRow className="border-stone-100 hover:bg-transparent">
              <TableHead className="w-10 px-5 py-3">
                <input
                  type="checkbox"
                  checked={allSel}
                  onChange={toggleAll}
                  className="rounded accent-stone-700"
                />
              </TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3">Student Profile</TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-center">Docs Status</TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-right pr-5">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-sm text-stone-400">
                  No applications match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((app) => {
                const id = app.id;
                const isDisq = app.disqualified;
                const statusStyle = DOC_STATUS_MAP[app.document_status];

                return (
                  <TableRow
                    key={id}
                    className={`border-stone-100 transition-colors ${isDisq ? 'bg-red-50/20' : 'hover:bg-amber-50/20'
                      }`}
                  >
                    <TableCell className="px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggleOne(id)}
                        className="accent-stone-700"
                      />
                    </TableCell>

                    <TableCell className="py-3.5">
                      <div className="font-medium text-stone-800 text-sm">{app.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono text-stone-400">{app.student_number}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium border-stone-200 text-stone-500 bg-white"
                        >
                          {app.program}
                        </Badge>
                        {isDisq && (
                          <Badge className="bg-red-50 text-red-600 border-red-100 text-[10px] font-medium h-4 px-1.5">
                            Disqualified
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3.5 text-center">
                      {statusStyle ? (
                        <span
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: statusStyle.bg, color: statusStyle.color }}
                        >
                          {statusStyle.label}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">Unknown</span>
                      )}
                    </TableCell>

                    <TableCell className="py-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => navigate(`/admin/applications/${id}/documents`)}
                          className="h-7 px-3 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Review Documents
                        </Button>

                        {!isDisq && (
                          <Button
                            size="sm"
                            onClick={() => setDisqApp(app)}
                            className="h-7 w-7 p-0 rounded-lg bg-white border border-red-100 text-red-500 hover:bg-red-50 shadow-none"
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="px-5 py-3 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between">
          <span className="text-xs text-stone-400">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 rounded-lg border-stone-200"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            <span className="text-xs font-medium px-2.5 py-1 bg-white border border-stone-200 rounded-lg">
              {page} / {totalPages}
            </span>

            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 rounded-lg border-stone-200"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · Application Management Layer
        </p>
      </footer>
    </div>
  );
}