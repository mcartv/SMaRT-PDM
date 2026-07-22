import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildApiUrl } from '@/api';
import {
    User,
    Mail,
    Phone,
    Building2,
    Shield,
    Clock3,
    Activity,
    MapPin,
    Monitor,
    Smartphone,
    BadgeCheck,
    Settings,
    ChevronRight,
    KeyRound,
    Loader2,
    AlertCircle,
    RefreshCw,
} from 'lucide-react';



function formatDateTime(value) {
    if (!value) return 'Unknown time';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';

    return date.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function parseDevice(userAgent = '') {
    const ua = String(userAgent || '').toLowerCase();

    const browser = ua.includes('edg/')
        ? 'Edge'
        : ua.includes('chrome/')
            ? 'Chrome'
            : ua.includes('firefox/')
                ? 'Firefox'
                : ua.includes('safari/')
                    ? 'Safari'
                    : 'Browser';

    const platform = ua.includes('android')
        ? 'Android'
        : ua.includes('iphone') || ua.includes('ipad')
            ? 'iOS'
            : ua.includes('windows')
                ? 'Windows'
                : ua.includes('mac os')
                    ? 'macOS'
                    : ua.includes('linux')
                        ? 'Linux'
                        : 'Unknown device';

    return {
        label: `${browser} · ${platform}`,
        type:
            ua.includes('android') ||
            ua.includes('iphone') ||
            ua.includes('ipad')
                ? 'mobile'
                : 'desktop',
    };
}

function formatAuditAction(item = {}) {
    const description = String(item.description || '').trim();
    if (description) return description;

    const action = String(item.action_taken || 'Activity')
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/^\w/, (letter) => letter.toUpperCase());

    return item.module ? `${action} · ${item.module}` : action;
}

function SectionCard({ title, subtitle, icon: Icon, children, action }) {
    return (
        <Card className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-none">
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-4 py-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white">
                        <Icon className="h-4 w-4 text-stone-600" />
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
                        {subtitle ? (
                            <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>
                        ) : null}
                    </div>
                </div>

                {action ? <div className="shrink-0">{action}</div> : null}
            </div>

            <CardContent className="p-4">{children}</CardContent>
        </Card>
    );
}

function InfoRow({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl border border-stone-100 bg-stone-50/40 px-4 py-3">
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white">
                    <Icon className="h-4 w-4 text-stone-500" />
                </div>

                <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
                        {label}
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold text-stone-800">
                        {value || '—'}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function AdminProfile() {
    const [savedProfile] = useState(() => {
        const saved = sessionStorage.getItem('adminProfile');
        try {
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [adminData] = useState({
        firstName: savedProfile?.first_name || 'Carmelita',
        lastName: savedProfile?.last_name || 'Dela Cruz',
        email: savedProfile?.email || 'cdelacruz@pdm.edu.ph',
        phone: savedProfile?.phone || savedProfile?.phone_number || '+63 917 123 4567',
        position: savedProfile?.position || 'OSFA Administrator',
        department: savedProfile?.department || 'Office for Scholarship and Financial Assistance',
        role: savedProfile?.role || 'Super Admin',
        status: savedProfile?.is_active === false ? 'Inactive' : 'Active',
        bio: 'Oversees scholarship records, scholar compliance, announcements, and administrative coordination for the SMaRT-PDM platform.',
        avatarUrl:
            savedProfile?.avatar_url ||
            savedProfile?.profile_photo_url ||
            savedProfile?.photo_url ||
            savedProfile?.image_url ||
            '',
    });

    const [recentSessions, setRecentSessions] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [activityLoading, setActivityLoading] = useState(true);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [activityError, setActivityError] = useState('');
    const [sessionsError, setSessionsError] = useState('');

    const loadRecentActivity = useCallback(async () => {
        try {
            setActivityLoading(true);
            setActivityError('');

            const response = await fetch(
                buildApiUrl('/api/audit-logs/recent-activity?limit=8'),
                {
                    headers: {
                        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                    },
                }
            );

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload.message ||
                    payload.error ||
                    'Failed to load recent activity.'
                );
            }

            setRecentActivity(Array.isArray(payload.items) ? payload.items : []);
        } catch (error) {
            setActivityError(error.message || 'Failed to load recent activity.');
        } finally {
            setActivityLoading(false);
        }
    }, []);

    const loadRecentSessions = useCallback(async () => {
        try {
            setSessionsLoading(true);
            setSessionsError('');

            const response = await fetch(
                buildApiUrl('/api/auth/session/recent?limit=8'),
                {
                    headers: {
                        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                    },
                }
            );

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload.message ||
                    payload.error ||
                    'Failed to load recent sessions.'
                );
            }

            setRecentSessions(Array.isArray(payload.items) ? payload.items : []);
        } catch (error) {
            setSessionsError(error.message || 'Failed to load recent sessions.');
        } finally {
            setSessionsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRecentActivity();
        loadRecentSessions();
    }, [loadRecentActivity, loadRecentSessions]);

    const fullName = `${adminData.firstName} ${adminData.lastName}`.trim();

    const initials = useMemo(() => {
        const a = adminData.firstName?.[0] || '';
        const b = adminData.lastName?.[0] || '';
        return `${a}${b}`.toUpperCase() || 'AD';
    }, [adminData.firstName, adminData.lastName]);

    return (
        <div className="space-y-5 py-2">
            <Card className="overflow-hidden rounded-3xl border-stone-200 bg-white shadow-none">
                <CardContent className="p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <Avatar className="h-20 w-20 border-4 border-white shadow-sm">
                                <AvatarImage src={adminData.avatarUrl || undefined} alt={fullName} />
                                <AvatarFallback className="bg-stone-800 text-xl font-bold text-white">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                                        {fullName}
                                    </h1>

                                    <Badge className="border border-green-100 bg-green-50 text-green-700 hover:bg-green-50">
                                        <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                                        {adminData.status}
                                    </Badge>

                                    <Badge
                                        variant="outline"
                                        className="border-stone-200 bg-white text-stone-600"
                                    >
                                        {adminData.role}
                                    </Badge>
                                </div>

                                <p className="mt-2 text-sm font-medium text-stone-700">
                                    {adminData.position}
                                </p>
                                <p className="mt-1 text-xs uppercase tracking-wider text-stone-400">
                                    {adminData.department}
                                </p>

                                <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
                                    {adminData.bio}
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            className="w-fit rounded-xl border-stone-200 text-stone-700"
                            onClick={() => (window.location.href = '/admin/maintenance')}
                        >
                            <Settings className="mr-2 h-4 w-4" />
                            Open Maintenance
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <div className="space-y-5 xl:col-span-2">
                    <SectionCard
                        title="Account Information"
                        subtitle="Read-only profile details for this admin account."
                        icon={User}
                        action={
                            <Badge
                                variant="outline"
                                className="hidden rounded-full border-stone-200 bg-white text-stone-500 sm:inline-flex"
                            >
                                View Only
                            </Badge>
                        }
                    >
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <InfoRow icon={User} label="Full Name" value={fullName} />
                            <InfoRow icon={Shield} label="Role" value={adminData.role} />
                            <InfoRow icon={Mail} label="Email Address" value={adminData.email} />
                            <InfoRow icon={Phone} label="Phone Number" value={adminData.phone} />
                            <InfoRow icon={Building2} label="Department" value={adminData.department} />
                            <InfoRow icon={KeyRound} label="Position / Role Title" value={adminData.position} />
                        </div>

                        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                            <p className="text-sm font-medium text-amber-800">
                                Profile updates and account editing are managed in{' '}
                                <span className="font-semibold">Maintenance</span>.
                            </p>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Recent Activity"
                        subtitle="Latest actions recorded in the Audit Trail for this admin account."
                        icon={Activity}
                        action={
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={loadRecentActivity}
                                disabled={activityLoading}
                                className="h-8 rounded-lg border-stone-200 px-2.5 text-xs"
                            >
                                {activityLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        }
                    >
                        {activityLoading ? (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading recent activity...
                            </div>
                        ) : activityError ? (
                            <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{activityError}</span>
                            </div>
                        ) : recentActivity.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-500">
                                No audit activity has been recorded for this account yet.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recentActivity.map((item) => (
                                    <div
                                        key={item.log_id}
                                        className="flex flex-col gap-2 rounded-xl border border-stone-100 bg-stone-50/40 px-4 py-3 md:flex-row md:items-center md:justify-between"
                                    >
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-stone-700">
                                                    {formatAuditAction(item)}
                                                </p>
                                                <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-400">
                                                    {item.module || 'System activity'}
                                                </p>
                                            </div>
                                        </div>

                                        <p className="whitespace-nowrap text-xs text-stone-400">
                                            {formatDateTime(item.timestamp)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </div>

                <div className="space-y-5">
                    <SectionCard
                        title="Account Status"
                        subtitle="Current standing of this administrator account."
                        icon={Shield}
                    >
                        <div className="space-y-3">
                            <InfoRow icon={Shield} label="Status" value={adminData.status} />
                            <InfoRow icon={BadgeCheck} label="Access Level" value={adminData.role} />
                            <InfoRow icon={Building2} label="Assigned Office" value={adminData.department} />
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Recent Sessions"
                        subtitle="Current and previous sign-ins recorded for this admin account."
                        icon={Clock3}
                        action={
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={loadRecentSessions}
                                disabled={sessionsLoading}
                                className="h-8 rounded-lg border-stone-200 px-2.5 text-xs"
                            >
                                {sessionsLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        }
                    >
                        {sessionsLoading ? (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading recent sessions...
                            </div>
                        ) : sessionsError ? (
                            <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{sessionsError}</span>
                            </div>
                        ) : recentSessions.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-500">
                                No recent sessions were found.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentSessions.map((session) => {
                                    const device = parseDevice(session.user_agent);
                                    const Icon =
                                        device.type === 'mobile'
                                            ? Smartphone
                                            : Monitor;

                                    return (
                                        <div
                                            key={session.session_id}
                                            className="rounded-xl border border-stone-100 bg-stone-50/40 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div
                                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                                                            session.is_current
                                                                ? 'border-green-100 bg-green-50 text-green-700'
                                                                : 'border-stone-200 bg-white text-stone-500'
                                                        }`}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-stone-800">
                                                            {device.label}
                                                        </p>

                                                        <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
                                                            <MapPin className="h-3.5 w-3.5" />
                                                            <span className="truncate">
                                                                {session.ip_address || 'IP unavailable'}
                                                            </span>
                                                        </div>

                                                        <p className="mt-1 text-xs text-stone-400">
                                                            Last seen {formatDateTime(session.last_seen_at || session.created_at)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <Badge
                                                    className={
                                                        session.is_current
                                                            ? 'border border-green-100 bg-green-50 text-green-700 hover:bg-green-50'
                                                            : session.is_active
                                                                ? 'border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-50'
                                                                : 'border border-stone-200 bg-white text-stone-500 hover:bg-white'
                                                    }
                                                >
                                                    {session.status || 'Ended'}
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard
                        title="Administrative Actions"
                        subtitle="Profile modifications should be handled elsewhere."
                        icon={Settings}
                    >
                        <button
                            onClick={() => (window.location.href = '/admin/maintenance')}
                            className="flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left transition-colors hover:bg-stone-50"
                        >
                            <div>
                                <p className="text-sm font-semibold text-stone-800">Open Maintenance</p>
                                <p className="mt-0.5 text-xs text-stone-500">
                                    Edit admin details, account settings, and maintenance records.
                                </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-stone-400" />
                        </button>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}