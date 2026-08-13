import { createElement, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  LockKeyhole,
  Mail,
  Phone,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { DepartmentAccountPanel } from '@/components/department/DepartmentMaintenancePage';

function DetailItem({ icon, label, value }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/70 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white bg-white text-stone-500 shadow-sm">
        {createElement(icon, { className: 'h-4 w-4', 'aria-hidden': true })}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-stone-800">{value || 'Not provided'}</p>
      </div>
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
  responsibilities = [],
  accountConfig,
  palette,
  tokenStorageKey,
}) {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const account = useMemo(() => {
    const firstName = profile?.first_name || '';
    const lastName = profile?.last_name || '';
    const savedName = String(profile?.name || '').trim();
    const fallbackName = savedName || `${firstName} ${lastName}`.trim() || portalName;

    return {
      firstName: firstName || fallbackName.split(' ')[0] || portalName,
      lastName: lastName || fallbackName.split(' ').slice(1).join(' '),
      email: profile?.email || '',
      phone: profile?.phone || profile?.phone_number || '',
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
    };
  }, [departmentFallback, portalName, positionFallback, profile, roleFallback]);

  const fullName = `${account.firstName} ${account.lastName}`.trim();
  const initials = `${account.firstName?.[0] || ''}${account.lastName?.[0] || ''}`.toUpperCase()
    || portalName.slice(0, 2).toUpperCase();
  const isActive = account.status === 'Active';

  return (
    <main className="space-y-6 py-2" aria-labelledby="profile-page-title">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Account center</p>
          <h1 id="profile-page-title" className="mt-1 text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">
            {heading}
          </h1>
          <p className="mt-1 text-sm text-stone-500">Review your identity, contact details, and office access.</p>
        </div>
        <Button asChild variant="outline" className="w-fit rounded-xl border-stone-200 bg-white">
          <Link to={maintenancePath}>
            <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            Account settings
          </Link>
        </Button>
      </header>

      <Card className="overflow-hidden rounded-[28px] border-stone-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div
            className="relative overflow-hidden px-5 py-7 sm:px-7"
            style={{ background: `linear-gradient(135deg, ${avatarTone}16 0%, #fafaf9 52%, #ffffff 100%)` }}
          >
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full opacity-10" style={{ backgroundColor: avatarTone }} />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar className="h-24 w-24 border-4 border-white shadow-lg sm:h-28 sm:w-28">
                  <AvatarImage src={account.avatarUrl || undefined} alt={`${fullName} profile photo`} />
                  <AvatarFallback className="text-2xl font-bold text-white" style={{ backgroundColor: avatarTone }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">{fullName}</h2>
                    <Badge className={isActive
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                      : 'border border-stone-200 bg-stone-100 text-stone-600 hover:bg-stone-100'}>
                      <BadgeCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      {account.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-stone-700">{account.position}</p>
                  <p className="mt-1 text-sm text-stone-500">{account.department}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {account.email ? (
                      <a href={`mailto:${account.email}`} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-300 hover:text-stone-900">
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />{account.email}
                      </a>
                    ) : null}
                    {account.phone ? (
                      <a href={`tel:${account.phone}`} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-300 hover:text-stone-900">
                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />{account.phone}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-[300px]">
                <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                  <ShieldCheck className="h-5 w-5" style={{ color: avatarTone }} aria-hidden="true" />
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Access level</p>
                  <p className="mt-1 text-sm font-bold text-stone-900">{account.role}</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                  <Building2 className="h-5 w-5" style={{ color: avatarTone }} aria-hidden="true" />
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Portal</p>
                  <p className="mt-1 text-sm font-bold text-stone-900">{portalName}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Edit profile information">
          <DepartmentAccountPanel
            config={accountConfig}
            palette={palette}
            tokenStorageKey={tokenStorageKey}
            profileStorageKey={storageKey}
            onProfileUpdated={setProfile}
          />
        </section>

        <aside className="space-y-5">
          <Card className="rounded-2xl border-stone-200 bg-white shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Account overview</h3>
                  <p className="text-xs text-stone-500">Information tied to your office access.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <DetailItem icon={BriefcaseBusiness} label="Position" value={account.position} />
                <DetailItem icon={Building2} label="Office" value={account.department} />
                <DetailItem icon={LockKeyhole} label="Role" value={account.role} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-stone-200 bg-white shadow-none">
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-stone-900">Role responsibilities</h3>
              <p className="mt-1 text-xs text-stone-500">Primary tasks available in this portal.</p>
              <ul className="mt-4 space-y-3">
                {responsibilities.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-5 text-stone-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Link to={maintenancePath} className="group flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-950 p-5 text-white shadow-sm transition hover:bg-stone-800">
            <div>
              <p className="text-sm font-bold">Manage account settings</p>
              <p className="mt-1 text-xs text-stone-300">Update profile and portal preferences.</p>
            </div>
            <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </main>
  );
}
