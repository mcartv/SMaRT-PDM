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
  Monitor,
  Smartphone,
  BadgeCheck,
  Settings,
  FileSearch,
  AlertTriangle,
  PenTool,
} from 'lucide-react';

const SESSION_LOG = [
  {
    device: 'Chrome · Windows 11',
    location: 'Marilao, Bulacan',
    time: 'Recent session',
    current: true,
    type: 'desktop',
  },
  {
    device: 'Chrome · Android',
    location: 'Marilao, Bulacan',
    time: 'Previous session',
    current: false,
    type: 'mobile',
  },
];

function SectionCard({ title, subtitle, icon: Icon, children, action }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white shadow-sm">
            <Icon className="h-4 w-4 text-stone-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p> : null}
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
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white">
        <Icon className="h-4 w-4 text-stone-500" />
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">{label}</p>
        <p className="break-words text-sm font-semibold text-stone-800">{value || '—'}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = 'green' }) {
  const toneMap = {
    green: 'border-green-100 bg-green-50 text-green-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    stone: 'border-stone-100 bg-stone-50 text-stone-700',
  };

  return (
    <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${toneMap[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-4 text-2xl font-bold leading-none text-stone-900">{value}</p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-stone-500">
        {label}
      </p>
    </div>
  );
}

export default function OfficeProfilePage({
  storageKey,
  heading,
  maintenancePath,
  portalName,
  positionFallback,
  departmentFallback,
  roleFallback,
  avatarTone = '#475569',
  statCards = [],
  activityLog = [],
  bio,
}) {
  const [profile] = useState(() => {
    const saved = sessionStorage.getItem(storageKey);
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const firstName = profile?.first_name || '';
  const lastName = profile?.last_name || '';
  const fallbackName = profile?.name || `${firstName} ${lastName}`.trim() || portalName;

  const account = {
    firstName: firstName || fallbackName.split(' ')[0] || portalName,
    lastName: lastName || fallbackName.split(' ').slice(1).join(' '),
    email: profile?.email || `${portalName.toLowerCase()}@pdm.edu.ph`,
    phone: profile?.phone || profile?.phone_number || '+63 917 000 0000',
    position: profile?.position || positionFallback,
    department: profile?.department || departmentFallback,
    role: profile?.role || roleFallback,
    status: profile?.is_active === false ? 'Inactive' : 'Active',
    avatarUrl:
      profile?.avatar_url ||
      profile?.profile_photo_url ||
      profile?.photo_url ||
      profile?.image_url ||
      '',
    bio,
  };

  const fullName = `${account.firstName} ${account.lastName}`.trim();

  const initials = useMemo(() => {
    const a = account.firstName?.[0] || '';
    const b = account.lastName?.[0] || '';
    return `${a}${b}`.toUpperCase() || portalName.slice(0, 2).toUpperCase();
  }, [account.firstName, account.lastName, portalName]);

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">{heading}</h1>
          <p className="mt-1 text-sm text-stone-500">
            View your account information, status, recent activity, and signed-in sessions.
          </p>
        </div>

        <Button
          variant="outline"
          className="w-fit rounded-xl border-stone-200 text-stone-700"
          onClick={() => (window.location.href = maintenancePath)}
        >
          <Settings className="mr-2 h-4 w-4" />
          Go to Maintenance
        </Button>
      </div>

      <Card className="overflow-hidden rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-stone-100 bg-gradient-to-r from-stone-50 to-stone-100/80 px-6 py-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                  <AvatarImage src={account.avatarUrl || undefined} alt={fullName} />
                  <AvatarFallback className="text-2xl font-bold text-white" style={{ backgroundColor: avatarTone }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold text-stone-900">{fullName}</h2>
                    <Badge className="border border-green-100 bg-green-50 text-green-700 hover:bg-green-50">
                      <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                      {account.status}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-stone-200 bg-white text-stone-600">
                      {account.role}
                    </Badge>
                  </div>

                  <p className="text-sm font-medium text-stone-600">{account.position}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-stone-400">
                    {account.department}
                  </p>

                  <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">{account.bio}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:w-[430px]">
                {statCards.map((card) => (
                  <StatCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    icon={card.icon}
                    tone={card.tone}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <SectionCard
            title="Account Information"
            subtitle={`Read-only profile details for this ${portalName} account.`}
            icon={User}
            action={
              <Badge variant="outline" className="hidden rounded-full border-stone-200 bg-white text-stone-500 sm:inline-flex">
                View Only
              </Badge>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InfoRow icon={User} label="Full Name" value={fullName} />
              <InfoRow icon={Shield} label="Role" value={account.role} />
              <InfoRow icon={Mail} label="Email Address" value={account.email} />
              <InfoRow icon={Phone} label="Phone Number" value={account.phone} />
              <InfoRow icon={Building2} label="Department" value={account.department} />
              <InfoRow icon={Shield} label="Position / Role Title" value={account.position} />
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-medium text-emerald-800">
                Profile updates and account editing are managed in <span className="font-semibold">Maintenance</span>.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Slip Identity"
            subtitle={`Current endorsement identity details for this ${portalName} account.`}
            icon={PenTool}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InfoRow icon={User} label="Name on Slip" value={fullName} />
              <InfoRow icon={Building2} label="Office / Department" value={account.department} />
              <InfoRow icon={PenTool} label="Signature" value="Soon" />
            </div>

            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3">
              <p className="text-sm text-stone-700">
                The current name and office/department above are the identity details that can be shown on endorsement slips. Signature can be added later when that feature is ready.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Recent Activity"
            subtitle={`Latest actions performed using this ${portalName} account.`}
            icon={Activity}
          >
            <div className="space-y-2">
              {activityLog.map((item, index) => (
                <div
                  key={`${item.action}-${index}`}
                  className="flex flex-col gap-2 rounded-2xl border border-stone-100 bg-stone-50/40 px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <p className="text-sm font-medium text-stone-700">{item.action}</p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-stone-400">{item.time}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Account Status"
            subtitle={`Current standing of this ${portalName} account.`}
            icon={Shield}
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3">
                <p className="mb-1 text-[11px] uppercase tracking-wider text-stone-400">Status</p>
                <p className="text-sm font-semibold text-stone-800">{account.status}</p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3">
                <p className="mb-1 text-[11px] uppercase tracking-wider text-stone-400">Access Level</p>
                <p className="text-sm font-semibold text-stone-800">{account.role}</p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3">
                <p className="mb-1 text-[11px] uppercase tracking-wider text-stone-400">Assigned Office</p>
                <p className="text-sm font-semibold text-stone-800">{account.department}</p>
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
                    key={`${session.device}-${index}`}
                    className="rounded-2xl border border-stone-100 bg-stone-50/40 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white">
                        <Icon className="h-4 w-4 text-stone-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-800">{session.device}</p>
                          {session.current ? (
                            <Badge className="border border-green-100 bg-green-50 text-green-700 hover:bg-green-50">
                              Current
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-stone-500">{session.location}</p>
                        <p className="mt-1 text-xs text-stone-400">{session.time}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Security Reminder"
            subtitle="Keep account access clean and role-specific."
            icon={AlertTriangle}
          >
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-800">
                Keep this office account updated and use Maintenance for profile changes, contact details, and account review.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
