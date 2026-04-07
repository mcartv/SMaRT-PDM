import React, { useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

// ─────────────────────────────────────────────────────────────
// Mock data
// Replace later with real backend/admin session data
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Reusable UI
// ─────────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, icon: Icon, children, action }) {
    return (
        <Card className="rounded-2xl border-stone-200 shadow-sm bg-white overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-stone-100 bg-stone-50/60">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center shadow-sm shrink-0">
                        <Icon className="w-4 h-4 text-stone-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
                        {subtitle ? <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p> : null}
                    </div>
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>

            <CardContent className="p-5">{children}</CardContent>
        </Card>
    );
}

function InfoRow({ icon: Icon, label, value }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/40 px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-stone-200 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-stone-500" />
            </div>

            <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-stone-400 font-medium">{label}</p>
                <p className="text-sm font-semibold text-stone-800 break-words">{value || '—'}</p>
            </div>
        </div>
    );
}

function StatCard({ label, value }) {
    return (
        <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-4">
            <p className="text-2xl font-bold text-stone-900 leading-none">{value}</p>
            <p className="text-[11px] uppercase tracking-wider text-stone-500 mt-2 font-medium">
                {label}
            </p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
export default function AdminProfile() {
    // Replace later with real admin data source
    const [adminData] = useState({
        firstName: 'Carmelita',
        lastName: 'Dela Cruz',
        email: 'cdelacruz@pdm.edu.ph',
        phone: '+63 917 123 4567',
        position: 'OSFA Administrator',
        department: 'Office for Scholarship and Financial Assistance',
        role: 'Super Admin',
        status: 'Active',
        bio: 'Oversees scholarship records, scholar compliance, announcements, and administrative coordination for the SMaRT-PDM platform.',
    });

    const fullName = `${adminData.firstName} ${adminData.lastName}`.trim();

    const initials = useMemo(() => {
        const a = adminData.firstName?.[0] || '';
        const b = adminData.lastName?.[0] || '';
        return `${a}${b}`.toUpperCase() || 'AD';
    }, [adminData.firstName, adminData.lastName]);

    return (
        <div className="space-y-6 py-2">
            {/* Header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-900">Admin Profile</h1>
                    <p className="text-sm text-stone-500 mt-1">
                        View your account information, status, recent activity, and current sessions.
                    </p>
                </div>

                <Button
                    variant="outline"
                    className="w-fit rounded-xl border-stone-200 text-stone-700"
                    onClick={() => (window.location.href = '/admin/maintenance')}
                >
                    <Settings className="w-4 h-4 mr-2" />
                    Go to Maintenance
                </Button>
            </div>

            {/* Hero Card */}
            <Card className="rounded-3xl border-stone-200 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-0">
                    <div className="bg-gradient-to-r from-stone-50 to-amber-50/60 border-b border-stone-100 px-6 py-6">
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                            <div className="flex flex-col md:flex-row md:items-center gap-5">
                                <Avatar className="w-24 h-24 border-4 border-white shadow-md">
                                    <AvatarFallback className="bg-stone-800 text-white text-2xl font-bold">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <h2 className="text-2xl font-bold text-stone-900">{fullName}</h2>
                                        <Badge className="bg-green-50 text-green-700 border border-green-100 hover:bg-green-50">
                                            <BadgeCheck className="w-3.5 h-3.5 mr-1.5" />
                                            {adminData.status}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className="rounded-full border-stone-200 text-stone-600 bg-white"
                                        >
                                            {adminData.role}
                                        </Badge>
                                    </div>

                                    <p className="text-sm font-medium text-stone-600">{adminData.position}</p>
                                    <p className="text-xs uppercase tracking-wider text-stone-400 mt-1">
                                        {adminData.department}
                                    </p>

                                    <p className="text-sm text-stone-600 mt-4 max-w-3xl leading-6">
                                        {adminData.bio}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xl:w-[430px]">
                                <StatCard label="Applications Processed" value="284" />
                                <StatCard label="Documents Verified" value="91" />
                                <StatCard label="Reports Generated" value="18" />
                                <StatCard label="Years Active" value="3" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Main grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left */}
                <div className="xl:col-span-2 space-y-6">
                    <SectionCard
                        title="Account Information"
                        subtitle="Read-only profile details for this admin account."
                        icon={User}
                        action={
                            <Badge
                                variant="outline"
                                className="hidden sm:inline-flex rounded-full border-stone-200 text-stone-500 bg-white"
                            >
                                View Only
                            </Badge>
                        }
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InfoRow icon={User} label="Full Name" value={fullName} />
                            <InfoRow icon={Shield} label="Role" value={adminData.role} />
                            <InfoRow icon={Mail} label="Email Address" value={adminData.email} />
                            <InfoRow icon={Phone} label="Phone Number" value={adminData.phone} />
                            <InfoRow icon={Building2} label="Department" value={adminData.department} />
                            <InfoRow icon={KeyRound} label="Position / Role Title" value={adminData.position} />
                        </div>

                        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                            <p className="text-sm text-amber-800 font-medium">
                                Profile updates and account editing are managed in <span className="font-semibold">Maintenance</span>.
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
                                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-2xl border border-stone-100 bg-stone-50/40 px-4 py-3"
                                >
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                        <p className="text-sm font-medium text-stone-700">{item.action}</p>
                                    </div>
                                    <p className="text-xs text-stone-400 whitespace-nowrap">{item.time}</p>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>

                {/* Right */}
                <div className="space-y-6">
                    <SectionCard
                        title="Account Status"
                        subtitle="Current standing of this administrator account."
                        icon={Shield}
                    >
                        <div className="space-y-3">
                            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3">
                                <p className="text-[11px] uppercase tracking-wider text-stone-400 mb-1">Status</p>
                                <p className="text-sm font-semibold text-stone-800">{adminData.status}</p>
                            </div>

                            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3">
                                <p className="text-[11px] uppercase tracking-wider text-stone-400 mb-1">Access Level</p>
                                <p className="text-sm font-semibold text-stone-800">{adminData.role}</p>
                            </div>

                            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3">
                                <p className="text-[11px] uppercase tracking-wider text-stone-400 mb-1">Assigned Office</p>
                                <p className="text-sm font-semibold text-stone-800">{adminData.department}</p>
                            </div>
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
                                        className="rounded-2xl border border-stone-100 bg-stone-50/40 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center border ${session.current
                                                            ? 'bg-green-50 text-green-700 border-green-100'
                                                            : 'bg-white text-stone-500 border-stone-200'
                                                        }`}
                                                >
                                                    <Icon className="w-4 h-4" />
                                                </div>

                                                <div>
                                                    <p className="text-sm font-semibold text-stone-800">{session.device}</p>
                                                    <div className="flex items-center gap-1.5 mt-1 text-xs text-stone-500">
                                                        <MapPin className="w-3.5 h-3.5" />
                                                        <span>{session.location}</span>
                                                    </div>
                                                    <p className="text-xs text-stone-400 mt-1">{session.time}</p>
                                                </div>
                                            </div>

                                            {session.current ? (
                                                <Badge className="bg-green-50 text-green-700 border border-green-100 hover:bg-green-50">
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
                        <div className="space-y-3">
                            <button
                                onClick={() => (window.location.href = '/admin/maintenance')}
                                className="w-full flex items-center justify-between rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 transition-colors px-4 py-3 text-left"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-stone-800">Open Maintenance</p>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        Edit admin details, account settings, and maintenance records.
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-stone-400" />
                            </button>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}