import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ClipboardList,
    Eye,
    Loader2,
    Lock,
    RefreshCw,
    Search,
    ShieldCheck,
    X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';

function getAuthHeaders(extra = {}) {
    return {
        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json',
        ...extra,
    };
}

function formatDateTime(value) {
    if (!value) return '-';

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

function actionTone(action = '') {
    const text = String(action).toLowerCase();

    if (text.includes('create') || text.includes('import') || text.includes('restore')) {
        return 'bg-green-50 text-green-700 border-green-100';
    }

    if (text.includes('archive') || text.includes('delete') || text.includes('reject')) {
        return 'bg-red-50 text-red-700 border-red-100';
    }

    if (text.includes('update') || text.includes('edit')) {
        return 'bg-blue-50 text-blue-700 border-blue-100';
    }

    return 'bg-stone-50 text-stone-700 border-stone-100';
}

export default function AuditPanel() {
    const [password, setPassword] = useState('');
    const [auditToken, setAuditToken] = useState('');
    const [unlocked, setUnlocked] = useState(false);

    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('all');

    const isFiltered = search.trim() || moduleFilter !== 'all';

    const modules = useMemo(() => {
        const unique = new Set();

        logs.forEach((log) => {
            if (log.module) unique.add(log.module);
        });

        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [logs]);

    const loadLogs = useCallback(async () => {
        if (!auditToken) return;

        try {
            setLoading(true);
            setError('');

            const params = new URLSearchParams();
            params.set('limit', '150');
            params.set('offset', '0');

            if (search.trim()) {
                params.set('search', search.trim());
            }

            if (moduleFilter !== 'all') {
                params.set('module', moduleFilter);
            }

            const response = await fetch(
                buildApiUrl(`/api/audit-logs?${params.toString()}`),
                {
                    headers: getAuthHeaders({
                        'x-audit-access-token': auditToken,
                    }),
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.error?.message ||
                    data.message ||
                    'Failed to load audit logs.'
                );
            }

            setLogs(Array.isArray(data.items) ? data.items : []);
            setTotal(Number(data.total || 0));
        } catch (err) {
            const message = err.message || 'Failed to load audit logs.';
            setError(message);

            if (
                message.toLowerCase().includes('expired') ||
                message.toLowerCase().includes('password') ||
                message.toLowerCase().includes('token')
            ) {
                setUnlocked(false);
                setAuditToken('');
                setPassword('');
            }
        } finally {
            setLoading(false);
        }
    }, [auditToken, search, moduleFilter]);

    useEffect(() => {
        if (unlocked && auditToken) {
            loadLogs();
        }
    }, [unlocked, auditToken, loadLogs]);

    useSocketEvent(
        'maintenance:updated',
        () => {
            if (unlocked && auditToken) {
                loadLogs();
            }
        },
        [unlocked, auditToken, loadLogs]
    );

    const handleUnlock = async (event) => {
        event.preventDefault();

        if (!password.trim()) {
            setError('Enter your account password.');
            return;
        }

        try {
            setUnlocking(true);
            setError('');

            const response = await fetch(buildApiUrl('/api/audit-logs/verify-password'), {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    password,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.error?.message ||
                    data.message ||
                    'Incorrect password.'
                );
            }

            setAuditToken(data.audit_access_token);
            setUnlocked(true);
            setPassword('');
        } catch (err) {
            setError(err.message || 'Failed to unlock audit trail.');
        } finally {
            setUnlocking(false);
        }
    };

    const lockAuditPanel = () => {
        setUnlocked(false);
        setAuditToken('');
        setPassword('');
        setLogs([]);
        setTotal(0);
        setError('');
    };

    if (!unlocked) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <form
                    onSubmit={handleUnlock}
                    className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
                >
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                            <Lock className="h-5 w-5" />
                        </div>

                        <div>
                            <h2 className="text-sm font-semibold text-stone-900">
                                Audit Trail Access Restricted
                            </h2>
                            <p className="mt-0.5 text-xs text-stone-500">
                                Enter your current account password to continue.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                            Account Password
                        </label>

                        <Input
                            type="password"
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value);
                                setError('');
                            }}
                            placeholder="Enter password"
                            className="h-9 rounded-lg border-stone-200 text-sm"
                        />
                    </div>

                    {error ? (
                        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    ) : null}

                    <Button
                        type="submit"
                        disabled={unlocking}
                        className="mt-5 h-9 w-full rounded-lg text-xs text-white"
                    >
                        {unlocking ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Unlock Audit Trail
                    </Button>
                </form>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                Audit Trail Records
                            </p>
                            <p className="mt-1 text-sm font-semibold text-stone-900">
                                {total} logged actions
                            </p>
                        </div>

                        <div className="relative w-full md:w-[340px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search action, user, or module..."
                                className="h-9 rounded-lg border-stone-200 bg-white pl-9 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-stone-100 pt-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                            <ClipboardList className="h-4 w-4" />
                            Password unlock expires after 10 minutes.
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={moduleFilter} onValueChange={setModuleFilter}>
                                <SelectTrigger className="h-8 w-[190px] rounded-lg border-stone-200 text-xs">
                                    <SelectValue placeholder="Filter module" />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value="all">All Modules</SelectItem>
                                    {modules.map((moduleName) => (
                                        <SelectItem key={moduleName} value={moduleName}>
                                            {moduleName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {isFiltered ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearch('');
                                        setModuleFilter('all');
                                    }}
                                    className="h-8 rounded-lg border-stone-200 text-xs"
                                >
                                    Reset
                                </Button>
                            ) : null}

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadLogs}
                                disabled={loading}
                                className="h-8 rounded-lg border-stone-200 text-xs"
                            >
                                {loading ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Refresh
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={lockAuditPanel}
                                className="h-8 rounded-lg border-stone-200 text-xs"
                            >
                                <X className="mr-1.5 h-3.5 w-3.5" />
                                Lock
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                {loading ? (
                    <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-xs text-stone-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading audit trail...
                    </div>
                ) : error ? (
                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 bg-red-50 px-4 text-center text-xs text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                        {error}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex min-h-[260px] flex-col items-center justify-center px-4 text-center text-stone-400">
                        <ClipboardList size={42} className="mb-4 opacity-50" />
                        <p className="text-sm font-medium">No audit logs found</p>
                        <p className="mt-1 text-xs">System actions will appear here once logged.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-xs">
                            <thead className="bg-stone-50 text-stone-500">
                                <tr>
                                    <th className="border-b px-4 py-3 text-left font-semibold">
                                        Date / Time
                                    </th>
                                    <th className="border-b px-4 py-3 text-left font-semibold">
                                        User
                                    </th>
                                    <th className="border-b px-4 py-3 text-left font-semibold">
                                        Module
                                    </th>
                                    <th className="border-b px-4 py-3 text-left font-semibold">
                                        Action
                                    </th>
                                    <th className="border-b px-4 py-3 text-left font-semibold">
                                        Description
                                    </th>
                                    <th className="border-b px-4 py-3 text-left font-semibold">
                                        IP Address
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.log_id} className="border-b last:border-b-0 hover:bg-stone-50">
                                        <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                                            {formatDateTime(log.timestamp)}
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="max-w-[220px]">
                                                <p className="truncate font-medium text-stone-800">
                                                    {log.actor_email || 'Unknown user'}
                                                </p>
                                                <p className="truncate text-[11px] text-stone-400">
                                                    {log.actor_role || 'No role'}
                                                </p>
                                            </div>
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                                            {log.module || 'System'}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span
                                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actionTone(log.action_taken)}`}
                                            >
                                                {log.action_taken}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3 text-stone-600">
                                            <div className="max-w-[360px] truncate">
                                                {log.description || '-'}
                                            </div>
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-stone-500">
                                            {log.ip_address || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}