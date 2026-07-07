import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Download,
  FileSearch,
  LayoutPanelTop,
  MessageSquareText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import pdmLogo from '../assets/pdm-logo.png';

const APP_DOWNLOAD_URL = 'https://www.mediafire.com/file/8157hvb8nuqiprf/SMaRT_PDM.apk/file';

function ActionButton({
  href,
  children,
  variant = 'primary',
  external = false,
  fullWidth = false,
}) {
  const className = [
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition duration-200',
    'active:scale-[0.99]',
    fullWidth ? 'w-full' : '',
    variant === 'primary'
      ? 'bg-[#7c4a2e] text-white shadow-lg shadow-[#7c4a2e]/20 hover:bg-[#6b3e27]'
      : variant === 'dark'
        ? 'bg-stone-900 text-white hover:bg-stone-800'
        : 'border border-stone-200 bg-white text-stone-800 hover:bg-stone-50',
  ]
    .filter(Boolean)
    .join(' ');

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

function PortalCard({ title, desc, href, tone }) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tone}`}>
      <p className="text-sm font-semibold text-stone-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{desc}</p>
      <div className="mt-4">
        <ActionButton href={href} variant="secondary">
          Open Portal
          <ArrowRight className="h-4 w-4" />
        </ActionButton>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100">
        <Icon className="h-5 w-5 text-stone-700" />
      </div>
      <p className="mt-4 text-sm font-semibold text-stone-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{desc}</p>
    </div>
  );
}

export default function SmartPDMLanding() {
  return (
    <div className="min-h-screen bg-[#f7f2eb] text-stone-900">
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_top,_rgba(124,74,46,0.24),_transparent_58%),linear-gradient(180deg,_#fff8f1_0%,_#f7f2eb_100%)]" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e5d4c2] bg-white shadow-sm">
            <img src={pdmLogo} alt="PDM" className="h-10 w-10 object-contain" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7c4a2e]">
              PDM • OSFA
            </p>
            <h1 className="text-lg font-semibold text-stone-900">
              SMaRT-PDM Scholarship Portal
            </h1>
            <p className="text-sm text-stone-500">
              Office of Scholarship and Financial Assistance
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <ActionButton href="/admin/login" variant="secondary">Admin</ActionButton>
          <ActionButton href="/pd/login" variant="secondary">PD</ActionButton>
          <ActionButton href="/guidance/login" variant="secondary">Guidance</ActionButton>
          <ActionButton href="/sdo/login" variant="secondary">SDO</ActionButton>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 pb-16">
        <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e4d3c1] bg-white px-4 py-2 text-xs font-semibold text-[#7c4a2e] shadow-sm">
              <BadgeCheck className="h-4 w-4" />
              Scholarship applications, endorsements, and scholar monitoring in one system
            </div>

            <h2 className="mt-6 max-w-3xl text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">
              A cleaner front door for applicants, scholars, and office staff.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
              SMaRT-PDM centralizes scholarship application review, endorsement workflows,
              requirement tracking, and office-level coordination for Pambayang Dalubhasaan ng Marilao.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionButton href={APP_DOWNLOAD_URL} external>
                <Download className="h-4 w-4" />
                Download Mobile App
              </ActionButton>
              <ActionButton href="/admin/login" variant="dark">
                Open Admin Portal
              </ActionButton>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Access</p>
                <p className="mt-2 text-sm font-semibold text-stone-900">Role-based portals</p>
                <p className="mt-1 text-sm text-stone-600">Admin, PD, Guidance, and SDO have their own workspaces.</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Workflow</p>
                <p className="mt-2 text-sm font-semibold text-stone-900">Endorsement tracking</p>
                <p className="mt-1 text-sm text-stone-600">Move applicants clearly from SDO to Guidance to PD.</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Monitoring</p>
                <p className="mt-2 text-sm font-semibold text-stone-900">Live office tools</p>
                <p className="mt-1 text-sm text-stone-600">Reports, maintenance, queue review, and scholar handling.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#e5d4c2] bg-white p-6 shadow-xl shadow-[#7c4a2e]/10">
            <div className="rounded-3xl bg-[linear-gradient(135deg,#7c4a2e_0%,#9a6847_100%)] p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">
                Department Access
              </p>
              <p className="mt-3 text-2xl font-semibold leading-tight">
                Open the right portal without extra steps.
              </p>
              <p className="mt-3 text-sm leading-6 text-white/80">
                Department users can sign in directly from here, while applicants use the mobile app for submission and updates.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <PortalCard
                title="Program Director"
                desc="Review endorsement outcomes and finalize PD-side scholarship decisions."
                href="/pd/login"
                tone="border-violet-100 bg-violet-50/70"
              />
              <PortalCard
                title="Guidance Office"
                desc="Handle moral standing, counseling holds, and office recommendations."
                href="/guidance/login"
                tone="border-blue-100 bg-blue-50/70"
              />
              <PortalCard
                title="Student Disciplinary Office"
                desc="Start endorsement checks and record disciplinary findings with offense details."
                href="/sdo/login"
                tone="border-emerald-100 bg-emerald-50/70"
              />
              <PortalCard
                title="Admin Portal"
                desc="Manage applications, readiness, reports, openings, and scholar activation."
                href="/admin/login"
                tone="border-stone-200 bg-stone-50"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-4">
          <FeatureCard
            icon={FileSearch}
            title="Application Review"
            desc="Track submissions, verify requirements, and separate readiness from incomplete records."
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Endorsement Workflow"
            desc="Support SDO, Guidance, and PD decisions with slip generation and PDF download."
          />
          <FeatureCard
            icon={LayoutPanelTop}
            title="Office Modules"
            desc="Each department now has queue, reports, maintenance, tracker, and dashboard access."
          />
          <FeatureCard
            icon={MessageSquareText}
            title="Communication"
            desc="Keep announcements, office actions, and applicant flow aligned in one system."
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              For Applicants and Scholars
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-stone-900">
              Mobile-first access for scholarship progress.
            </h3>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              Applicants can submit documents, track status, and stay informed using the mobile app,
              while scholars and office staff follow structured workflows across the web portals.
            </p>
            <div className="mt-5">
              <ActionButton href={APP_DOWNLOAD_URL} external>
                <Download className="h-4 w-4" />
                Download APK
              </ActionButton>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#e5d4c2] bg-[#fffaf5] p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7c4a2e]">
              System Coverage
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#ead7c6] bg-white p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-[#7c4a2e]" />
                  <p className="text-sm font-semibold text-stone-900">Department Portals</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  PD, Guidance, and SDO each get focused modules instead of one overloaded page.
                </p>
              </div>
              <div className="rounded-2xl border border-[#ead7c6] bg-white p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-[#7c4a2e]" />
                  <p className="text-sm font-semibold text-stone-900">Verified Slips</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Endorsement slips can be reviewed, downloaded, and verified through their digital record.
                </p>
              </div>
              <div className="rounded-2xl border border-[#ead7c6] bg-white p-4">
                <div className="flex items-center gap-3">
                  <FileSearch className="h-5 w-5 text-[#7c4a2e]" />
                  <p className="text-sm font-semibold text-stone-900">Readiness Review</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Admin can separate incomplete applications from applicants who are ready for scholar handling.
                </p>
              </div>
              <div className="rounded-2xl border border-[#ead7c6] bg-white p-4">
                <div className="flex items-center gap-3">
                  <LayoutPanelTop className="h-5 w-5 text-[#7c4a2e]" />
                  <p className="text-sm font-semibold text-stone-900">Office Reports</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Generate office-specific reports for SDO, Guidance, and PD with result filters and date ranges.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-stone-200 pt-8 text-center text-xs text-stone-500">
          © 2026 Pambayang Dalubhasaan ng Marilao • Office of Scholarship and Financial Assistance
        </footer>
      </main>
    </div>
  );
}
