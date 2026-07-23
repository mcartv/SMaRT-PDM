import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Database,
  FileText,
  Landmark,
  LockKeyhole,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { buildApiUrl } from '@/api';
import { DEFAULT_POLICY_CONTENT, mergePolicyContent } from '@/constants/policyContent';
import pdmLogo from '../assets/pdm-logo.png';
import pdmFacade from '../assets/PDM-Facade.png';

const policyIcons = {
  'shield-check': ShieldCheck,
  'file-text': FileText,
  database: Database,
  'lock-keyhole': LockKeyhole,
  scale: Scale,
  landmark: Landmark,
};

function usePublicPolicyContent() {
  const [content, setContent] = useState(DEFAULT_POLICY_CONTENT);

  useEffect(() => {
    let active = true;
    fetch(buildApiUrl('/api/general-settings/public'))
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (response.ok && active) setContent(mergePolicyContent(payload?.policy_content));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return content;
}

function PublicPolicyLayout({ title, intro, sections, iconName, effectiveDate, children }) {
  const Icon = policyIcons[iconName] || ShieldCheck;

  useEffect(() => {
    document.title = `${title} | SMaRT-PDM`;
  }, [title]);

  return (
    <div className="min-h-screen bg-[#f2f3ef] text-[#28160d]">
      <header className="border-b-4 border-[#f2cf00] bg-[#f7f8f4]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 md:py-5">
          <Link to="/landing" className="flex min-w-0 items-center gap-3">
            <img src={pdmLogo} alt="PDM seal" className="h-14 w-14 shrink-0 object-contain md:h-16 md:w-16" />
            <span className="min-w-0">
              <span className="block text-sm font-black uppercase leading-tight tracking-tight text-[#321b0f] md:text-xl">
                Pambayang Dalubhasaan ng Marilao
              </span>
              <span className="mt-0.5 block text-xs font-semibold italic text-stone-600 md:text-sm">
                Abangan Norte, Marilao, Bulacan
              </span>
            </span>
          </Link>
          <Link to="/landing" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#4b2a18]/20 bg-white px-3 py-2 text-xs font-bold text-[#4b2a18] shadow-sm transition hover:bg-[#f2cf00] md:px-4">
            <ArrowLeft size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Back to landing</span>
          </Link>
        </div>
      </header>

      <main className="relative isolate overflow-hidden px-5 pb-14 pt-16 md:pb-20 md:pt-20">
        <img
          src={pdmFacade}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-20 h-[58%] w-full object-cover object-center opacity-[0.13]"
        />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#f2f3ef] via-[#f2f3ef]/95 to-white/60" />

        <article className="relative mx-auto max-w-4xl rounded-[2rem] border-[3px] border-[#4b2a18] bg-white/90 px-5 pb-8 pt-14 shadow-[0_24px_70px_-45px_rgba(50,27,15,0.65)] backdrop-blur-[2px] md:px-10 md:pb-10 md:pt-16">
          <div className="absolute left-1/2 top-0 flex min-w-[210px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 rounded-xl bg-[#f2cf00] px-6 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-[#321b0f] shadow-md md:min-w-[270px] md:text-base">
            {React.createElement(Icon, { size: 19, 'aria-hidden': true })}
            OSFA Public Information
          </div>

          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7b1e1e]">SMaRT-PDM</p>
            <h1 className="mt-2 text-3xl font-black uppercase leading-tight tracking-tight text-[#321b0f] md:text-5xl">
              {title}
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-stone-600 md:text-base">{intro}</p>
            <p className="mt-4 inline-flex rounded-full bg-[#7b1e1e]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#7b1e1e]">
              Effective {effectiveDate}
            </p>
          </div>

          <div className="mt-10 grid gap-4">
            {sections.map((section) => (
              <section key={section.title} className="rounded-xl border border-[#4b2a18]/15 bg-[#faf9f5]/90 p-5">
                <h2 className="border-l-4 border-[#f2cf00] pl-3 text-base font-black uppercase tracking-wide text-[#321b0f] md:text-lg">
                  {section.title}
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-stone-600">{section.body}</p>
              </section>
            ))}
            {children}
          </div>

          <div className="-mx-5 mt-10 h-2 bg-[#f2cf00] md:-mx-10" />
          <div className="-mx-5 -mb-8 flex flex-col gap-1 bg-[#321b0f] px-5 py-4 text-xs text-white/75 sm:flex-row sm:items-center sm:justify-between md:-mx-10 md:-mb-10 md:px-10">
            <span className="font-bold text-white">#PDMians · SMaRT-PDM</span>
            <span>Office for Scholarship and Financial Assistance</span>
          </div>
        </article>
      </main>
    </div>
  );
}

export function PrivacyNotice() {
  const { hash } = useLocation();
  const content = usePublicPolicyContent();
  const ConsentIcon = policyIcons[content.consent_icon] || Database;

  useEffect(() => {
    if (hash === '#data-processing-consent') {
      window.setTimeout(() => document.getElementById('data-processing-consent')?.scrollIntoView(), 0);
    }
  }, [hash]);

  return (
    <PublicPolicyLayout
      title="Privacy Notice"
      intro={content.privacy_intro}
      sections={content.privacy_sections}
      iconName={content.privacy_icon}
      effectiveDate={content.effective_date}
    >
      <section id="data-processing-consent" className="scroll-mt-6 rounded-xl border-2 border-[#f2cf00] bg-[#fffbea] p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f2cf00] text-[#321b0f]">
            {React.createElement(ConsentIcon, { size: 19, 'aria-hidden': true })}
          </span>
          <h2 className="text-lg font-black uppercase tracking-wide text-[#321b0f]">{content.consent_title}</h2>
        </div>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-stone-600">{content.consent_body}</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-stone-600">{content.consent_note}</p>
      </section>
    </PublicPolicyLayout>
  );
}

export function TermsOfUse() {
  const content = usePublicPolicyContent();
  return (
    <PublicPolicyLayout
      title="Terms of Use"
      intro={content.terms_intro}
      sections={content.terms_sections}
      iconName={content.terms_icon}
      effectiveDate={content.effective_date}
    />
  );
}
