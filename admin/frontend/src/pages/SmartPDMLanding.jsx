import React from 'react';

import pdmLogo from '../assets/pdm-logo.png';

const APP_DOWNLOAD_URL = 'https://www.mediafire.com/file/8157hvb8nuqiprf/SMaRT_PDM.apk/file';

function PrimaryButton({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center rounded-xl bg-[#7c4a2e] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7c4a2e]/20 transition active:scale-[0.99] hover:bg-[#6a3a25]"
    >
      {children}
    </a>
  );
}

function SecondaryButton({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white/70 px-5 py-3 text-sm font-semibold text-stone-800 shadow-sm transition active:scale-[0.99] hover:bg-white"
    >
      {children}
    </a>
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
          <SecondaryButton href="/admin/login">Admin Portal</SecondaryButton>
          <SecondaryButton href="/sdo/login">SDO Portal</SecondaryButton>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <section className="text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold ring-1 ring-white/20">
              <span className="h-2 w-2 rounded-full bg-[#d4a98a]" />
              OSFA / PDM Applicants & Scholars
            </div>

            <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
              Get updates. Track applications.
              <br />
              Monitor your scholarship progress.
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-white/80">
              SmartPDM is your mobile companion for scholarship applications and monitoring—fast, secure, and easy to use.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <PrimaryButton href={APP_DOWNLOAD_URL}>Download the app</PrimaryButton>
              <SecondaryButton href="/admin/login">Login to portal</SecondaryButton>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-white/70">
              <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
                <p className="font-semibold text-white">Secure access</p>
                <p className="mt-1">JWT-protected workflows</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
                <p className="font-semibold text-white">Mobile-friendly</p>
                <p className="mt-1">Built for quick tracking</p>
              </div>
            </div>
          </section>

          {/* Feature cards */}
          <section className="rounded-3xl bg-white/90 p-6 shadow-xl ring-1 ring-black/5 backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-2">
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
                <a
                  href={APP_DOWNLOAD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#7c4a2e] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7c4a2e]/20 transition hover:bg-[#6a3a25]"
                >
                  Download APK
                </a>
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
        </section>

        <footer className="mt-14 pb-10 text-center text-xs text-white/70">
          © 2026 Office for Scholarship and Financial Assistance
        </footer>
      </main>
    </div>
  );
}

