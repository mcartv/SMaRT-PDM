import React from 'react';
import { Link } from 'react-router-dom';

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
    'inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition active:scale-[0.99]',
    fullWidth ? 'w-full' : '',
    variant === 'primary'
      ? 'bg-[#7c4a2e] text-white shadow-lg shadow-[#7c4a2e]/20 hover:bg-[#6a3a25]'
      : 'border border-stone-200 bg-white/70 text-stone-800 shadow-sm hover:bg-white',
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

export default function SmartPDMLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#7c4a2e] via-[#7c4a2e] to-white">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            {/* Image is optional; if missing at runtime, fallback alt text still renders */}
            <img src={pdmLogo} alt="SMaRT-PDM" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">
              SMaRT · PDM
            </p>
            <p className="text-sm font-semibold text-white">Scholarship Monitoring</p>
          </div>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <ActionButton href="/admin/login" variant="secondary">Admin Portal</ActionButton>
          <ActionButton href="/pd/login" variant="secondary">PD Portal</ActionButton>
          <ActionButton href="/guidance/login" variant="secondary">Guidance Portal</ActionButton>
          <ActionButton href="/sdo/login" variant="secondary">SDO Portal</ActionButton>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <section className="text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold ring-1 ring-white/20">
              <span className="h-2 w-2 rounded-full bg-[#d4a98a]" />
              OSFA / PDM Applicants, Scholars, and Departments
            </div>

            <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
              Get updates. Track applications.
              <br />
              Open the right portal faster.
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-white/80">
              SmartPDM is your mobile companion for scholarship applications and monitoring—fast, secure, and easy to use.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <ActionButton href={APP_DOWNLOAD_URL} external>Download the app</ActionButton>
              <ActionButton href="/pd/login" variant="secondary">PD Portal</ActionButton>
              <ActionButton href="/guidance/login" variant="secondary">Guidance Portal</ActionButton>
              <ActionButton href="/sdo/login" variant="secondary">SDO Portal</ActionButton>
              <ActionButton href="/admin/login" variant="secondary">Admin Portal</ActionButton>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-white/70">
              <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
                <p className="font-semibold text-white">Secure access</p>
                <p className="mt-1">JWT-protected workflows</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
                <p className="font-semibold text-white">Department-ready</p>
                <p className="mt-1">Direct SDO portal entry from landing</p>
              </div>
            </div>
          </section>

          {/* Feature cards */}
          <section className="rounded-3xl bg-white/90 p-6 shadow-xl ring-1 ring-black/5 backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#e9dcc8] bg-[#f7f1e9] p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-[#92500f]">
                  Quick access
                </p>
                <p className="mt-2 text-sm font-semibold text-stone-900">Department Portal</p>
                <p className="mt-1 text-sm text-stone-600">
                  Send department users straight to their role-specific portal.
                </p>
                <div className="mt-4 space-y-2">
                  <ActionButton href="/pd/login" fullWidth>PD Login</ActionButton>
                  <ActionButton href="/guidance/login" fullWidth variant="secondary">Guidance Login</ActionButton>
                  <ActionButton href="/sdo/login" fullWidth variant="secondary">SDO Login</ActionButton>
                </div>
              </div>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-100">
                <p className="text-sm font-semibold text-stone-900">Application Review</p>
                <p className="mt-1 text-sm text-stone-600">
                  Submit and keep track of application status.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-100">
                <p className="text-sm font-semibold text-stone-900">Document Verification</p>
                <p className="mt-1 text-sm text-stone-600">
                  Upload and verify required documents.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-100">
                <p className="text-sm font-semibold text-stone-900">FA Monitor</p>
                <p className="mt-1 text-sm text-stone-600">
                  Stay updated on scholarship progress.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-100">
                <p className="text-sm font-semibold text-stone-900">Messaging</p>
                <p className="mt-1 text-sm text-stone-600">
                  Chat and announcements, centralized.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-[#f7f1e9] p-5 ring-1 ring-[#e9dcc8]">
              <p className="text-xs font-bold uppercase tracking-widest text-[#92500f]">
                Download link
              </p>
              <p className="mt-2 text-sm font-semibold text-stone-900">
                SMaRT-PDM.apk
              </p>
              <p className="mt-1 text-sm text-stone-600">
                Tap “Download the app” to install on your phone.
              </p>
              <div className="mt-4 flex gap-3">
                <ActionButton href={APP_DOWNLOAD_URL} external fullWidth>Download APK</ActionButton>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom section */}
        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-stone-100">
            <p className="text-sm font-semibold text-stone-900">For Applicants</p>
            <p className="mt-2 text-sm text-stone-600">
              Apply, track updates, and manage your requirements.
            </p>
          </div>
          <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-stone-100">
            <p className="text-sm font-semibold text-stone-900">For Scholars</p>
            <p className="mt-2 text-sm text-stone-600">
              Monitor progress and stay informed through the term.
            </p>
          </div>
          <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-stone-100">
            <p className="text-sm font-semibold text-stone-900">For OSFA Staff</p>
            <p className="mt-2 text-sm text-stone-600">
              Admin portal tools for review, verification, and reporting.
            </p>
          </div>
          <div className="rounded-3xl bg-[#f7f1e9] p-6 shadow-sm ring-1 ring-[#e9dcc8] lg:col-span-3">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-900">Department access</p>
                <p className="mt-2 max-w-2xl text-sm text-stone-600">
                  Department users can open the PD, Guidance, or SDO portal directly from the landing page without going through the admin login first.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ActionButton href="/pd/login">PD Login</ActionButton>
                <ActionButton href="/guidance/login" variant="secondary">Guidance Login</ActionButton>
                <ActionButton href="/sdo/login" variant="secondary">SDO Login</ActionButton>
                <ActionButton href="/admin/login" variant="secondary">Admin Login</ActionButton>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-14 pb-10 text-center text-xs text-white/70">
          © 2026 Office for Scholarship and Financial Assistance
        </footer>
      </main>
    </div>
  );
}

