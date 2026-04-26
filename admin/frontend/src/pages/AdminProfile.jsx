import React, { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

// Mock data
const SESSION_LOG = [
    {
        device: 'Chrome · Windows 11',
        location: 'Marilao, Bulacan',
        time: 'Mar 22, 2026 · 10:14 AM',
        current: true,
        type: 'desktop',
    },
    {
        device: 'Chrome · Android',
        location: 'Marilao, Bulacan',
        time: 'Mar 21, 2026 · 08:30 AM',
        current: false,
        type: 'mobile',
    },
];

const ACTIVITY_LOG = [
    { action: 'Approved 3 scholarship applications', time: 'Mar 22, 2026 · 10:14 AM' },
    { action: 'Published an announcement for TES scholars', time: 'Mar 21, 2026 · 03:22 PM' },
    { action: 'Updated scholarship opening details', time: 'Mar 20, 2026 · 09:00 AM' },
    { action: 'Reviewed return of obligation submissions', time: 'Mar 19, 2026 · 01:40 PM' },
];

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
        const saved = localStorage.getItem('adminProfile');
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
                        subtitle="Latest actions performed using this admin account."
                        icon={Activity}
                    >
                        <div className="space-y-2">
                            {ACTIVITY_LOG.map((item, index) => (
                                <div
                                    key={index}
                                    className="flex flex-col gap-2 rounded-xl border border-stone-100 bg-stone-50/40 px-4 py-3 md:flex-row md:items-center md:justify-between"
                                >
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                                        <p className="text-sm font-medium text-stone-700">{item.action}</p>
                                    </div>

                                    <p className="whitespace-nowrap text-xs text-stone-400">{item.time}</p>
                                </div>
                            ))}
                        </div>
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
                        title="Active Sessions"
                        subtitle="Signed-in devices associated with this account."
                        icon={Clock3}
                    >
                        <div className="space-y-3">
                            {SESSION_LOG.map((session, index) => {
                                const Icon = session.type === 'mobile' ? Smartphone : Monitor;

                                return (
                                    <div
                                        key={index}
                                        className="rounded-xl border border-stone-100 bg-stone-50/40 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`flex h-10 w-10 items-center justify-center rounded-xl border ${session.current
                                                            ? 'border-green-100 bg-green-50 text-green-700'
                                                            : 'border-stone-200 bg-white text-stone-500'
                                                        }`}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                </div>

                                                <div>
                                                    <p className="text-sm font-semibold text-stone-800">
                                                        {session.device}
                                                    </p>

                                                    <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
                                                        <MapPin className="h-3.5 w-3.5" />
                                                        <span>{session.location}</span>
                                                    </div>

                                                    <p className="mt-1 text-xs text-stone-400">{session.time}</p>
                                                </div>
                                            </div>

                                            {session.current ? (
                                                <Badge className="border border-green-100 bg-green-50 text-green-700 hover:bg-green-50">
                                                    Current
                                                </Badge>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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