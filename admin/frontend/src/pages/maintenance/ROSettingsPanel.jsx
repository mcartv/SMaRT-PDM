import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Clock3,
    Loader2,
    CheckCircle2,
    RotateCcw,
    Save,
    Building2,
    Plus,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import {
    GroupCard,
    FieldLabel,
    Toggle,
    EmptyState,
} from './components/MaintenanceShared';

const C = {
    brownMid: '#7c4a2e',
};

function getAuthHeaders(json = true) {
    const token = localStorage.getItem('adminToken');

    return {
        ...(json ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
    };
}

export default function ROSettingsPanel() {
    const [settings, setSettings] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [departments, setDepartments] = useState([]);

    const [departmentName, setDepartmentName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingDepartment, setSavingDepartment] = useState(false);
    const [togglingDepartmentId, setTogglingDepartmentId] = useState(null);

    const [form, setForm] = useState({
        academic_year_id: '',
        period_id: '',
        required_hours: 20,
        allow_carry_over: true,
        is_active: true,
        remarks: '',
    });

    useEffect(() => {
        loadAll();
    }, []);

    async function loadAll() {
        try {
            setLoading(true);

            const [settingsRes, yearsRes, departmentsRes] = await Promise.all([
                fetch(buildApiUrl('/api/ro-settings'), {
                    headers: getAuthHeaders(false),
                }),
                fetch(buildApiUrl('/api/academic-years'), {
                    headers: getAuthHeaders(false),
                }),
                fetch(buildApiUrl('/api/ro-settings/departments'), {
                    headers: getAuthHeaders(false),
                }),
            ]);

            const settingsData = await settingsRes.json().catch(() => ({}));
            const yearsData = await yearsRes.json().catch(() => []);
            const departmentsData = await departmentsRes.json().catch(() => ({}));

            if (!settingsRes.ok) {
                throw new Error(settingsData.error || 'Failed to load RO settings.');
            }

            if (!yearsRes.ok) {
                throw new Error(yearsData.error || 'Failed to load academic years.');
            }

            if (!departmentsRes.ok) {
                throw new Error(
                    departmentsData.error || 'Failed to load RO departments.'
                );
            }

            const rows = Array.isArray(settingsData.items) ? settingsData.items : [];
            setSettings(rows);
            setAcademicYears(Array.isArray(yearsData) ? yearsData : []);
            setDepartments(
                Array.isArray(departmentsData.items) ? departmentsData.items : []
            );

            const active = rows.find((item) => item.is_active) || rows[0];

            if (active) {
                setForm({
                    academic_year_id: active.academic_year_id || '',
                    period_id: active.period_id || '',
                    required_hours: active.required_hours || 20,
                    allow_carry_over: active.allow_carry_over !== false,
                    is_active: true,
                    remarks: active.remarks || '',
                });
            }
        } catch (error) {
            console.error('LOAD RO SETTINGS ERROR:', error);
            alert(error.message || 'Failed to load RO settings.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        try {
            setSaving(true);

            const payload = {
                academic_year_id: form.academic_year_id || null,
                period_id: form.period_id || null,
                required_hours: Number(form.required_hours || 0),
                allow_carry_over: form.allow_carry_over,
                is_active: true,
                remarks: form.remarks,
            };

            const res = await fetch(buildApiUrl('/api/ro-settings'), {
                method: 'POST',
                headers: getAuthHeaders(true),
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Failed to save RO setting.');
            }

            await loadAll();
            alert('RO setting saved and activated.');
        } catch (error) {
            console.error('SAVE RO SETTINGS ERROR:', error);
            alert(error.message || 'Failed to save RO setting.');
        } finally {
            setSaving(false);
        }
    }

    async function handleActivate(settingId) {
        try {
            const res = await fetch(
                buildApiUrl(`/api/ro-settings/${settingId}/activate`),
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(true),
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Failed to activate setting.');
            }

            await loadAll();
        } catch (error) {
            console.error('ACTIVATE RO SETTING ERROR:', error);
            alert(error.message || 'Failed to activate setting.');
        }
    }

    async function handleAddDepartment() {
        try {
            const name = departmentName.trim();

            if (!name) {
                alert('Department name is required.');
                return;
            }

            setSavingDepartment(true);

            const res = await fetch(buildApiUrl('/api/ro-settings/departments'), {
                method: 'POST',
                headers: getAuthHeaders(true),
                body: JSON.stringify({
                    department_name: name,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Failed to add RO department.');
            }

            setDepartmentName('');
            await loadAll();
        } catch (error) {
            console.error('ADD RO DEPARTMENT ERROR:', error);
            alert(error.message || 'Failed to add RO department.');
        } finally {
            setSavingDepartment(false);
        }
    }

    async function handleToggleDepartment(departmentId) {
        try {
            setTogglingDepartmentId(departmentId);

            const res = await fetch(
                buildApiUrl(`/api/ro-settings/departments/${departmentId}/toggle`),
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(true),
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Failed to update department status.');
            }

            await loadAll();
        } catch (error) {
            console.error('TOGGLE RO DEPARTMENT ERROR:', error);
            alert(error.message || 'Failed to update department status.');
        } finally {
            setTogglingDepartmentId(null);
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-[260px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <GroupCard title="Active RO Requirement" icon={Clock3}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <FieldLabel>Academic Year</FieldLabel>
                        <select
                            className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm"
                            value={form.academic_year_id}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    academic_year_id: e.target.value,
                                }))
                            }
                        >
                            <option value="">No specific academic year</option>
                            {academicYears.map((year) => (
                                <option
                                    key={year.academic_year_id}
                                    value={year.academic_year_id}
                                >
                                    {year.label || `${year.start_year}-${year.end_year}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <FieldLabel>Required Hours</FieldLabel>
                        <Input
                            type="number"
                            min="0"
                            value={form.required_hours}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    required_hours: e.target.value,
                                }))
                            }
                        />
                    </div>

                    <div>
                        <FieldLabel>Allow Carry-Over</FieldLabel>
                        <Toggle
                            value={form.allow_carry_over}
                            onChange={(value) =>
                                setForm((prev) => ({
                                    ...prev,
                                    allow_carry_over: value,
                                }))
                            }
                            labels={['Allowed', 'Not Allowed']}
                        />
                    </div>

                    <div>
                        <FieldLabel>Remarks</FieldLabel>
                        <Input
                            value={form.remarks}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    remarks: e.target.value,
                                }))
                            }
                            placeholder="Example: RO requirement for current semester"
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-lg text-white"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Active Requirement
                    </Button>
                </div>
            </GroupCard>

            <GroupCard title="RO Departments" icon={Building2}>
                <div className="flex flex-col gap-3 md:flex-row">
                    <Input
                        value={departmentName}
                        onChange={(e) => setDepartmentName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleAddDepartment();
                            }
                        }}
                        placeholder="Example: Library, Registrar, Guidance Office"
                    />

                    <Button
                        onClick={handleAddDepartment}
                        disabled={savingDepartment}
                        className="rounded-lg text-white"
                        style={{ background: C.brownMid }}
                    >
                        {savingDepartment ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        Add Department
                    </Button>
                </div>

                {departments.length === 0 ? (
                    <EmptyState
                        icon={Building2}
                        title="No RO departments yet"
                        subtitle="Add offices where scholars can render obligations."
                    />
                ) : (
                    <div className="space-y-2">
                        {departments.map((department) => (
                            <div
                                key={department.department_id}
                                className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-stone-900">
                                        {department.department_name}
                                    </p>
                                    <p
                                        className={`text-xs ${department.is_active ? 'text-green-600' : 'text-stone-400'
                                            }`}
                                    >
                                        {department.is_active
                                            ? 'Available for RO assignment'
                                            : 'Inactive / hidden from assignment'}
                                    </p>
                                </div>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={togglingDepartmentId === department.department_id}
                                    onClick={() =>
                                        handleToggleDepartment(department.department_id)
                                    }
                                >
                                    {togglingDepartmentId === department.department_id ? (
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    ) : null}
                                    {department.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </GroupCard>

            <GroupCard title="RO Requirement History" icon={RotateCcw}>
                {settings.length === 0 ? (
                    <EmptyState
                        icon={Clock3}
                        title="No RO settings yet"
                        subtitle="Create the first active RO requirement above."
                    />
                ) : (
                    <div className="space-y-3">
                        {settings.map((item) => (
                            <div
                                key={item.setting_id}
                                className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-stone-900">
                                            {item.required_hours} required hours
                                        </p>

                                        {item.is_active && (
                                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700">
                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                                Active
                                            </span>
                                        )}
                                    </div>

                                    <p className="mt-1 text-xs text-stone-500">
                                        {item.academic_years?.label || 'No academic year'} ·{' '}
                                        {item.academic_period?.term || 'No period'} · Carry-over:{' '}
                                        {item.allow_carry_over ? 'Allowed' : 'Not allowed'}
                                    </p>

                                    {item.remarks && (
                                        <p className="mt-1 text-xs text-stone-400">
                                            {item.remarks}
                                        </p>
                                    )}
                                </div>

                                {!item.is_active && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleActivate(item.setting_id)}
                                    >
                                        Activate
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </GroupCard>
        </div>
    );
}