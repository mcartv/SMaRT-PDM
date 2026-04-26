import React, { useEffect, useState } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Building2,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Loader2,
  X,
  ClipboardCheck,
  RotateCcw,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

const C = {
  brownMid: '#7c4a2e',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blue: '#1E3A8A',
  blueSoft: '#EFF6FF',
  bg: '#faf7f2',
};

const TAB_CONFIG = [
  { key: 'pending', label: 'Pending', icon: Clock, color: '#d97706' },
  { key: 'verified', label: 'Verified', icon: CheckCircle2, color: '#16a34a' },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle, color: '#dc2626' },
];

const SCHOLARSHIP_STYLE = {
  TES: { bg: '#EFF6FF', color: '#1E3A8A' },
  TDP: { bg: '#F0FDF4', color: '#16a34a' },
  Private: { bg: '#FAF5FF', color: '#7c3aed' },
  Scholar: { bg: '#f3f4f6', color: '#6b7280' },
};

function ScholarPill({ program }) {
  const s = SCHOLARSHIP_STYLE[program] ?? SCHOLARSHIP_STYLE.Scholar;

  return (
    <span
      className="rounded-full px-2 py-1 text-[10px] font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {program || 'Scholar'}
    </span>
  );
}

function StatusChip({ children, tone = 'default' }) {
  const map = {
    default: { bg: '#f5f5f4', color: '#57534e' },
    green: { bg: C.greenSoft, color: C.green },
    amber: { bg: C.amberSoft, color: C.amber },
    red: { bg: C.redSoft, color: C.red },
    blue: { bg: C.blueSoft, color: C.blue },
  };

  const s = map[tone] || map.default;

  return (
    <span
      className="rounded-full px-2 py-1 text-[10px] font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {children}
    </span>
  );
}

function HoursBar({ logged = 0, required = 1 }) {
  const safeRequired = Number(required) || 1;
  const safeLogged = Number(logged) || 0;
  const pct = Math.min(100, Math.round((safeLogged / safeRequired) * 100));
  const met = safeLogged >= safeRequired;
  const color = met ? C.green : safeLogged >= safeRequired * 0.5 ? C.amber : C.red;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
          Hours Progress
        </span>
        <span className="text-[11px] font-semibold" style={{ color }}>
          {safeLogged}/{safeRequired} hrs · {pct}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
      <div className="mb-1 flex items-center gap-2 text-stone-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-xs font-medium text-stone-800">{value || 'N/A'}</p>
    </div>
  );
}

function EmptyState({ tab, onAssign }) {
  const copy = {
    pending: {
      title: 'No pending RO submissions',
      desc: 'Submitted obligations that need review will appear here.',
    },
    verified: {
      title: 'No verified RO records',
      desc: 'Approved and completed obligations will appear here.',
    },
    overdue: {
      title: 'No overdue obligations',
      desc: 'Students with missed RO deadlines will appear here.',
    },
  };

  const current = copy[tab] || copy.pending;

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50">
        <ClipboardCheck className="h-6 w-6 text-stone-400" />
      </div>

      <h3 className="text-sm font-semibold text-stone-800">{current.title}</h3>
      <p className="mt-1 max-w-md text-xs leading-6 text-stone-500">{current.desc}</p>

      {tab === 'pending' && (
        <Button
          onClick={onAssign}
          size="sm"
          className="mt-4 rounded-lg border-none text-xs text-white"
          style={{ background: C.brownMid }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Assign RO
        </Button>
      )}
    </div>
  );
}

function CreateROModal({
  open,
  onClose,
  onSubmit,
  loading,
  activeRequiredHours = 10,
  allowCarryOver = true,
}) {
  const [scholarId, setScholarId] = useState('');
  const [departmentAssigned, setDepartmentAssigned] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [requiredHours, setRequiredHours] = useState(activeRequiredHours);
  const [renderedHours, setRenderedHours] = useState(0);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [isCarryOver, setIsCarryOver] = useState(false);
  const [previousSemester, setPreviousSemester] = useState('');

  useEffect(() => {
    if (!open) {
      setScholarId('');
      setDepartmentAssigned('');
      setTaskDescription('');
      setRequiredHours(activeRequiredHours);
      setRenderedHours(0);
      setDeadlineDate('');
      setIsCarryOver(false);
      setPreviousSemester('');
    }
  }, [open, activeRequiredHours]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <Card className="relative w-full max-w-2xl overflow-hidden border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">
              Assign Return of Obligation
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Create a new RO record for a scholar.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Scholar ID
              </label>
              <Input
                value={scholarId}
                onChange={(e) => setScholarId(e.target.value)}
                className="mt-1 h-10 rounded-lg"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Department Assigned
              </label>
              <Input
                value={departmentAssigned}
                onChange={(e) => setDepartmentAssigned(e.target.value)}
                className="mt-1 h-10 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
              Task Description
            </label>
            <Input
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="mt-1 h-10 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Required Hours
              </label>
              <Input
                type="number"
                value={requiredHours}
                onChange={(e) => setRequiredHours(e.target.value)}
                className="mt-1 h-10 rounded-lg"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Rendered Hours
              </label>
              <Input
                type="number"
                value={renderedHours}
                onChange={(e) => setRenderedHours(e.target.value)}
                className="mt-1 h-10 rounded-lg"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Deadline
              </label>
              <Input
                type="datetime-local"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="mt-1 h-10 rounded-lg"
              />
            </div>
          </div>

          {allowCarryOver && (
            <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <input
                type="checkbox"
                checked={isCarryOver}
                onChange={(e) => setIsCarryOver(e.target.checked)}
              />
              <span className="text-sm text-stone-700">Carry-over obligation</span>
            </label>
          )}

          {isCarryOver && (
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Previous Semester
              </label>
              <Input
                value={previousSemester}
                onChange={(e) => setPreviousSemester(e.target.value)}
                className="mt-1 h-10 rounded-lg"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-lg border-stone-200"
            >
              Cancel
            </Button>

            <Button
              onClick={() =>
                onSubmit({
                  scholarId,
                  departmentAssigned,
                  taskDescription,
                  requiredHours,
                  renderedHours,
                  deadlineDate,
                  isCarryOver,
                  previousSemester,
                })
              }
              disabled={loading}
              className="rounded-lg border-none text-white"
              style={{ background: C.brownMid }}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create RO
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ROAdmin() {
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [reqHours, setReqHours] = useState(20);
  const [currentSem, setCurrentSem] = useState('1st Sem AY 2025-26');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [activeROSetting, setActiveROSetting] = useState(null);

  const token = localStorage.getItem('adminToken');

  const initials = (name = '') =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const loadROData = async (activeTab = tab) => {
    try {
      setLoading(true);

      const [summaryRes, activeSettingRes, listRes] = await Promise.all([
        fetch(buildApiUrl('/api/ro/summary'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(buildApiUrl('/api/ro-settings/active'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(buildApiUrl(`/api/ro?status=${activeTab}`), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const summaryData = await summaryRes.json().catch(() => ({}));
      const activeSettingData = await activeSettingRes.json().catch(() => ({}));
      const listData = await listRes.json().catch(() => []);

      if (!summaryRes.ok) {
        throw new Error(summaryData.error || 'Failed to load RO summary');
      }

      if (!activeSettingRes.ok) {
        throw new Error(activeSettingData.error || 'Failed to load active RO setting');
      }

      if (!listRes.ok) {
        throw new Error(listData.error || 'Failed to load RO list');
      }

      const setting = activeSettingData.setting || null;

      setActiveROSetting(setting);
      setItems(Array.isArray(listData) ? listData : []);
      setReqHours(setting?.required_hours || summaryData.requiredHours || 20);

      setCurrentSem(
        setting?.academic_period?.term ||
        setting?.academic_years?.label ||
        summaryData.currentSemester ||
        'Active RO Requirement'
      );
    } catch (err) {
      console.error('LOAD RO ERROR:', err);
      alert(err.message || 'Failed to load RO data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadROData(tab);
  }, [tab]);

  useSocketEvent(
    'scholar:updated',
    () => {
      loadROData(tab);
    },
    []
  );

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);

      const res = await fetch(buildApiUrl(`/api/ro/${id}/approve`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to approve RO');

      await loadROData(tab);
    } catch (err) {
      alert(err.message || 'Failed to approve RO');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;

    try {
      setActionLoading(id);

      const res = await fetch(buildApiUrl(`/api/ro/${id}/reject`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to reject RO');

      await loadROData(tab);
    } catch (err) {
      alert(err.message || 'Failed to reject RO');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignDepartment = async (id) => {
    const departmentAssigned = window.prompt('Enter department assignment:');
    if (!departmentAssigned) return;

    try {
      setActionLoading(id);

      const res = await fetch(buildApiUrl(`/api/ro/${id}/assign-department`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ departmentAssigned }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to assign department');

      await loadROData(tab);
    } catch (err) {
      alert(err.message || 'Failed to assign department');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateRO = async (payload) => {
    try {
      setCreateLoading(true);

      const res = await fetch(buildApiUrl('/api/ro'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          requiredHours: Number(payload.requiredHours || reqHours || 20),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create RO');

      setCreateOpen(false);
      await loadROData(tab);
    } catch (err) {
      alert(err.message || 'Failed to create RO');
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
        <p className="text-xs uppercase tracking-widest text-stone-400">
          Loading RO workspace...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2" style={{ background: C.bg }}>
      <CreateROModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateRO}
        loading={createLoading}
        activeRequiredHours={reqHours}
        allowCarryOver={activeROSetting?.allow_carry_over !== false}
      />

      <Card className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-none">
        <div className="flex flex-col gap-4 border-b border-stone-100 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-stone-900">
              RO Tracking Workspace
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Review, assign, and verify scholar return-of-obligation records.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-full border border-orange-100 bg-white px-3 py-2 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-orange-500" />

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                  Active Requirement
                </span>

                <span className="text-xs font-semibold text-stone-800">
                  {reqHours} hrs
                </span>

                <span className="text-[10px] text-stone-400">
                  {currentSem}
                </span>
              </div>
            </div>

            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              className="h-10 rounded-xl border-none px-4 text-xs text-white"
              style={{ background: C.brownMid }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Assign RO
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap border-b border-stone-100 bg-stone-50/50 px-3">
          {TAB_CONFIG.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;

            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${active ? '' : 'text-stone-400 hover:text-stone-600'
                  }`}
                style={{ color: active ? t.color : undefined }}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 h-[2px] w-full"
                    style={{ background: t.color }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="divide-y divide-stone-100">
          {items.length === 0 ? (
            <EmptyState tab={tab} onAssign={() => setCreateOpen(true)} />
          ) : (
            items.map((ro) => (
              <div key={ro.id} className="p-5 transition-colors hover:bg-stone-50/40">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                  <div className="flex items-start gap-3 xl:col-span-3">
                    <Avatar className="h-11 w-11 shrink-0 border border-stone-200 shadow-sm">
                      <AvatarImage
                        src={ro.student?.avatarUrl || undefined}
                        alt={ro.student?.name || 'Scholar'}
                      />
                      <AvatarFallback className="bg-blue-900 text-xs font-semibold text-white">
                        {initials(ro.student?.name || 'Scholar')}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {ro.student?.name || 'Unknown Scholar'}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-stone-400">
                        {ro.student?.id || 'N/A'}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ScholarPill program={ro.student?.program} />
                        {ro.carryOver && <StatusChip tone="amber">Carry-Over</StatusChip>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 xl:col-span-6">
                    <div>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        Obligation
                      </p>
                      <p className="text-sm font-semibold leading-tight text-stone-800">
                        {ro.obligation || 'No obligation description'}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusChip>{ro.type || 'RO'}</StatusChip>
                        {ro.prevSem ? (
                          <StatusChip tone="blue">From {ro.prevSem}</StatusChip>
                        ) : null}
                        {ro.status === 'Overdue' ? (
                          <StatusChip tone="red">Overdue</StatusChip>
                        ) : null}
                        {ro.status === 'Verified' ? (
                          <StatusChip tone="green">Verified</StatusChip>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <InfoBlock
                        icon={Calendar}
                        label={
                          tab === 'verified'
                            ? 'Verified Date'
                            : tab === 'overdue'
                              ? 'Due Date'
                              : 'Submitted'
                        }
                        value={
                          tab === 'verified'
                            ? ro.verifiedDate
                              ? new Date(ro.verifiedDate).toLocaleDateString()
                              : 'N/A'
                            : tab === 'overdue'
                              ? ro.dueDate
                                ? new Date(ro.dueDate).toLocaleDateString()
                                : 'N/A'
                              : ro.submitted
                                ? new Date(ro.submitted).toLocaleDateString()
                                : 'Pending submission'
                        }
                      />

                      <InfoBlock icon={Building2} label="Department" value={ro.dept} />
                      <InfoBlock icon={FileText} label="Document" value={ro.doc || 'No proof uploaded'} />
                    </div>

                    <HoursBar logged={ro.hoursLogged} required={reqHours} />

                    {ro.rejectionReason ? (
                      <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-red-500">
                          Rejection Reason
                        </p>
                        <p className="mt-1 text-xs font-medium text-red-700">
                          {ro.rejectionReason}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 xl:col-span-3">
                    {tab === 'pending' && (
                      <>
                        <Button
                          onClick={() => handleApprove(ro.id)}
                          disabled={actionLoading === ro.id}
                          className="h-10 w-full rounded-lg border-none text-white"
                          style={{ background: C.green }}
                        >
                          {actionLoading === ro.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          )}
                          Approve
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => handleReject(ro.id)}
                          disabled={actionLoading === ro.id}
                          className="h-10 w-full rounded-lg border-red-100 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => handleAssignDepartment(ro.id)}
                          disabled={actionLoading === ro.id}
                          className="h-10 w-full rounded-lg border-stone-200 text-stone-600"
                        >
                          <User className="mr-2 h-4 w-4" />
                          Assign to Dept
                        </Button>
                      </>
                    )}

                    {tab === 'verified' && (
                      <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-green-500">
                          Verification
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-green-700">
                          Approved and completed
                        </p>
                      </div>
                    )}

                    {tab === 'overdue' && (
                      <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-red-500">
                          Overdue Alert
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-red-700">
                          Immediate follow-up recommended
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}