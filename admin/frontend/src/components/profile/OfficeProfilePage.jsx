import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Mail,
  Phone,
} from 'lucide-react';
import { DepartmentAccountPanel } from '@/components/department/DepartmentMaintenancePage';
import ProfilePhotoPreviewDialog from '@/components/profile/ProfilePhotoPreviewDialog';
import { getProfileDisplay } from '@/utils/profileDisplay';
import pdmFacade from '@/assets/PDM-Facade-optimized.jpg';

export default function OfficeProfilePage({
  storageKey,
  maintenancePath,
  portalName,
  heroPosition,
  positionFallback,
  departmentFallback,
  roleFallback,
  avatarTone = '#475569',
  responsibilities = [],
  accountConfig,
  palette,
  tokenStorageKey,
}) {
  const [profilePhotoPreviewOpen, setProfilePhotoPreviewOpen] = useState(false);
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

  const display = getProfileDisplay({ ...profile, ...account }, roleFallback);

  const fullName = `${account.firstName} ${account.lastName}`.trim();
  const initials = `${account.firstName?.[0] || ''}${account.lastName?.[0] || ''}`.toUpperCase()
    || portalName.slice(0, 2).toUpperCase();
  const isActive = account.status === 'Active';

  return (
    <main className="space-y-6 py-2">
      <Card className="overflow-hidden rounded-[28px] border-stone-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div
            className="dark-mode-profile-hero relative overflow-hidden px-5 py-7 sm:px-7"
            style={{ background: `linear-gradient(135deg, ${avatarTone}16 0%, #fafaf9 52%, #ffffff 100%)` }}
          >
            <div
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] md:block"
              style={{
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.22) 24%, #000 62%)',
                maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.22) 24%, #000 62%)',
              }}
              aria-hidden="true"
            >
              <img
                src={pdmFacade}
                alt=""
                className="h-full w-full object-cover object-center opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white/35" />
            </div>
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full opacity-10" style={{ backgroundColor: avatarTone }} />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => account.avatarUrl && setProfilePhotoPreviewOpen(true)}
                  disabled={!account.avatarUrl}
                  className="rounded-full text-left outline-none ring-offset-4 transition enabled:cursor-zoom-in enabled:hover:ring-2 enabled:hover:ring-stone-300 enabled:focus-visible:ring-2 enabled:focus-visible:ring-stone-400 disabled:cursor-default"
                  aria-label={account.avatarUrl ? `Preview ${fullName} profile photo` : `${fullName} has no profile photo`}
                  title={account.avatarUrl ? 'Preview profile photo' : 'No profile photo'}
                >
                  <Avatar className="h-24 w-24 border-4 border-white shadow-lg sm:h-28 sm:w-28">
                    <AvatarImage src={account.avatarUrl || undefined} alt={`${fullName} profile photo`} />
                    <AvatarFallback className="text-2xl font-bold text-white" style={{ backgroundColor: avatarTone }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>

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
                  <p className="mt-2 text-sm font-semibold text-stone-700">{heroPosition || display.position}</p>
                  {display.organizationalUnit ? (
                    <p className="mt-1 text-sm text-stone-500">{display.organizationalUnit}</p>
                  ) : null}
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
          <Card className="relative overflow-hidden rounded-2xl border-[var(--portal-border)] bg-white shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[var(--portal-base)]">
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-stone-900">Role responsibilities</h3>
              <p className="mt-1 text-xs text-stone-500">Primary tasks available in this portal.</p>
              <ul className="mt-4 space-y-3">
                {responsibilities.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-5 text-stone-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--portal-base)]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Link to={maintenancePath} className="group flex items-center justify-between rounded-2xl border border-[var(--portal-base)] bg-[var(--portal-base)] p-5 text-white shadow-sm transition hover:brightness-95">
            <div>
              <p className="text-sm font-bold">Portal Settings</p>
              <p className="mt-1 text-xs text-stone-300">Manage theme and account security.</p>
            </div>
            <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </aside>
      </div>

      <ProfilePhotoPreviewDialog
        open={profilePhotoPreviewOpen}
        onOpenChange={setProfilePhotoPreviewOpen}
        src={account.avatarUrl}
        name={`${fullName} profile photo`}
      />
    </main>
  );
}
