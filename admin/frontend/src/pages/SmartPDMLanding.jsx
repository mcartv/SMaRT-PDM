import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  Bell,
  ChevronDown,
  Phone,
  Download,
  FileCheck2,
  MapPin,
  Clock3,
  Globe2,
  HelpCircle,
  LockKeyhole,
  Mail,
  MessageSquare,
  ShieldCheck,
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
const PDM_FACEBOOK_URL = 'https://www.facebook.com/PDM2010Official';

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

function normalizePublicFaqItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.is_archived !== true)
    .map((item) => ({
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim(),
    }))
    .filter((item) => item.question && item.answer);
}

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

const defaultFaqItems = [
  {
    question: 'Who can apply?',
    answer:
      'Applicants must meet the eligibility requirements of the scholarship program and submit the required records through the SMaRT-PDM application process.',
  },
  {
    question: 'What documents are required?',
    answer:
      'Required documents depend on the scholarship program, but applicants are expected to upload the listed requirements in the system before final review.',
  },
  {
    question: 'How does endorsement work?',
    answer:
      'The endorsement slip passes through SDO, Guidance, and Program Director review. Each office records its decision before the slip can be completed.',
  },
  {
    question: 'When does scholar activation happen?',
    answer:
      'Scholar activation only happens after both requirements and endorsement are complete and the admin side confirms final readiness.',
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
  const initials = String(benefactor.benefactor_name || 'Benefactor')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className="h-full rounded-[1.5rem] border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: theme.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold"
            style={{ background: theme.soft, color: theme.base }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-stone-900">{benefactor.benefactor_name}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
              {benefactor.benefactor_type || 'Benefactor'}
            </p>
          </div>
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

function FaqCard({ item, theme, isOpen, onToggle }) {
  return (
    <div
      className="rounded-[1.5rem] border bg-white p-5 shadow-sm"
      style={{ borderColor: theme.border }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left"
      >
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: theme.soft, color: theme.base }}
        >
          <HelpCircle size={18} />
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-bold text-stone-900">{item.question}</h3>
        </div>

        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-500"
          aria-hidden="true"
        >
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen ? (
        <div className="ml-12 mt-3 border-t border-stone-100 pt-3">
          <p className="text-sm leading-6 text-stone-500">{item.answer}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function SmartPDMLanding() {
  const { theme } = useLandingTheme();
  const [benefactors, setBenefactors] = useState([]);
  const [activeFaq, setActiveFaq] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [generalSettings, setGeneralSettings] = useState({
    office_name: 'Office for Scholarship and Financial Assistance',
    office_email: 'osfa@pdm.edu.ph',
    office_address: 'Abangan Norte, Marilao, Bulacan',
    landline_number: '(044) 919-8191',
    office_hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
    about_osfa:
      'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.',
    landing_faqs: defaultFaqItems,
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
    const handleScroll = () => setShowBackToTop(window.scrollY > 640);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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
            office_name: payload?.office_name || current.office_name,
            office_email: payload?.office_email || current.office_email,
            office_address: payload?.office_address || current.office_address,
            landline_number: payload?.landline_number || current.landline_number,
            office_hours: payload?.office_hours || current.office_hours,
            about_osfa: payload?.about_osfa || current.about_osfa,
            landing_faqs:
              normalizePublicFaqItems(payload?.landing_faqs).length
                ? normalizePublicFaqItems(payload?.landing_faqs)
                : current.landing_faqs,
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
        office_name: settings?.office_name || current.office_name,
        office_email: settings?.office_email || current.office_email,
        office_address: settings?.office_address || current.office_address,
        landline_number: settings?.landline_number || current.landline_number,
        office_hours: settings?.office_hours || current.office_hours,
        about_osfa: settings?.about_osfa || current.about_osfa,
        landing_faqs:
          normalizePublicFaqItems(settings?.landing_faqs).length
            ? normalizePublicFaqItems(settings?.landing_faqs)
            : current.landing_faqs,
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
            <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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

            <style>{`
              @keyframes benefactor-carousel-scroll {
                from { transform: translateX(0); }
                to { transform: translateX(-50%); }
              }
              .benefactor-carousel-track {
                animation: benefactor-carousel-scroll ${Math.max(18, benefactors.length * 6)}s linear infinite;
              }
              @media (prefers-reduced-motion: reduce) {
                .benefactor-carousel-track { animation-duration: 60s; }
              }
            `}</style>

            <div className="overflow-hidden rounded-[1.5rem]" aria-roledescription="carousel" aria-label="Scholarship benefactors">
              <div className="benefactor-carousel-track flex w-max">
                {[0, 1].map((copyIndex) => (
                  <div
                    key={`benefactor-set-${copyIndex}`}
                    className="flex shrink-0 gap-4 pr-4"
                    aria-hidden={copyIndex === 1 ? 'true' : undefined}
                  >
                    {benefactors.map((benefactor) => (
                      <div key={`${copyIndex}-${benefactor.benefactor_id}`} className="w-[280px] shrink-0 sm:w-[320px] lg:w-[350px]">
                        <BenefactorCard benefactor={benefactor} theme={theme} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-6xl px-5 pb-14">
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

      <section className="mx-auto w-full max-w-6xl px-5 pb-14" aria-label="PDM campus">
        <div className="group relative min-h-[240px] overflow-hidden rounded-[2rem] md:min-h-[300px]">
          <img
            src={pdmFacade}
            alt="Pambayang Dalubhasaan ng Marilao campus facade"
            className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.02]"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, ${theme.dark}e6 0%, ${theme.base}9e 48%, rgba(0,0,0,0.12) 100%)`,
            }}
          />
          <div className="relative flex min-h-[240px] max-w-xl flex-col justify-end p-7 text-white md:min-h-[300px] md:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              Pambayang Dalubhasaan ng Marilao
            </p>
            <h2 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">
              Scholarship support built around PDM students.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/80">
              One connected platform for scholarship access, office endorsement, requirements, and student progress.
            </p>
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

      <section className="mx-auto w-full max-w-6xl px-5 pb-12">
        <div
          className="grid gap-6 rounded-[2rem] border px-6 py-7 md:px-8 md:py-8 lg:grid-cols-[1.05fr_0.95fr]"
          style={{ background: '#ffffff', borderColor: theme.border }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
              About OSFA
            </p>
            <h2 className="mt-2 text-2xl font-bold text-stone-900">
              Supporting scholarship access with a clearer process
            </h2>
            <p className="mt-4 text-sm leading-7 text-stone-600">
              {generalSettings.about_osfa}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/70 p-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: theme.soft, color: theme.base }}
              >
                <ShieldCheck size={19} />
              </div>
              <p className="mt-4 text-sm font-bold text-stone-900">Guided office review</p>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                SDO, Guidance, and Program Director reviews are tracked by stage for better accountability.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/70 p-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: theme.soft, color: theme.base }}
              >
                <FileCheck2 size={19} />
              </div>
              <p className="mt-4 text-sm font-bold text-stone-900">Readiness-based activation</p>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Scholar activation happens only after both requirements and endorsement are fully completed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-12">
        <div
          className="rounded-[2rem] border px-6 py-7 md:px-8 md:py-8"
          style={{ background: '#fffdfb', borderColor: theme.border }}
        >
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                Frequently Asked Questions
              </p>
              <h2 className="mt-2 text-2xl font-bold text-stone-900">
                Quick answers for applicants and families
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-stone-500">
              A short public guide to make the scholarship process easier to understand before applying.
            </p>
          </div>

          <div className="grid gap-4">
            {(Array.isArray(generalSettings.landing_faqs) && generalSettings.landing_faqs.length
              ? generalSettings.landing_faqs
              : defaultFaqItems
            ).map((item, index) => (
              <FaqCard
                key={item.question}
                item={item}
                theme={theme}
                isOpen={activeFaq === index}
                onToggle={() => setActiveFaq((current) => (current === index ? -1 : index))}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-14">
        <div
          className="rounded-[2rem] border px-6 py-6 md:px-8"
          style={{ background: theme.base, borderColor: theme.border }}
        >
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
              Contact Information
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {generalSettings.office_name}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] bg-white/8 px-5 py-5 text-white backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4" />
                Office Address
              </div>
              <p className="mt-3 text-base font-semibold">
                {generalSettings.office_address}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Main office destination for OSFA-related transactions and follow-up.
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

      <footer className="border-t border-stone-200 bg-white px-5 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 rounded-[2rem] border border-stone-200 bg-stone-50/60 px-6 py-6 md:px-8 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                Contact / Visit Us
              </p>
              <h3 className="mt-2 text-lg font-bold text-stone-900">{generalSettings.office_name}</h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Public scholarship inquiries, application follow-up, and office coordination can be directed through the contact details below.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-stone-500" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Office Address</p>
                  <p className="mt-1 text-sm font-medium text-stone-800">{generalSettings.office_address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-stone-500" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Landline Number</p>
                  <p className="mt-1 text-sm font-medium text-stone-800">{generalSettings.landline_number}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-stone-500" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Office Hours</p>
                  <p className="mt-1 text-sm font-medium text-stone-800">{generalSettings.office_hours}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-stone-500" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Email</p>
                  <p className="mt-1 text-sm font-medium text-stone-800">{generalSettings.office_email}</p>
                </div>
              </div>

              <a
                href={PDM_FACEBOOK_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                <Globe2 className="h-4 w-4" />
                Follow PDM on Facebook
              </a>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <p className="text-xs font-semibold text-stone-600">
              SMaRT-PDM · Office for Scholarship and Financial Assistance
            </p>

            <p className="text-xs text-stone-400">
              © 2026 Pambayang Dalubhasaan ng Marilao
            </p>
          </div>
        </div>
      </footer>

      <footer className="hidden border-t border-stone-200 bg-white px-5 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <p className="text-xs font-semibold text-stone-600">
            SMaRT-PDM · Office for Scholarship and Financial Assistance
          </p>

          <p className="text-xs text-stone-400">
            © 2026 Pambayang Dalubhasaan ng Marilao
          </p>
        </div>
      </footer>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:brightness-95 focus:outline-none focus:ring-4 md:bottom-7 md:right-7 ${
          showBackToTop
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0'
        }`}
        style={{ background: theme.base, '--tw-ring-color': `${theme.base}33` }}
        aria-label="Back to top"
        title="Back to top"
      >
        <ArrowUp size={19} strokeWidth={2.4} />
      </button>
    </div>
  );
}
