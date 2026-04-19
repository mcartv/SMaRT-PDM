import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  RefreshCw,
  Search,
  LifeBuoy,
  UserRoundCheck,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const STATUS_OPTIONS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

const STATUS_STYLES = {
  Open: { bg: '#EFF6FF', color: '#1D4ED8' },
  'In Progress': { bg: '#FFF7ED', color: '#D97706' },
  Resolved: { bg: '#F0FDF4', color: '#16A34A' },
  Closed: { bg: '#F5F5F4', color: '#57534E' },
};

function formatDate(value) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getAuthHeaders() {
  const token = localStorage.getItem('adminToken') || localStorage.getItem('sdoToken');
  return {
    Authorization: `Bearer ${token || ''}`,
    'Content-Type': 'application/json',
  };
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Open;

  return (
    <Badge
      className="border-none text-[10px] uppercase tracking-wide px-2 py-0.5"
      style={{ background: style.bg, color: style.color }}
    >
      {status}
    </Badge>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-[10px] text-stone-400 uppercase">{label}</p>
      <p className="text-xs text-stone-700">{value}</p>
    </div>
  );
}

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [savingTicketId, setSavingTicketId] = useState('');

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`${API_BASE}/support-tickets`, {
        headers: getAuthHeaders(),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error);

      setTickets(payload.items || []);
    } catch (err) {
      setError(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const text = [
        t.issue_category,
        t.description,
        t.student_name,
        t.student_number,
        t.handler_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        (!search || text.includes(search.toLowerCase())) &&
        (status === 'All' || t.status === status)
      );
    });
  }, [tickets, search, status]);

  const patchTicket = async (id, body) => {
    try {
      setSavingTicketId(id);

      const res = await fetch(`${API_BASE}/support-tickets/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error);

      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === id ? payload.data : t))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTicketId('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-300" />
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">

      {/* FILTER BAR */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-9 h-9"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          className="h-9"
          onClick={loadTickets}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="text-xs text-red-500">{error}</div>
      )}

      {/* EMPTY */}
      {filtered.length === 0 ? (
        <div className="text-center py-14 text-stone-400 text-sm">
          <LifeBuoy className="mx-auto mb-2 h-6 w-6" />
          No tickets
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div
              key={t.ticket_id}
              className="border border-stone-200 rounded-xl px-4 py-3 bg-white"
            >
              <div className="flex justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {t.issue_category || 'Uncategorized'}
                  </p>
                  <p className="text-xs text-stone-500">
                    {t.student_name} · {t.student_number}
                  </p>
                </div>

                <StatusBadge status={t.status} />
              </div>

              <p className="text-sm text-stone-600 mt-2">
                {t.description}
              </p>

              <div className="flex justify-between mt-3 text-xs text-stone-500">
                <Meta label="Created" value={formatDate(t.created_at)} />
                <Meta label="Handler" value={t.handler_name || '—'} />
                <Meta
                  label="Resolved"
                  value={t.resolved_at ? formatDate(t.resolved_at) : '—'}
                />
              </div>

              <div className="flex gap-1 mt-3 flex-wrap">
                {!t.handled_by && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => patchTicket(t.ticket_id, { assignToSelf: true })}
                  >
                    <UserRoundCheck className="h-3.5 w-3.5 mr-1" />
                    Take
                  </Button>
                )}

                {STATUS_OPTIONS.slice(1).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={t.status === s ? 'default' : 'outline'}
                    disabled={t.status === s || savingTicketId === t.ticket_id}
                    onClick={() => patchTicket(t.ticket_id, { status: s })}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}