import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  CheckCircle, XCircle, Clock, FileText, Building2,
  Calendar, User, Settings, RotateCcw,
  AlertTriangle, CheckCircle2, Plus, Loader2, X
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
  blue: '#1E3A8A',
  blueSoft: '#EFF6FF',
  border: '#e7e5e4',
  muted: '#78716c',
  text: '#1c1917',
  bg: '#faf7f2',
  white: '#FFFFFF',
};

const SCHOLARSHIP_STYLE = {
  TES: { bg: '#EFF6FF', color: '#1E3A8A' },
  TDP: { bg: '#F0FDF4', color: '#16a34a' },
  Private: { bg: '#FAF5FF', color: '#7c3aed' },
  Scholar: { bg: '#f3f4f6', color: '#6b7280' },
};

function ScholarPill({ program }) {
  const s = SCHOLARSHIP_STYLE[program] ?? SCHOLARSHIP_STYLE.Scholar;
  return (
    <span className="text-[10px] font-medium px-2 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
      {program}
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
    <span className="text-[10px] font-medium px-2 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
      {children}
    </span>
  );
}

function HoursBar({ logged, required }) {
  const pct = Math.min(100, Math.round((logged / required) * 100));
  const met = logged >= required;
  const color = met ? C.green : logged >= required * 0.5 ? C.amber : C.red;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
          Hours Progress
        </span>
        <span className="text-[11px] font-semibold" style={{ color }}>
          {logged}/{required} hrs · {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
      <div className="flex items-center gap-2 text-stone-400 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xs font-medium text-stone-800">{value || 'N/A'}</p>
    </div>
  );
}

function CreateROModal({ open, onClose, onSubmit, loading }) {
  const [scholarId, setScholarId] = useState('');
  const [departmentAssigned, setDepartmentAssigned] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [requiredHours, setRequiredHours] = useState(20);
  const [renderedHours, setRenderedHours] = useState(0);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [isCarryOver, setIsCarryOver] = useState(false);
  const [previousSemester, setPreviousSemester] = useState('');

  useEffect(() => {
    if (!open) {
      setScholarId('');
      setDepartmentAssigned('');
      setTaskDescription('');
      setRequiredHours(20);
      setRenderedHours(0);
      setDeadlineDate('');
      setIsCarryOver(false);
      setPreviousSemester('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <Card className="relative w-full max-w-2xl border-stone-200 shadow-xl bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/70">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Assign Return of Obligation</h3>
            <p className="text-xs text-stone-500 mt-0.5">Create a new RO record</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 text-stone-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Scholar ID</label>
              <Input value={scholarId} onChange={(e) => setScholarId(e.target.value)} className="mt-1 h-10 rounded-lg" />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Department Assigned</label>
              <Input value={departmentAssigned} onChange={(e) => setDepartmentAssigned(e.target.value)} className="mt-1 h-10 rounded-lg" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Task Description</label>
            <Input value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} className="mt-1 h-10 rounded-lg" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Required Hours</label>
              <Input type="number" value={requiredHours} onChange={(e) => setRequiredHours(e.target.value)} className="mt-1 h-10 rounded-lg" />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Rendered Hours</label>
              <Input type="number" value={renderedHours} onChange={(e) => setRenderedHours(e.target.value)} className="mt-1 h-10 rounded-lg" />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Deadline</label>
              <Input type="datetime-local" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className="mt-1 h-10 rounded-lg" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" checked={isCarryOver} onChange={(e) => setIsCarryOver(e.target.checked)} />
            <span className="text-sm text-stone-700">Carry-over obligation</span>
          </div>

          {isCarryOver && (
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Previous Semester</label>
              <Input value={previousSemester} onChange={(e) => setPreviousSemester(e.target.value)} className="mt-1 h-10 rounded-lg" />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="rounded-lg border-stone-200">Cancel</Button>
            <Button
              onClick={() => onSubmit({
                scholarId,
                departmentAssigned,
                taskDescription,
                requiredHours,
                renderedHours,
                deadlineDate,
                isCarryOver,
                previousSemester,
              })}
              disabled={loading}
              className="rounded-lg text-white border-none"
              style={{ background: C.brownMid }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
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
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const token = localStorage.getItem('adminToken');

  const initials = (name) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const loadROData = async (activeTab = tab) => {
    try {
      setLoading(true);

      const [summaryRes, configRes, listRes] = await Promise.all([
        fetch('http://localhost:5000/api/ro/summary', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:5000/api/ro/config', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:5000/api/ro?status=${activeTab}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const summaryData = await summaryRes.json().catch(() => ({}));
      const configData = await configRes.json().catch(() => ({}));
      const listData = await listRes.json().catch(() => ([]));

      if (!summaryRes.ok) throw new Error(summaryData.error || 'Failed to load RO summary');
      if (!configRes.ok) throw new Error(configData.error || 'Failed to load RO config');
      if (!listRes.ok) throw new Error(listData.error || 'Failed to load RO list');

      setItems(Array.isArray(listData) ? listData : []);
      setReqHours(configData.requiredHours || summaryData.requiredHours || 20);
      setCurrentSem(configData.currentSemester || summaryData.currentSemester || '1st Sem AY 2025-26');
      setHistory(Array.isArray(configData.history) ? configData.history : []);
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

  const stats = useMemo(() => {
    const pendingCount = tab === 'pending' ? items.length : 0;
    const verifiedCount = tab === 'verified' ? items.length : 0;
    const overdueCount = tab === 'overdue' ? items.length : 0;
    const carryOverCount = items.filter((item) => item.carryOver).length;

    return [
      { label: 'Pending', value: String(tab === 'pending' ? pendingCount : '—'), icon: Clock, accent: C.amber, soft: C.amberSoft },
      { label: 'Verified', value: String(tab === 'verified' ? verifiedCount : '—'), icon: CheckCircle2, accent: C.green, soft: C.greenSoft },
      { label: 'Overdue', value: String(tab === 'overdue' ? overdueCount : '—'), icon: AlertTriangle, accent: C.red, soft: C.redSoft },
      { label: 'Carry-Over', value: String(carryOverCount), icon: RotateCcw, accent: C.blue, soft: C.blueSoft },
    ];
  }, [items, tab]);

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);
      const res = await fetch(`http://localhost:5000/api/ro/${id}/approve`, {
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
      const res = await fetch(`http://localhost:5000/api/ro/${id}/reject`, {
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
      const res = await fetch(`http://localhost:5000/api/ro/${id}/assign-department`, {
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

  const handleSaveConfig = async () => {
    try {
      setConfigSaving(true);
      const res = await fetch('http://localhost:5000/api/ro/config', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentSemester: currentSem,
          requiredHours: reqHours,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save config');

      alert('Configuration updated.');
      await loadROData(tab);
    } catch (err) {
      alert(err.message || 'Failed to update requirements');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleCreateRO = async (payload) => {
    try {
      setCreateLoading(true);
      const res = await fetch('http://localhost:5000/api/ro', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">Loading RO workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2" style={{ background: C.bg }}>
      <CreateROModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateRO}
        loading={createLoading}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Return of Obligations
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            Monitor RO submissions, approvals, overdue cases, and semester requirements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-orange-600">Active Requirement</p>
            <p className="text-lg font-semibold text-orange-700 leading-tight">{reqHours} hrs</p>
            <p className="text-[11px] text-orange-500 mt-0.5">{currentSem}</p>
          </div>

          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="rounded-lg text-white text-xs border-none"
            style={{ background: C.brownMid }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Assign RO
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.soft }}>
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold" style={{ color: C.text }}>{s.value}</div>
              <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
          <CardTitle className="text-sm font-semibold text-stone-800">RO Tracking Workspace</CardTitle>
          <CardDescription className="text-xs">
            Review pending obligations, verified completions, and overdue cases
          </CardDescription>
        </CardHeader>

        <div className="flex flex-wrap border-b border-stone-100 bg-white px-2 pt-2">
          {[
            { key: 'pending', label: 'Pending', color: C.amber },
            { key: 'verified', label: 'Verified', color: C.green },
            { key: 'overdue', label: 'Overdue', color: C.red },
            { key: 'config', label: 'Settings', color: C.blue, icon: Settings },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${tab === t.key ? '' : 'text-stone-400 border-transparent hover:text-stone-600'
                }`}
              style={{
                borderBottomColor: tab === t.key ? t.color : 'transparent',
                color: tab === t.key ? t.color : undefined,
              }}
            >
              {t.icon ? <t.icon className="w-3.5 h-3.5" /> : null}
              {t.label}
            </button>
          ))}
        </div>

        {tab !== 'config' && (
          <div className="divide-y divide-stone-100">
            {items.map((ro) => (
              <div key={ro.id} className="p-5 hover:bg-stone-50/40 transition-colors">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                  <div className="xl:col-span-3 flex items-start gap-3">
                    <Avatar className="w-11 h-11 border border-stone-200 shadow-sm shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-blue-900 text-white">
                        {initials(ro.student.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">{ro.student.name}</p>
                      <p className="text-[11px] font-mono text-stone-400 mt-0.5">{ro.student.id}</p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ScholarPill program={ro.student.program} />
                        {ro.carryOver && <StatusChip tone="amber">Carry-Over</StatusChip>}
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-6 space-y-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400 mb-1">Obligation</p>
                      <p className="text-sm font-semibold text-stone-800 leading-tight">{ro.obligation}</p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusChip>{ro.type}</StatusChip>
                        {ro.prevSem ? <StatusChip tone="blue">From {ro.prevSem}</StatusChip> : null}
                        {ro.status === 'Overdue' ? <StatusChip tone="red">Overdue</StatusChip> : null}
                        {ro.status === 'Verified' ? <StatusChip tone="green">Verified</StatusChip> : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <InfoBlock
                        icon={Calendar}
                        label={tab === 'verified' ? 'Verified Date' : tab === 'overdue' ? 'Due Date' : 'Submitted'}
                        value={
                          tab === 'verified'
                            ? (ro.verifiedDate ? new Date(ro.verifiedDate).toLocaleDateString() : 'N/A')
                            : tab === 'overdue'
                              ? (ro.dueDate ? new Date(ro.dueDate).toLocaleDateString() : 'N/A')
                              : (ro.submitted ? new Date(ro.submitted).toLocaleDateString() : 'Pending submission')
                        }
                      />
                      <InfoBlock icon={Building2} label="Department" value={ro.dept} />
                      <InfoBlock icon={FileText} label="Document" value={ro.doc || 'No proof uploaded'} />
                    </div>

                    <HoursBar logged={ro.hoursLogged} required={reqHours} />

                    {ro.rejectionReason ? (
                      <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-red-500 font-medium">Rejection Reason</p>
                        <p className="text-xs font-medium text-red-700 mt-1">{ro.rejectionReason}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="xl:col-span-3 flex flex-col gap-2">
                    {tab === 'pending' && (
                      <>
                        <Button
                          onClick={() => handleApprove(ro.id)}
                          disabled={actionLoading === ro.id}
                          className="w-full h-10 rounded-lg text-white border-none"
                          style={{ background: C.green }}
                        >
                          {actionLoading === ro.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          Approve
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => handleReject(ro.id)}
                          disabled={actionLoading === ro.id}
                          className="w-full h-10 rounded-lg border-red-100 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => handleAssignDepartment(ro.id)}
                          disabled={actionLoading === ro.id}
                          className="w-full h-10 rounded-lg border-stone-200 text-stone-600"
                        >
                          <User className="w-4 h-4 mr-2" />
                          Assign to Dept
                        </Button>
                      </>
                    )}

                    {tab === 'verified' && (
                      <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-green-500 font-medium">Verification</p>
                        <p className="text-xs font-semibold text-green-700 mt-0.5">Approved and completed</p>
                      </div>
                    )}

                    {tab === 'overdue' && (
                      <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-red-500 font-medium">Overdue Alert</p>
                        <p className="text-xs font-semibold text-red-700 mt-0.5">Immediate follow-up recommended</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="p-10 text-center text-sm text-stone-400">
                No RO records found.
              </div>
            )}
          </div>
        )}

        {tab === 'config' && (
          <div className="p-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <Card className="xl:col-span-2 border-stone-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-stone-800">
                    RO Hours Configuration
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Set the active semester and the number of required hours for RO compliance
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        Active Semester
                      </label>
                      <Input
                        value={currentSem}
                        onChange={(e) => setCurrentSem(e.target.value)}
                        className="h-10 rounded-lg border-stone-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        Required Hours
                      </label>
                      <div className="flex items-center gap-4 rounded-lg border border-stone-200 px-4 py-3 bg-white">
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={reqHours}
                          onChange={(e) => setReqHours(parseInt(e.target.value))}
                          className="flex-1 accent-orange-600"
                        />
                        <span className="text-lg font-semibold text-orange-600 w-12 text-center">
                          {reqHours}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={handleSaveConfig}
                      disabled={configSaving}
                      className="h-10 rounded-lg text-white border-none"
                      style={{ background: C.blue }}
                    >
                      {configSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Update Requirements
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-stone-800">
                    Requirement History
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Previous semester RO baselines
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.sem}
                      className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-3 bg-white"
                    >
                      <div>
                        <p className="text-xs font-medium text-stone-800">{item.sem}</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">Required baseline</p>
                      </div>
                      <StatusChip tone="amber">{item.required} hrs</StatusChip>
                    </div>
                  ))}

                  {history.length === 0 && (
                    <div className="text-xs text-stone-400">No history available.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </Card>

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · RO Monitoring Layer
        </p>
      </footer>
    </div>
  );
}