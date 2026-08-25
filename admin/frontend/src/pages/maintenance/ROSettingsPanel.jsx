import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    AlertTriangle,
    Building2,
    CheckCircle2,
    Clock3,
    Loader2,
    Pencil,
    Plus,
    Power,
    RefreshCw,
    Save,
    Search,
    X,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';

const C = {
    brownMid: '#7c4a2e',
    green: '#16a34a',
    greenSoft: '#F0FDF4',
    red: '#dc2626',
    redSoft: '#FEF2F2',
    amber: '#d97706',
    amberSoft: '#FFF7ED',
    line: '#e7e5e4',
};

function getHeaders() {
    return {
        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json',
    };
}

function parseItemsPayload(payload) {
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

function parseSettingPayload(payload) {
    return payload?.setting || payload?.data?.setting || payload?.data || null;
}

function formatDateTime(value) {
    if (!value) return '—';

    try {
        return new Intl.DateTimeFormat('en-PH', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(value));
    } catch {
        return String(value);
    }
}

function StatusPill({ active }) {
    return (
        <span
            className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
                background: active ? C.greenSoft : '#f5f5f4',
                color: active ? C.green : '#57534e',
            }}
        >
            {active ? 'Active' : 'Inactive'}
        </span>
    );
}

function DepartmentModal({
    open,
    mode,
    value,
    setValue,
    onClose,
    onSave,
    saving,
}) {
    if (!open) return null;

    const isEdit = mode === 'edit';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-lg overflow-hidden border-stone-200 shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
                    <h3 className="text-sm font-semibold text-stone-800">
                        {isEdit ? 'Edit RO Department' : 'Add RO Department'}
                    </h3>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50"
                    >
                        <X size={14} />
                    </button>
                </div>

                <CardContent className="space-y-3 p-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                            Department / Office Name
                        </label>

                        <Input
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            placeholder="Example: Library, Registrar, Guidance Office"
                            className="h-9 rounded-lg border-stone-200 text-sm"
                        />
                    </div>
                </CardContent>

                <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                        className="h-8 rounded-lg border-stone-200 text-xs"
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={onSave}
                        disabled={saving || !value.trim()}
                        className="h-8 rounded-lg border-none text-xs text-white disabled:opacity-50"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {isEdit ? 'Save' : 'Create'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default function ROSettingsPanel() {
    const [settings, setSettings] = useState([]);
    const [activeSetting, setActiveSetting] = useState(null);
    const [departments, setDepartments] = useState([]);

    const [requiredHours, setRequiredHours] = useState(20);
    const [allowCarryOver, setAllowCarryOver] = useState(true);

    const [search, setSearch] = useState('');
    const [pageTab, setPageTab] = useState('current');

    const [departmentName, setDepartmentName] = useState('');
    const [editingDepartmentId, setEditingDepartmentId] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [departmentSaving, setDepartmentSaving] = useState(false);
    const [departmentActionId, setDepartmentActionId] = useState('');

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const activeSettingId = activeSetting?.setting_id || null;

    const currentCount = useMemo(
        () => departments.filter((item) => item.is_active !== false).length,
        [departments]
    );

    const inactiveCount = useMemo(
        () => departments.filter((item) => item.is_active === false).length,
        [departments]
    );

    const latestSettingText = useMemo(() => {
        if (!activeSetting?.updated_at && !activeSetting?.created_at) return 'Not yet saved';
        return formatDateTime(activeSetting.updated_at || activeSetting.created_at);
    }, [activeSetting]);

    const filteredDepartments = useMemo(() => {
        const q = search.trim().toLowerCase();

        return departments
            .filter((department) => {
                const isActive = department.is_active !== false;

                if (pageTab === 'current' && !isActive) return false;
                if (pageTab === 'inactive' && isActive) return false;

                if (!q) return true;

                return String(department.department_name || '')
                    .toLowerCase()
                    .includes(q);
            })
            .sort((a, b) =>
                String(a.department_name || '').localeCompare(
                    String(b.department_name || '')
                )
            );
    }, [departments, search, pageTab]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            setError('');

            const [settingsResponse, activeResponse, departmentsResponse] =
                await Promise.all([
                    fetch(buildApiUrl('/api/ro-settings'), {
                        headers: getHeaders(),
                    }),
                    fetch(buildApiUrl('/api/ro-settings/active'), {
                        headers: getHeaders(),
                    }),
                    fetch(buildApiUrl('/api/ro-settings/departments'), {
                        headers: getHeaders(),
                    }),
                ]);

            const settingsPayload = await settingsResponse.json().catch(() => ({}));
            const activePayload = await activeResponse.json().catch(() => ({}));
            const departmentsPayload = await departmentsResponse.json().catch(() => ({}));

            if (!settingsResponse.ok) {
                throw new Error(settingsPayload.error || 'Failed to load RO settings.');
            }

            if (!activeResponse.ok) {
                throw new Error(activePayload.error || 'Failed to load active RO setting.');
            }

            if (!departmentsResponse.ok) {
                throw new Error(
                    departmentsPayload.error || 'Failed to load RO departments.'
                );
            }

            const settingRows = parseItemsPayload(settingsPayload);
            const active = parseSettingPayload(activePayload);
            const departmentRows = parseItemsPayload(departmentsPayload);

            setSettings(settingRows);
            setActiveSetting(active);
            setDepartments(departmentRows);

            setRequiredHours(Number(active?.required_hours || 20));
            setAllowCarryOver(active?.allow_carry_over !== false);
        } catch (err) {
            console.error('LOAD RO SETTINGS ERROR:', err);
            setError(err.message || 'Failed to load RO settings.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    useSocketEvent(
        'ro:updated',
        () => {
            loadSettings();
        },
        []
    );

    useSocketEvent(
        'roUpdated',
        () => {
            loadSettings();
        },
        []
    );

    useSocketEvent(
        'maintenance:updated',
        () => {
            loadSettings();
        },
        []
    );

    const saveActiveSetting = async () => {
        try {
            setSaving(true);
            setError('');
            setSuccess('');

            const hours = Number.parseInt(requiredHours, 10);

            if (!Number.isInteger(hours) || hours < 0) {
                throw new Error('Required hours must be a non-negative whole number.');
            }

            const payload = {
                required_hours: hours,
                allow_carry_over: allowCarryOver,
                remarks: null,
                apply_to_pending: true,
            };

            let response;

            if (activeSettingId) {
                response = await fetch(buildApiUrl(`/api/ro-settings/${activeSettingId}`), {
                    method: 'PATCH',
                    headers: getHeaders(),
                    body: JSON.stringify(payload),
                });
            } else {
                response = await fetch(buildApiUrl('/api/ro-settings'), {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        ...payload,
                        is_active: true,
                    }),
                });
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save RO setting.');
            }

            setSuccess(data.message || 'RO setting saved successfully.');
            await loadSettings();
        } catch (err) {
            console.error('SAVE RO SETTING ERROR:', err);
            setError(err.message || 'Failed to save RO setting.');
        } finally {
            setSaving(false);
        }
    };

    const openCreateModal = () => {
        setModalMode('create');
        setEditingDepartmentId(null);
        setDepartmentName('');
        setError('');
        setSuccess('');
        setModalOpen(true);
    };

    const openEditModal = (department) => {
        setModalMode('edit');
        setEditingDepartmentId(department.department_id);
        setDepartmentName(department.department_name || '');
        setError('');
        setSuccess('');
        setModalOpen(true);
    };

    const closeDepartmentModal = () => {
        if (departmentSaving) return;

        setModalOpen(false);
        setModalMode('create');
        setEditingDepartmentId(null);
        setDepartmentName('');
    };

    const saveDepartment = async () => {
        try {
            setDepartmentSaving(true);
            setError('');
            setSuccess('');

            const name = String(departmentName || '').trim();

            if (!name) {
                throw new Error('Department name is required.');
            }

            const isEdit = modalMode === 'edit' && editingDepartmentId;

            const response = await fetch(
                buildApiUrl(
                    isEdit
                        ? `/api/ro-settings/departments/${editingDepartmentId}`
                        : '/api/ro-settings/departments'
                ),
                {
                    method: isEdit ? 'PATCH' : 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        departmentName: name,
                    }),
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save RO department.');
            }

            setSuccess(data.message || 'RO department saved successfully.');
            closeDepartmentModal();
            await loadSettings();
        } catch (err) {
            console.error('SAVE RO DEPARTMENT ERROR:', err);
            setError(err.message || 'Failed to save RO department.');
        } finally {
            setDepartmentSaving(false);
        }
    };

    const toggleDepartment = async (department) => {
        try {
            setDepartmentActionId(department.department_id);
            setError('');
            setSuccess('');

            const response = await fetch(
                buildApiUrl(`/api/ro-settings/departments/${department.department_id}/toggle`),
                {
                    method: 'PATCH',
                    headers: getHeaders(),
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update RO department status.');
            }

            setSuccess(data.message || 'RO department status updated successfully.');
            await loadSettings();
        } catch (err) {
            console.error('TOGGLE RO DEPARTMENT ERROR:', err);
            setError(err.message || 'Failed to update RO department status.');
        } finally {
            setDepartmentActionId('');
        }
    };

    const hasSearch = search.trim().length > 0;

    if (loading) {
        return (
            <div className="flex h-[260px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <DepartmentModal
                open={modalOpen}
                mode={modalMode}
                value={departmentName}
                setValue={setDepartmentName}
                onClose={closeDepartmentModal}
                onSave={saveDepartment}
                saving={departmentSaving}
            />

            {error ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            {success ? (
                <div className="flex items-start gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{success}</span>
                </div>
            ) : null}

            <div className="rounded-xl border border-stone-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                RO Configuration
                            </p>
                            <p className="mt-1 text-sm font-semibold text-stone-900">
                                Required hours: {Number(requiredHours || 0)} · Carry-over {allowCarryOver ? 'allowed' : 'not allowed'}
                            </p>
                            <p className="mt-0.5 text-xs text-stone-400">
                                Last updated: {latestSettingText}
                            </p>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadSettings}
                            className="h-8 rounded-lg border-stone-200 text-xs text-stone-600"
                        >
                            <RefreshCw className="mr-1 h-3.5 w-3.5" />
                            Refresh
                        </Button>
                    </div>

                    <div className="grid gap-3 border-t border-stone-100 pt-3 md:grid-cols-[220px_1fr_auto] md:items-end">
                        <div>
                            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                Required RO Hours
                            </label>

                            <Input
                                type="number"
                                min="0"
                                value={requiredHours}
                                onChange={(event) => setRequiredHours(event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                            />
                        </div>

                        <label className="flex h-9 cursor-pointer items-center gap-3 rounded-lg border border-stone-200 bg-white px-3">
                            <input
                                type="checkbox"
                                checked={allowCarryOver}
                                onChange={(event) => setAllowCarryOver(event.target.checked)}
                            />

                            <span className="text-xs font-semibold text-stone-700">
                                Allow carry-over
                            </span>
                        </label>

                        <Button
                            size="sm"
                            onClick={saveActiveSetting}
                            disabled={saving}
                            className="h-8 rounded-lg border-none text-xs text-white"
                            style={{ background: C.brownMid }}
                        >
                            {saving ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Clock3 className="mr-1 h-3.5 w-3.5" />
                            )}
                            Save Setting
                        </Button>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                RO Department Records
                            </p>
                            <p className="mt-1 text-sm font-semibold text-stone-900">
                                {currentCount} active · {inactiveCount} inactive
                            </p>
                        </div>

                        <div className="relative w-full md:w-[320px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                            <Input
                                placeholder="Search department..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="h-9 rounded-lg border-stone-200 bg-white pl-9 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-stone-100 pt-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPageTab('current')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${pageTab === 'current'
                                        ? 'bg-[#7c4a2e] text-white'
                                        : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                    }`}
                            >
                                Current ({currentCount})
                            </button>

                            <button
                                type="button"
                                onClick={() => setPageTab('inactive')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${pageTab === 'inactive'
                                        ? 'bg-[#7c4a2e] text-white'
                                        : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                    }`}
                            >
                                Inactive ({inactiveCount})
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {hasSearch ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSearch('')}
                                    className="h-8 rounded-lg border-stone-200 text-xs"
                                >
                                    Reset
                                </Button>
                            ) : null}

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={loadSettings}
                                className="h-8 rounded-lg border-stone-200 text-xs text-stone-600"
                            >
                                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                Refresh
                            </Button>

                            <Button
                                size="sm"
                                className="h-8 rounded-lg border-none text-xs text-white"
                                style={{ background: C.brownMid }}
                                onClick={openCreateModal}
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                {filteredDepartments.length === 0 ? (
                    <div className="flex min-h-[220px] flex-col items-center justify-center px-4 text-center text-stone-400">
                        <Building2 size={42} className="mb-4 opacity-50" />
                        <p className="text-sm font-medium">No departments found</p>
                        <p className="mt-1 text-xs">
                            Click the add button above to create an RO department.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredDepartments.map((department) => {
                            const isActive = department.is_active !== false;
                            const loadingThis =
                                departmentActionId === department.department_id;

                            return (
                                <div
                                    key={department.department_id}
                                    className="flex items-center justify-between px-4 py-3 hover:bg-stone-50"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-sm font-medium text-stone-900">
                                                {department.department_name}
                                            </h3>

                                            <StatusPill active={isActive} />
                                        </div>

                                        <p className="mt-1 truncate text-xs text-stone-400">
                                            Updated {formatDateTime(department.updated_at || department.created_at)}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 rounded-lg border-stone-200 px-2 text-xs"
                                            onClick={() => openEditModal(department)}
                                            disabled={departmentSaving || !!departmentActionId}
                                        >
                                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                            Edit
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className={`h-7 rounded-lg px-2 text-xs ${isActive
                                                    ? 'border-red-200 text-red-700 hover:bg-red-50'
                                                    : 'border-green-200 text-green-700 hover:bg-green-50'
                                                }`}
                                            onClick={() => toggleDepartment(department)}
                                            disabled={loadingThis}
                                        >
                                            {loadingThis ? (
                                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Power className="mr-1.5 h-3.5 w-3.5" />
                                            )}

                                            {isActive ? 'Deactivate' : 'Restore'}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}