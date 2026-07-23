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
import useLandingTheme from '@/hooks/useLandingTheme';
import { buildApiUrl } from '@/api';
import { DEFAULT_POLICY_CONTENT, mergePolicyContent } from '@/constants/policyContent';
import pdmLogo from '../assets/pdm-logo.png';

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
  const { theme } = useLandingTheme();
  const Icon = policyIcons[iconName] || ShieldCheck;

  useEffect(() => {
    document.title = `${title} | SMaRT-PDM`;
  }, [title]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header style={{ background: `linear-gradient(135deg, ${theme.dark}, ${theme.base})` }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
          <Link to="/landing" className="flex items-center gap-3 text-white">
            <img src={pdmLogo} alt="" className="h-10 w-10 object-contain" />
            <span><span className="block text-xs font-bold uppercase tracking-[0.18em]">SMaRT-PDM</span><span className="text-[11px] text-white/65">PDM–OSFA</span></span>
          </Link>
          <Link to="/landing" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15">
            <ArrowLeft size={15} aria-hidden="true" /> Back to landing
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 md:py-14">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm md:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: theme.soft, color: theme.base }}>
            {React.createElement(Icon, { size: 22, 'aria-hidden': true })}
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>Public information</p>
          <h1 className="mt-2 text-3xl font-bold">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600">{intro}</p>
          <p className="mt-3 text-xs text-stone-400">Effective date: {effectiveDate}</p>

          <div className="mt-9 space-y-7">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-bold">{section.title}</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-stone-600">{section.body}</p>
              </section>
            ))}
            {children}
          </div>
        </div>
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
      <section id="data-processing-consent" className="scroll-mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <div className="flex items-center gap-3">
          {React.createElement(ConsentIcon, { size: 20, 'aria-hidden': true })}
          <h2 className="text-lg font-bold">{content.consent_title}</h2>
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
