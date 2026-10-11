import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, Loader2, Mail, MapPin, Phone, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PreviewableProfileAvatar from '@/components/profile/PreviewableProfileAvatar';
import { buildApiUrl } from '@/api';

function valueOrFallback(value, fallback = 'Not recorded') {
  const text = String(value ?? '').trim();
  return !text || text === 'N/A' ? fallback : text;
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric',
  });
}

function Field({ label, children }) {
  return (
    <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
      <p className="mt-1 text-sm leading-5 text-stone-800 [overflow-wrap:anywhere]">{children}</p>
    </div>
  );
}

function ContactRow({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-accent-soft)] text-[var(--portal-base)]"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
        <p className="mt-1 text-sm leading-5 text-stone-800 [overflow-wrap:anywhere]">{valueOrFallback(value, 'Not available')}</p>
      </div>
    </div>
  );
}

export default function SDOScholarProfile({ scholar, theme, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const scholarId = scholar?.scholar_id || scholar?.student_id;

  useEffect(() => {
    if (!scholarId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setProfile(null);
    setError('');
    async function loadProfile() {
      try {
        const response = await fetch(buildApiUrl(`/api/scholars/${encodeURIComponent(scholarId)}`), {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${sessionStorage.getItem('sdoToken') || ''}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load scholar profile.');
        if (!controller.signal.aborted) setProfile(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message || 'Unable to load scholar profile.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadProfile();
    return () => controller.abort();
  }, [scholarId, retry]);

  const s = profile || scholar || {};
  const standing = String(s.sdu_level || s.sdo_status || '').toLowerCase();
  const isMajor = standing.includes('major');
  const isMinor = standing.includes('minor');
  const offense = isMajor ? 'Major Offense' : isMinor ? 'Minor Offense' : 'No Offense';
  const standingClass = isMajor ? 'border-red-200 bg-red-50 text-red-700' : isMinor ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  const StandingIcon = isMajor || isMinor ? ShieldAlert : CheckCircle2;
  const year = valueOrFallback(s.year_level, '');
  const yearLabel = /^[1-6]$/.test(year) ? `${year}${['st', 'nd', 'rd'][Number(year) - 1] || 'th'} Year` : year;
  const yearSection = [yearLabel, s.section].filter(Boolean).join(' · ');
  const academicPeriod = [s.semester, s.academic_year ? `AY ${s.academic_year}` : ''].filter(Boolean).join(' · ') || 'Not recorded';
  const initials = (s.student_name || 'NA').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return (
    <Dialog open={Boolean(scholar)} onOpenChange={open => !open && onClose()}>
      <DialogContent
        className="sdo-scholar-profile flex min-w-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:rounded-2xl"
        overlayClassName="z-50 bg-black/40 backdrop-blur-sm"
        style={{ '--portal-base': theme?.base, '--portal-accent-soft': theme?.accentSoft }}
      >
        <header className="shrink-0 border-b border-stone-100 bg-white px-4 py-4 pr-14 sm:px-5 sm:pr-14">
          <DialogTitle className="text-base font-semibold text-stone-900 sm:text-lg">Scholar Profile</DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-5 text-stone-500 sm:text-sm">Student information and current disciplinary standing</DialogDescription>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-stone-50/50 pb-[env(safe-area-inset-bottom)]">
          {loading ? (
            <div role="status" className="flex min-h-64 items-center justify-center gap-3 p-5 text-sm text-stone-500"><Loader2 className="h-5 w-5 animate-spin" />Loading scholar profile...</div>
          ) : error ? (
            <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 p-5 text-center"><p className="text-sm text-red-700">{error}</p><Button variant="outline" onClick={() => setRetry(current => current + 1)}>Try again</Button></div>
          ) : (
            <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
              <section className="min-w-0 space-y-5 border-b border-stone-200 bg-white p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <div className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <div className="relative h-14 overflow-hidden bg-[var(--portal-base)]" aria-hidden="true"><div className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/10" /><div className="absolute right-16 top-5 h-16 w-16 rounded-full bg-white/10" /></div>
                  <div className="px-4 pb-4">
                    <div className="relative -mt-7 inline-flex rounded-full bg-white p-1.5 shadow-sm">
                      <PreviewableProfileAvatar src={s.avatar_url || s.profile_photo_url || ''} name={s.student_name || 'Scholar'} fallback={initials} avatarClassName="h-16 w-16 rounded-full border border-stone-200" fallbackClassName="bg-[var(--portal-accent-soft)] text-[var(--portal-base)]" imageClassName="object-cover" />
                    </div>
                    <h4 className="mt-2 text-lg font-semibold leading-6 text-stone-900 [overflow-wrap:anywhere]">{valueOrFallback(s.student_name, 'Unknown scholar')}</h4>
                    <p className="mt-1 text-sm font-medium text-stone-500 [overflow-wrap:anywhere]">{valueOrFallback(s.student_number)}</p>
                    <div className="mt-3 flex min-w-0 items-start gap-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[var(--portal-base)]" />
                      <div className="min-w-0"><p className="text-xs font-semibold text-stone-700 [overflow-wrap:anywhere]">{[s.course_code, yearSection].filter(Boolean).join(' · ') || 'Course information unavailable'}</p><p className="mt-1 text-xs leading-5 text-stone-500 [overflow-wrap:anywhere]">{valueOrFallback(s.course_name, 'Course name not available')}</p></div>
                    </div>
                  </div>
                </div>
                <div>
                  <h5 className="mb-3 text-base font-semibold text-stone-800">Student Details</h5>
                  <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Field label="Course">{valueOrFallback(s.course_code || s.course_name)}</Field>
                    <Field label="Year / Section">{yearSection || 'Not recorded'}</Field>
                  </div>
                </div>
                <div>
                  <h5 className="mb-3 text-base font-semibold text-stone-800">Contact Information</h5>
                  <div className="min-w-0 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white p-3.5">
                    <ContactRow icon={Mail} label="Email" value={s.email} />
                    <ContactRow icon={Phone} label="Mobile Number" value={s.phone_number} />
                    <ContactRow icon={MapPin} label="Address" value={s.address_summary} />
                  </div>
                </div>
              </section>
              <section className="min-w-0 space-y-4 p-4 sm:p-5">
                <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--portal-base)]">Current Scholarship</p><h4 className="mt-1 text-lg font-semibold leading-6 text-stone-800 [overflow-wrap:anywhere]">{valueOrFallback(s.program_name, 'No program recorded')}</h4><p className="mt-2 text-xs leading-5 text-stone-500 [overflow-wrap:anywhere]">{academicPeriod}</p></div>
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700 [overflow-wrap:anywhere]">{valueOrFallback(s.status)}</span>
                  </div>
                  <div className="mt-4 flex items-start gap-2 border-t border-stone-100 pt-3 text-xs leading-5 text-stone-500"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /><span>Date awarded <span className="ml-1 font-medium text-stone-700">{formatDate(s.date_awarded)}</span></span></div>
                </div>
                <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-accent-soft)] text-[var(--portal-base)]"><ShieldAlert className="h-4 w-4" /></span><div><h4 className="text-base font-semibold text-stone-800">Disciplinary Record</h4><p className="mt-1 text-xs text-stone-500">Current SDO standing and remarks</p></div></div>
                  <div className={`flex items-center gap-3 rounded-xl border p-3 ${standingClass}`}><StandingIcon className="h-5 w-5 shrink-0" /><p className="text-sm font-semibold">{offense}</p></div>
                  <div className="mt-4"><Field label="Incident Date">{formatDate(s.sdo_incident_date)}</Field></div>
                  <div className="mt-4 border-t border-stone-100 pt-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">SDO Remarks</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700 [overflow-wrap:anywhere]">{valueOrFallback(s.sdo_comment, 'No remarks recorded.')}</p></div>
                </div>
              </section>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
