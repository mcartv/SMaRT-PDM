import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Phone,
  Download,
  FileCheck2,
  MapPin,
  Clock3,
  LockKeyhole,
  MessageSquare,
  School,
  Smartphone,
  UsersRound,
} from 'lucide-react';
import useLandingTheme from '@/hooks/useLandingTheme';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';

import pdmLogo from '../assets/pdm-logo.png';
import pdmFacade from '../assets/PDM-Facade.png';

const APP_DOWNLOAD_URL =
  'https://www.mediafire.com/file/8157hvb8nuqiprf/SMaRT_PDM.apk/file';

const portalLinks = [
  { label: 'Admin', href: '/admin/login' },
  { label: 'SDO', href: '/sdo/login' },
  { label: 'Guidance', href: '/guidance/login' },
  { label: 'Program Director', href: '/pd/login' },
];

const howItWorks = [
  {
    step: '01',
    title: 'Apply and submit requirements',
    description:
      'Applicants complete the scholarship form, upload required documents, and track their submission in one place.',
  },
  {
    step: '02',
    title: 'Offices review the endorsement',
    description:
      'SDO, Guidance, and Program Director handle endorsement decisions by stage with visible progress and office remarks.',
  },
  {
    step: '03',
    title: 'Admin finalizes scholar readiness',
    description:
      'The admin side confirms requirements and endorsement completion before final scholar activation.',
  },
];

const features = [
  {
    icon: FileCheck2,
    title: 'Application Tracking',
    description: 'Applicants can monitor submission progress and requirements.',
  },
  {
    icon: Bell,
    title: 'Live Announcements',
    description: 'Scholars receive updates from OSFA and department offices.',
  },
  {
    icon: MessageSquare,
    title: 'Centralized Messaging',
    description: 'Communication stays organized inside one scholarship platform.',
  },
  {
    icon: LockKeyhole,
    title: 'Secure Access',
    description: 'Role-based portals protect sensitive scholarship workflows.',
  },
];

function isExternalUrl(href) {
  return /^https?:\/\//i.test(href);
}

function Button({
  href,
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon: Icon,
  theme,
}) {
  const external = isExternalUrl(href);

  const sizeClass =
    size === 'sm'
      ? 'px-3.5 py-2 text-xs rounded-lg'
      : 'px-4 py-2.5 text-sm rounded-xl';

  const widthClass = fullWidth ? 'w-full' : '';

  const variantClass =
    variant === 'primary'
      ? 'text-white shadow-lg hover:brightness-95'
      : variant === 'ghost'
        ? 'border border-white/15 bg-white/8 text-white hover:bg-white/12'
        : 'border bg-white hover:brightness-[0.98]';

  const style =
    variant === 'primary'
      ? { background: theme?.base || '#7c4a2e' }
      : variant === 'secondary'
        ? {
            borderColor: theme?.border || '#e9dcc8',
            color: theme?.base || '#7c4a2e',
            background: '#ffffff',
          }
        : undefined;

  const content = (
    <>
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </>
  );

  const className = `inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98] ${sizeClass} ${widthClass} ${variantClass}`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={style}
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={href} className={className} style={style}>
      {content}
    </Link>
  );
}

function PortalChip({ label, href }) {
  return (
    <Link
      to={href}
      className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-[13px] font-semibold text-white/90 transition hover:bg-white/12 hover:text-white"
    >
      {label}
    </Link>
  );
}

function FeatureCard({ icon: Icon, title, description, theme }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: theme.soft, color: theme.base }}
      >
        <Icon size={19} />
      </div>

      <h3 className="text-sm font-bold text-stone-900">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description, theme }) {
  return (
    <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div
        className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
        style={{ background: theme.soft, color: theme.base }}
      >
        Step {step}
      </div>

      <h3 className="mt-4 text-base font-bold text-stone-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
    </div>
  );
}

function BenefactorCard({ benefactor, theme }) {
  return (
    <div
      className="rounded-[1.5rem] border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: theme.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-stone-900">{benefactor.benefactor_name}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
            {benefactor.benefactor_type || 'Benefactor'}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{ background: theme.soft, color: theme.base }}
        >
          Partner
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-500">
        {benefactor.description || 'Supports scholarship opportunities and student access through OSFA programs.'}
      </p>
    </div>
  );
}

export default function SmartPDMLanding() {
  const { theme } = useLandingTheme();
  const [benefactors, setBenefactors] = useState([]);
  const [generalSettings, setGeneralSettings] = useState({
    institution_name: 'Pambayang Dalubhasaan ng Marilao',
    office_name: 'Office for Scholarship and Financial Assistance',
    office_address: 'Abangan Norte, Marilao, Bulacan',
    landline_number: '(044) 919-8191',
    office_hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
  });

  useEffect(() => {
    let active = true;

    const loadBenefactors = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/benefactors/public'));
        const payload = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error('Failed to load benefactors');
        }

        if (active) {
          setBenefactors(Array.isArray(payload) ? payload.slice(0, 6) : []);
        }
      } catch (error) {
        if (active) {
          setBenefactors([]);
        }
      }
    };

    loadBenefactors();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.title = 'SMaRT-PDM';
  }, []);

  useEffect(() => {
    let active = true;

    const loadGeneralSettings = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/general-settings/public'));
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load general settings');
        }

        if (active) {
          setGeneralSettings((current) => ({
            ...current,
            institution_name: payload?.institution_name || current.institution_name,
            office_name: payload?.office_name || current.office_name,
            office_address: payload?.office_address || current.office_address,
            landline_number: payload?.landline_number || current.landline_number,
            office_hours: payload?.office_hours || current.office_hours,
          }));
        }
      } catch (error) {
        if (active) {
          setGeneralSettings((current) => ({ ...current }));
        }
      }
    };

    loadGeneralSettings();

    return () => {
      active = false;
    };
  }, []);

  useSocketEvent(
    'maintenance:updated',
    (payload) => {
      if (payload?.source !== 'general_settings') return;
      const settings = payload?.settings || {};
      setGeneralSettings((current) => ({
        ...current,
        institution_name: settings?.institution_name || current.institution_name,
        office_name: settings?.office_name || current.office_name,
        office_address: settings?.office_address || current.office_address,
        landline_number: settings?.landline_number || current.landline_number,
        office_hours: settings?.office_hours || current.office_hours,
      }));
    },
    []
  );

  return (
    <div
      className="min-h-screen text-stone-900"
      style={{ background: theme.pageBg, fontFamily: "'Inter', sans-serif" }}
    >
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.dark} 0%, ${theme.base} 58%, ${theme.heroEnd} 100%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={pdmFacade}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.18] mix-blend-screen"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, ${theme.dark} 0%, rgba(0,0,0,0.18) 26%, rgba(0,0,0,0.08) 58%, rgba(255,255,255,0.02) 100%)`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)`,
            }}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />
        </div>

        <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <img
                src={pdmLogo}
                alt="PDM Logo"
                className="h-12 w-12 object-contain"
              />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                SMaRT-PDM
              </p>
              <p className="text-[11px] text-white/60">
                Scholarship Monitoring System
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {portalLinks.map((item) => (
              <PortalChip key={item.href} {...item} />
            ))}
          </nav>
        </header>

        <main className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:pb-20 lg:pt-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              OSFA Digital Scholarship Platform
            </div>

            <h1 className="mt-5 max-w-xl text-3xl font-bold leading-tight text-white md:text-4xl">
              Scholarship access, tracking, and updates in one system.
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-white/72">
              SMaRT-PDM helps applicants, scholars, and authorized staff manage
              scholarship applications, document updates, monitoring, and
              announcements through a centralized web and mobile platform.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button href={APP_DOWNLOAD_URL} icon={Download} theme={theme}>
                Download APK
              </Button>

              <Button href="/admin/login" variant="ghost" icon={ArrowRight} theme={theme}>
                Open Portal
              </Button>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <p className="text-lg font-bold text-white">4</p>
                <p className="mt-1 text-xs text-white/60">Staff portals</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <p className="text-lg font-bold text-white">Mobile</p>
                <p className="mt-1 text-xs text-white/60">Scholar access</p>
              </div>

              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/8 p-4 sm:col-span-1">
                <p className="text-lg font-bold text-white">Secure</p>
                <p className="mt-1 text-xs text-white/60">Role-based login</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur">
            <div className="rounded-[1.5rem] bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#92500f]">
                    Quick Access
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-stone-900">
                    Portal Directory
                  </h2>
                </div>

                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: theme.soft, color: theme.base }}
                >
                  <UsersRound size={19} />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {portalLinks.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="group flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 transition hover:brightness-[0.98]"
                    style={{ borderColor: theme.border, background: theme.soft }}
                  >
                    <div>
                      <p className="text-sm font-bold text-stone-900">
                        {item.label} Portal
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        Sign in to continue
                      </p>
                    </div>

                    <ArrowRight
                      size={17}
                      className="text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-[#7c4a2e]"
                      style={{ color: theme.base }}
                    />
                  </Link>
                ))}
              </div>

              <div
                className="mt-5 rounded-2xl border p-4"
                style={{ background: theme.soft, borderColor: theme.border }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: '#fff', color: theme.base }}
                  >
                    <Smartphone size={18} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-stone-900">
                      Scholar Mobile App
                    </p>
                    <p className="mt-1 text-xs leading-5 text-stone-600">
                      Install the APK to track application updates and
                      scholarship activity from your phone.
                    </p>

                    <div className="mt-3">
                      <Button href={APP_DOWNLOAD_URL} size="sm" icon={Download} theme={theme}>
                        Download App
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-12">
        <div className="mb-7 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
              Platform Features
            </p>
            <h2 className="mt-2 text-2xl font-bold text-stone-900">
              Built for scholarship operations
            </h2>
          </div>

          <p className="max-w-md text-sm leading-6 text-stone-500">
            Designed for applicants, scholars, and OSFA staff who need a clean,
            direct, and reliable workflow.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} theme={theme} />
          ))}
        </div>
      </section>

      {benefactors.length ? (
        <section className="mx-auto w-full max-w-6xl px-5 pb-12">
          <div
            className="rounded-[2rem] border px-6 py-7 md:px-8 md:py-8"
            style={{ background: '#ffffff', borderColor: theme.border }}
          >
            <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                  Benefactors
                </p>
                <h2 className="mt-2 text-2xl font-bold text-stone-900">
                  Scholarship partners and funding support
                </h2>
              </div>

              <p className="max-w-md text-sm leading-6 text-stone-500">
                These partner organizations and funding sources help make scholarship access possible for PDM students.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {benefactors.map((benefactor) => (
                <BenefactorCard key={benefactor.benefactor_id} benefactor={benefactor} theme={theme} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-6xl px-5 pb-12">
        <div
          className="rounded-[2rem] border px-6 py-7 md:px-8 md:py-8"
          style={{ background: '#fffdfb', borderColor: theme.border }}
        >
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                How It Works
              </p>
              <h2 className="mt-2 text-2xl font-bold text-stone-900">
                Scholarship flow in 3 simple steps
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-stone-500">
              A shorter overview for applicants and offices so the process is easier to understand at a glance.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {howItWorks.map((item) => (
              <StepCard key={item.step} {...item} theme={theme} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-14">
        <div
          className="rounded-[2rem] border p-6 md:p-8"
          style={{ background: theme.soft, borderColor: theme.border }}
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                Department Access
              </p>

              <h2 className="mt-2 text-xl font-bold text-stone-900">
                Open the right portal directly.
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                Department users can access PD, Guidance, or SDO login without
                passing through the admin login screen first.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {portalLinks.map((item) => (
                <Button
                  key={item.href}
                  href={item.href}
                  variant={item.label === 'Admin' ? 'primary' : 'secondary'}
                  size="sm"
                  fullWidth
                  theme={theme}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-14">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
              Clear workflow
            </p>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Applications, requirements, endorsement, and scholar readiness stay separated so each step is easier to manage.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
              Office visibility
            </p>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              SDO, Guidance, and Program Director can monitor active applicants, processed slips, and downloadable records in their own portals.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
              Student-friendly access
            </p>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Applicants can use the mobile app for updates, reminders, and status tracking without depending only on manual follow-up.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-14">
        <div
          className="rounded-[2rem] border px-6 py-6 md:px-8"
          style={{ background: theme.base, borderColor: theme.border }}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.5rem] bg-white/8 px-5 py-5 text-white backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <School className="h-4 w-4" />
                Institution
              </div>
              <p className="mt-3 text-base font-semibold">
                {generalSettings.institution_name}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                {generalSettings.office_name}
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-white/8 px-5 py-5 text-white backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4" />
                Office Address
              </div>
              <p className="mt-3 text-base font-semibold">
                {generalSettings.office_address}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Campus and office destination for OSFA-related transactions.
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-white/8 px-5 py-5 text-white backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Phone className="h-4 w-4" />
                Landline Number
              </div>
              <p className="mt-3 text-base font-semibold">
                {generalSettings.landline_number}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Office contact line for public inquiries and coordination.
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-white/8 px-5 py-5 text-white backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="h-4 w-4" />
                Office Hours
              </div>
              <p className="mt-3 text-base font-semibold">
                {generalSettings.office_hours}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Public service window for in-person follow-up and scholarship transactions.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white px-5 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <p className="text-xs font-semibold text-stone-600">
            SMaRT-PDM · Office for Scholarship and Financial Assistance
          </p>

          <p className="text-xs text-stone-400">
            © 2026 Pambayang Dalubhasaan ng Marilao
          </p>
        </div>
      </footer>
    </div>
  );
}
