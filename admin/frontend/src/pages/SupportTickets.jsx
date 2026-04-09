import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Search, LifeBuoy, UserRoundCheck } from 'lucide-react';

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
      className="border-none text-[10px] uppercase tracking-wide"
      style={{ background: style.bg, color: style.color }}
    >
      {status}
    </Badge>
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

      const response = await fetch(`${API_BASE}/support-tickets`, {
        headers: getAuthHeaders(),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load support tickets');
      }

      setTickets(Array.isArray(payload.items) ? payload.items : []);
    } catch (err) {
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const haystack = [
        ticket.issue_category,
        ticket.description,
        ticket.student_name,
        ticket.student_number,
        ticket.handler_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesStatus = status === 'All' || ticket.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [tickets, search, status]);

  const patchTicket = async (ticketId, body) => {
    try {
      setSavingTicketId(ticketId);

      const response = await fetch(`${API_BASE}/support-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update support ticket');
      }

      const updated = payload.data;
      setTickets((current) =>
        current.map((ticket) => (ticket.ticket_id === ticketId ? updated : ticket))
      );
    } catch (err) {
      setError(err.message || 'Failed to update support ticket');
    } finally {
      setSavingTicketId('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
        <p className="text-xs uppercase tracking-widest text-stone-400">
          Loading support tickets...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Support Tickets</h1>
          <p className="mt-1 text-sm text-stone-500">
            Review student concerns from the live <code>support_tickets</code> queue.
          </p>
        </div>

        <Button variant="outline" className="border-stone-200 bg-white" onClick={loadTickets}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card className="border-stone-200 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search category, student, description, or handler"
              className="border-stone-200 pl-9"
            />
          </div>
          <div className="w-full md:w-52">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="border-stone-200">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredTickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 px-8 py-14 text-center">
          <LifeBuoy className="mx-auto mb-3 h-8 w-8 text-stone-300" />
          <p className="text-sm font-semibold text-stone-700">No support tickets found</p>
          <p className="mt-1 text-xs text-stone-400">
            Try clearing the filters or wait for a student to submit a ticket.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.ticket_id} className="border-stone-200 shadow-none">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-stone-900">
                      {ticket.issue_category || 'Uncategorized'}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {ticket.student_name || 'Unknown Student'}
                      {ticket.student_number ? ` · ${ticket.student_number}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={ticket.status} />
                </div>

                <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700">
                  {ticket.description}
                </div>

                <div className="grid grid-cols-1 gap-3 text-xs text-stone-500 md:grid-cols-2">
                  <div className="rounded-lg border border-stone-200 px-3 py-2">
                    <p className="uppercase tracking-wide text-stone-400">Created</p>
                    <p className="mt-1 font-medium text-stone-800">
                      {formatDate(ticket.created_at)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stone-200 px-3 py-2">
                    <p className="uppercase tracking-wide text-stone-400">Handled By</p>
                    <p className="mt-1 font-medium text-stone-800">
                      {ticket.handler_name || 'Unassigned'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stone-200 px-3 py-2 md:col-span-2">
                    <p className="uppercase tracking-wide text-stone-400">Resolved At</p>
                    <p className="mt-1 font-medium text-stone-800">
                      {ticket.resolved_at ? formatDate(ticket.resolved_at) : 'Not resolved'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-stone-100 pt-4">
                  <div className="flex flex-wrap gap-2">
                    {!ticket.handled_by ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-stone-200 bg-white"
                        disabled={savingTicketId === ticket.ticket_id}
                        onClick={() =>
                          patchTicket(ticket.ticket_id, { assignToSelf: true })
                        }
                      >
                        <UserRoundCheck className="mr-2 h-4 w-4" />
                        Take Ownership
                      </Button>
                    ) : null}

                    {STATUS_OPTIONS.filter((item) => item !== 'All').map((item) => (
                      <Button
                        key={item}
                        size="sm"
                        variant={ticket.status === item ? 'default' : 'outline'}
                        className={
                          ticket.status === item
                            ? 'bg-stone-900 hover:bg-stone-800'
                            : 'border-stone-200 bg-white'
                        }
                        disabled={
                          savingTicketId === ticket.ticket_id || ticket.status === item
                        }
                        onClick={() => patchTicket(ticket.ticket_id, { status: item })}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>

                  {savingTicketId === ticket.ticket_id ? (
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating ticket...
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
