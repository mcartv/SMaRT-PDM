import React, { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    ClipboardList,
    Eye,
    EyeOff,
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
import {
    formatSystemLogActionLabel,
    formatSystemLogDescription,
} from '@/utils/systemLogText';
import SystemLogIcon from '@/components/system/SystemLogIcon';
import {
    MAINTENANCE_CARD_SUBTITLE_CLASS,
    MAINTENANCE_CARD_TITLE_CLASS,
} from './components/maintenanceTypography';

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


function formatActionLabel(action = '') {
    return formatSystemLogActionLabel(action);
}

function actionTone(action = '') {
    const text = String(action).toLowerCase();

    if (text.includes('create') || text.includes('import') || text.includes('restore')) {
        return 'bg-green-50 text-green-700 border-green-100';
    }

    if (text.includes('password') || text.includes('reset')) {
        return 'bg-amber-50 text-amber-800 border-amber-100';
    }

    if (text.includes('archive') || text.includes('reject')) {
        return 'bg-red-50 text-red-700 border-red-100';
    }

    if (text.includes('update') || text.includes('edit')) {
        return 'bg-blue-50 text-blue-700 border-blue-100';
    }

    return 'bg-stone-50 text-stone-700 border-stone-100';
}

export default function AuditPanel() {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [auditToken, setAuditToken] = useState('');
    const [unlocked, setUnlocked] = useState(false);

    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('all');
    const [moduleOptions, setModuleOptions] = useState([]);

    const isFiltered = search.trim() || moduleFilter !== 'all';
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
                    'Failed to load system logs.'
                );
            }

            setLogs(Array.isArray(data.items) ? data.items : []);
            setTotal(Number(data.total || 0));
            if (Array.isArray(data.modules)) {
                setModuleOptions(data.modules);
            }
        } catch (err) {
            const message = err.message || 'Failed to load system logs.';
            setError(message);

            if (
                message.toLowerCase().includes('expired') ||
                message.toLowerCase().includes('password') ||
                message.toLowerCase().includes('token')
            ) {
                setUnlocked(false);
                setAuditToken('');
                setPassword('');
                setShowPassword(false);
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
            setShowPassword(false);
        } catch (err) {
            setError(err.message || 'Failed to unlock system logs.');
        } finally {
            setUnlocking(false);
        }
    };

    const lockAuditPanel = () => {
        setUnlocked(false);
        setAuditToken('');
        setPassword('');
        setShowPassword(false);
        setLogs([]);
        setTotal(0);
        setModuleOptions([]);
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
                            <h2 className={MAINTENANCE_CARD_TITLE_CLASS}>
                                System Logs Access Restricted
                            </h2>
                            <p className={MAINTENANCE_CARD_SUBTITLE_CLASS}>
                                Enter your current account password to continue.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                            Account Password
                        </label>

                        <div className="relative">
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(event) => {
                                    setPassword(event.target.value);
                                    setError('');
                                }}
                                placeholder="Enter password"
                                className="h-9 rounded-lg border-stone-200 pr-10 text-sm"
                                autoComplete="current-password"
                            />

                            {password ? (
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((current) => !current)}
                                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {error ? (
                        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    ) : null}

                    <button
                        type="submit"
                        disabled={!password.trim() || unlocking}
                        className="mt-5 flex h-9 w-full items-center justify-center rounded-lg bg-[var(--portal-base)] px-3 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {unlocking ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {unlocking ? 'Unlocking...' : 'Unlock System Logs'}
                    </button>
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
                            <h2 className={MAINTENANCE_CARD_TITLE_CLASS}>
                                System Log Records
                            </h2>
                            <p className={MAINTENANCE_CARD_SUBTITLE_CLASS}>
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

                                <SelectContent position="popper" sideOffset={4} className="max-h-72">
                                    <SelectItem value="all">All Modules</SelectItem>
                                    {moduleOptions.map((moduleName) => (
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
                        Loading system logs...
                    </div>
                ) : error ? (
                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 bg-red-50 px-4 text-center text-xs text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                        {error}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex min-h-[260px] flex-col items-center justify-center px-4 text-center text-stone-400">
                        <ClipboardList size={42} className="mb-4 opacity-50" />
                        <p className="text-sm font-medium">No system logs found</p>
                        <p className="mt-1 text-xs">System actions will appear here once logged.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] text-xs">
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
                                </tr>
                            </thead>

                            <tbody>
                                {logs.map((log) => (
                                    <tr
                                        key={log.log_id}
                                        className="border-b last:border-b-0 hover:bg-stone-50"
                                    >
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
                                            <div className="flex items-center gap-2">
                                                <SystemLogIcon item={log} size="sm" />
                                                <span
                                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actionTone(log.action_taken)}`}
                                                >
                                                    {formatActionLabel(log.action_taken)}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-stone-600">
                                            <div className="max-w-[360px] truncate">
                                                {formatSystemLogDescription(log)}
                                            </div>
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
