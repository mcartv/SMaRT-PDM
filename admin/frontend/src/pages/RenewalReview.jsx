import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocketEvent } from '@/hooks/useSocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Eye, RefreshCw, FolderSync } from 'lucide-react';

import { buildApiUrl } from '@/api';
const API_BASE = buildApiUrl('/api');
const C = {
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
  brown: '#7c4a2e',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  orange: '#d97706',
  orangeSoft: '#FFF7ED',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blueSoft: '#EFF6FF',
};

const STATUS_META = {
  Approved: { color: C.green, bg: C.greenSoft },
  Submitted: { color: C.orange, bg: C.orangeSoft },
  'Under Review': { color: C.orange, bg: C.orangeSoft },
  'Needs Reupload': { color: C.red, bg: C.redSoft },
  Rejected: { color: C.red, bg: C.redSoft },
  Draft: { color: C.brown, bg: C.blueSoft },
};

export default function RenewalReview() {
  const navigate = useNavigate();
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');

  const loadRenewals = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE}/renewals`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json().catch(() => ([]));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load renewal submissions');
      }

      setRenewals(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setError(err.message || 'Failed to load renewal submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRenewals();
  }, []);

  // Realtime updates for renewals
  useSocketEvent('renewal:updated', (data) => {
    console.log('[Realtime] Renewal updated:', data);
    loadRenewals();
  }, []);

  useSocketEvent('renewal:approved', (data) => {
    console.log('[Realtime] Renewal approved:', data);
    loadRenewals();
  }, []);

  const filteredRenewals = useMemo(() => {
    return renewals.filter((renewal) => {
      const matchesSearch =
        !search ||
        [renewal.student_name, renewal.student_number, renewal.program_name]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = status === 'All' || renewal.renewal_status === status;
      return matchesSearch && matchesStatus;
    });
  }, [renewals, search, status]);

  const statuses = useMemo(
    () => ['All', ...new Set(renewals.map((item) => item.renewal_status).filter(Boolean))],
    [renewals]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">Loading renewals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <p className="text-sm font-semibold text-red-800">Failed to load renewal submissions</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <Button onClick={loadRenewals} variant="outline" size="sm" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2 animate-in fade-in duration-300" style={{ background: C.bg }}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Scholar Renewals</h1>
          <p className="text-sm text-stone-500 mt-1">
            Review semester renewal uploads from active scholars.
          </p>
        </div>

        <Button
          variant="outline"
          className="border-stone-200 bg-white"
          onClick={loadRenewals}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className="border-stone-200 shadow-none bg-white">
        <CardContent className="p-4 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scholar, student number, or program"
              className="pl-9 border-stone-200"
            />
          </div>
          <div className="w-full md:w-52">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="border-stone-200">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filteredRenewals.map((renewal) => {
          const meta = STATUS_META[renewal.renewal_status] || STATUS_META.Draft;

          return (
            <Card key={renewal.id} className="border-stone-200 shadow-none bg-white">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-stone-900">{renewal.student_name}</p>
                    <p className="text-xs font-mono text-stone-400 mt-0.5">
                      {renewal.student_number}
                    </p>
                    <p className="text-sm text-stone-600 mt-2">{renewal.program_name}</p>
                  </div>

                  <Badge
                    className="border-none text-[10px] uppercase tracking-wide"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {renewal.renewal_status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-stone-200 px-3 py-2">
                    <p className="text-stone-400 uppercase tracking-wide">Cycle</p>
                    <p className="font-medium text-stone-800 mt-1">
                      {renewal.semester_label} Sem AY {renewal.school_year_label}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stone-200 px-3 py-2">
                    <p className="text-stone-400 uppercase tracking-wide">Document Status</p>
                    <p className="font-medium text-stone-800 mt-1">{renewal.document_status}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-stone-500">
                    Submitted: {renewal.submitted_at || 'Not yet submitted'}
                  </div>

                  <Button
                    size="sm"
                    className="bg-stone-900 hover:bg-stone-800"
                    onClick={() => navigate(`/admin/renewals/${renewal.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredRenewals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 px-8 py-14 text-center">
          <FolderSync className="w-8 h-8 mx-auto text-stone-300 mb-3" />
          <p className="text-sm font-semibold text-stone-700">No renewal submissions found</p>
          <p className="text-xs text-stone-400 mt-1">
            Scholar renewals will appear here after scholars upload and submit their semester requirements.
          </p>
        </div>
      )}
    </div>
  );
}
