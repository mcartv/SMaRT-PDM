import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Download,
  FileCheck2,
  LockKeyhole,
  MessageSquare,
  Smartphone,
  UsersRound,
} from 'lucide-react';

import pdmLogo from '../assets/pdm-logo.png';

const APP_DOWNLOAD_URL =
  'https://www.mediafire.com/file/8157hvb8nuqiprf/SMaRT_PDM.apk/file';

const SB_BASE = '#7c4a2e';
const SB_DARK = '#56321f';
const SB_SOFT = '#f7f1e9';
const SB_BORDER = '#e9dcc8';

const portalLinks = [
  { label: 'Admin', href: '/admin/login' },
  { label: 'Program Director', href: '/pd/login' },
  { label: 'Guidance', href: '/guidance/login' },
  { label: 'SDO', href: '/sdo/login' },
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
        : 'border border-[#e9dcc8] bg-white text-[#7c4a2e] hover:bg-[#f7f1e9]';

  const style = variant === 'primary' ? { background: SB_BASE } : undefined;

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
      className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/12 hover:text-white"
    >
      {label}
    </Link>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: SB_SOFT, color: SB_BASE }}
      >
        <Icon size={19} />
      </div>

      <h3 className="text-sm font-bold text-stone-900">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
    </div>
  );
}

export default function SmartPDMLanding() {
  return (
    <div
      className="min-h-screen bg-[#f8f5f1] text-stone-900"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${SB_DARK} 0%, ${SB_BASE} 58%, #8a5a38 100%)`,
        }}
      >
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
              <Button href={APP_DOWNLOAD_URL} icon={Download}>
                Download APK
              </Button>

              <Button href="/admin/login" variant="ghost" icon={ArrowRight}>
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
                  style={{ background: SB_SOFT, color: SB_BASE }}
                >
                  <UsersRound size={19} />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {portalLinks.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="group flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 transition hover:border-[#e9dcc8] hover:bg-[#f7f1e9]"
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
                    />
                  </Link>
                ))}
              </div>

              <div
                className="mt-5 rounded-2xl border p-4"
                style={{ background: SB_SOFT, borderColor: SB_BORDER }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: '#fff', color: SB_BASE }}
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
                      <Button href={APP_DOWNLOAD_URL} size="sm" icon={Download}>
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#92500f]">
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
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-14">
        <div
          className="rounded-[2rem] border p-6 md:p-8"
          style={{ background: SB_SOFT, borderColor: SB_BORDER }}
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#92500f]">
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
                >
                  {item.label}
                </Button>
              ))}
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