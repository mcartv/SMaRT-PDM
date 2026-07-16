import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    History,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

const C = {
    brownMid: '#7c4a2e',
    green: '#16a34a',
    greenSoft: '#F0FDF4',
    red: '#dc2626',
    redSoft: '#FEF2F2',
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
            className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={{
                background: active ? C.greenSoft : '#f5f5f4',
                color: active ? C.green : '#57534e',
            }}
        >
            {active ? 'Active' : 'Inactive'}
        </span>
    );
}

export default function ROSettingsPanel() {
    const [settings, setSettings] = useState([]);
    const [activeSetting, setActiveSetting] = useState(null);

    const [requiredHours, setRequiredHours] = useState(20);
    const [allowCarryOver, setAllowCarryOver] = useState(true);
    const [remarks, setRemarks] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activatingId, setActivatingId] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const activeSettingId = activeSetting?.setting_id || null;

    const sortedSettings = useMemo(() => {
        return [...settings].sort((a, b) => {
            if (a.is_active && !b.is_active) return -1;
            if (!a.is_active && b.is_active) return 1;

            return (
                new Date(b.updated_at || b.created_at || 0).getTime() -
                new Date(a.updated_at || a.created_at || 0).getTime()
            );
        });
    }, [settings]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            setError('');

            const [settingsResponse, activeResponse] = await Promise.all([
                fetch(buildApiUrl('/api/ro-settings'), {
                    headers: getHeaders(),
                }),
                fetch(buildApiUrl('/api/ro-settings/active'), {
                    headers: getHeaders(),
                }),
            ]);

            const settingsPayload = await settingsResponse.json().catch(() => ({}));
            const activePayload = await activeResponse.json().catch(() => ({}));

            if (!settingsResponse.ok) {
                throw new Error(settingsPayload.error || 'Failed to load RO settings.');
            }

            if (!activeResponse.ok) {
                throw new Error(activePayload.error || 'Failed to load active RO setting.');
            }

            const rows = parseItemsPayload(settingsPayload);
            const active = parseSettingPayload(activePayload);

            setSettings(rows);
            setActiveSetting(active);

            setRequiredHours(Number(active?.required_hours || 20));
            setAllowCarryOver(active?.allow_carry_over !== false);
            setRemarks(active?.remarks || '');
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
                remarks,
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

    const activateSetting = async (settingId) => {
        try {
            setActivatingId(settingId);
            setError('');
            setSuccess('');

            const response = await fetch(buildApiUrl(`/api/ro-settings/${settingId}/activate`), {
                method: 'PATCH',
                headers: getHeaders(),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Failed to activate RO setting.');
            }

            setSuccess(data.message || 'RO setting activated successfully.');
            await loadSettings();
        } catch (err) {
            console.error('ACTIVATE RO SETTING ERROR:', err);
            setError(err.message || 'Failed to activate RO setting.');
        } finally {
            setActivatingId('');
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[260px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-stone-300" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
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

            <Card className="rounded-2xl border-stone-200 bg-white shadow-none">
                <CardContent className="space-y-5 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-base font-semibold text-stone-900">
                                Return of Obligation Settings
                            </h2>
                            <p className="mt-1 text-sm text-stone-500">
                                Set how many RO hours scholars need to complete. The active setting can be used by the mobile RO progress screen.
                            </p>
                        </div>

                        <Button
                            variant="outline"
                            onClick={loadSettings}
                            className="h-10 rounded-xl border-stone-200 text-sm"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-stone-600">
                                Required RO Hours
                            </label>

                            <Input
                                type="number"
                                min="0"
                                value={requiredHours}
                                onChange={(event) => setRequiredHours(event.target.value)}
                                className="h-11 rounded-xl border-stone-200"
                            />

                            <p className="mt-1 text-xs text-stone-400">
                                Example: 20 means the scholar must complete 20 hours.
                            </p>
                        </div>

                        <div className="lg:col-span-2">
                            <label className="mb-1.5 block text-xs font-semibold text-stone-600">
                                Remarks
                            </label>

                            <Input
                                value={remarks}
                                onChange={(event) => setRemarks(event.target.value)}
                                placeholder="Example: Default RO hours for the current term"
                                className="h-11 rounded-xl border-stone-200"
                            />
                        </div>
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                        <input
                            type="checkbox"
                            checked={allowCarryOver}
                            onChange={(event) => setAllowCarryOver(event.target.checked)}
                        />

                        <div>
                            <p className="text-sm font-semibold text-stone-800">
                                Allow carry-over
                            </p>
                            <p className="text-xs text-stone-500">
                                Enable this if unfinished RO hours can carry over to the next period.
                            </p>
                        </div>
                    </label>

                    <div className="flex justify-end border-t border-stone-100 pt-4">
                        <Button
                            onClick={saveActiveSetting}
                            disabled={saving}
                            className="h-10 rounded-xl border-none text-white"
                            style={{ background: C.brownMid }}
                        >
                            {saving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Clock3 className="mr-2 h-4 w-4" />
                            )}
                            Save Active Setting
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <section
                className="overflow-hidden rounded-2xl border bg-white"
                style={{ borderColor: C.line }}
            >
                <div className="border-b border-stone-100 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-stone-500" />
                        <h3 className="text-sm font-semibold text-stone-800">
                            RO Settings History
                        </h3>
                    </div>

                    <p className="mt-1 text-xs text-stone-500">
                        Activate an older setting to reuse its required hours.
                    </p>
                </div>

                <div className="overflow-x-auto p-4">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-stone-200 bg-stone-50/70">
                                <th className="px-3 py-3 text-xs font-semibold text-stone-900">
                                    Required Hours
                                </th>
                                <th className="px-3 py-3 text-xs font-semibold text-stone-900">
                                    Carry Over
                                </th>
                                <th className="px-3 py-3 text-xs font-semibold text-stone-900">
                                    Remarks
                                </th>
                                <th className="px-3 py-3 text-xs font-semibold text-stone-900">
                                    Updated
                                </th>
                                <th className="px-3 py-3 text-xs font-semibold text-stone-900">
                                    Status
                                </th>
                                <th className="px-3 py-3 text-right text-xs font-semibold text-stone-900">
                                    Action
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-stone-100 bg-white">
                            {sortedSettings.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-3 py-10 text-center text-sm text-stone-400"
                                    >
                                        No RO settings found.
                                    </td>
                                </tr>
                            ) : (
                                sortedSettings.map((setting) => (
                                    <tr
                                        key={setting.setting_id}
                                        className="transition hover:bg-stone-50/70"
                                    >
                                        <td className="px-3 py-3 text-sm font-semibold text-stone-900">
                                            {setting.required_hours} hour
                                            {Number(setting.required_hours) === 1 ? '' : 's'}
                                        </td>

                                        <td className="px-3 py-3 text-xs text-stone-600">
                                            {setting.allow_carry_over ? 'Allowed' : 'Not Allowed'}
                                        </td>

                                        <td className="px-3 py-3 text-xs text-stone-600">
                                            <div className="max-w-[360px]">
                                                {setting.remarks || '—'}
                                            </div>
                                        </td>

                                        <td className="px-3 py-3 text-xs text-stone-500">
                                            {formatDateTime(setting.updated_at || setting.created_at)}
                                        </td>

                                        <td className="px-3 py-3">
                                            <StatusPill active={setting.is_active} />
                                        </td>

                                        <td className="px-3 py-3 text-right">
                                            {setting.is_active ? (
                                                <span className="text-xs font-medium text-stone-400">
                                                    Current active setting
                                                </span>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={activatingId === setting.setting_id}
                                                    onClick={() => activateSetting(setting.setting_id)}
                                                    className="h-8 rounded-lg border-stone-200 text-xs"
                                                >
                                                    {activatingId === setting.setting_id ? (
                                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                    ) : null}
                                                    Activate
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}