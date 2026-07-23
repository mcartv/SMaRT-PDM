import React, { useEffect } from 'react';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import useLandingTheme from '@/hooks/useLandingTheme';
import pdmLogo from '../assets/pdm-logo.png';

const privacySections = [
  {
    title: 'Information covered by this notice',
    body:
      'SMaRT-PDM may process identity and contact details, enrollment and academic information, scholarship application responses, uploaded supporting documents, endorsement and review records, account activity, and technical information needed to operate and secure the service.',
  },
  {
    title: 'Why information is processed',
    body:
      'Information is used to receive and evaluate scholarship applications, verify eligibility and requirements, coordinate authorized office reviews, communicate updates, administer scholar obligations and benefits, maintain records, prevent misuse, and comply with applicable institutional and legal responsibilities.',
  },
  {
    title: 'Access and disclosure',
    body:
      'Access is limited to authorized PDM and OSFA personnel and designated reviewing offices according to their responsibilities. Information may also be disclosed when required by law, regulation, audit, or a lawful request. SMaRT-PDM does not present student records as public information.',
  },
  {
    title: 'Retention and protection',
    body:
      'Records are retained only for as long as needed for scholarship administration, institutional recordkeeping, dispute resolution, audit, and applicable legal requirements. PDM applies administrative and technical safeguards, but no electronic system can guarantee absolute security.',
  },
  {
    title: 'Your privacy rights',
    body:
      'Subject to applicable rules, data subjects may request access or correction, raise a concern about processing, and ask about retention or disposal. Some records may need to be preserved when required for an active application, scholarship administration, audit, or legal obligation.',
  },
];

const termsSections = [
  {
    title: 'Purpose and acceptance',
    body:
      'SMaRT-PDM supports scholarship applications, document review, endorsement, communication, monitoring, and related OSFA services. By using the platform, you agree to use it only for legitimate PDM scholarship activities and to follow these terms and applicable institutional policies.',
  },
  {
    title: 'Account responsibility',
    body:
      'Users must provide accurate information, protect their credentials, and promptly report suspected unauthorized access. Actions performed through an account may be treated as actions of the registered user unless reported and verified otherwise.',
  },
  {
    title: 'Acceptable use',
    body:
      'Users must not submit false or misleading records, impersonate another person, access data without authorization, disrupt the service, bypass security controls, upload malicious material, or use information obtained through the platform for an unrelated purpose.',
  },
  {
    title: 'Applications and decisions',
    body:
      'Submission through SMaRT-PDM does not guarantee eligibility, endorsement, approval, payment, or continued scholarship status. Decisions remain subject to the rules of each scholarship program, document verification, available funding, and authorized institutional review.',
  },
  {
    title: 'Availability and changes',
    body:
      'PDM may maintain, update, suspend, or restrict the platform when reasonably necessary. Notices, schedules, features, and these terms may be updated to reflect operational, institutional, or legal changes. Material updates should be communicated through official channels.',
  },
  {
    title: 'Official communications',
    body:
      'Users should verify important scholarship information through SMaRT-PDM, OSFA, or PDM’s official communication channels. PDM is not responsible for instructions circulated through unofficial accounts or unverified third parties.',
  },
];

function PublicPolicyLayout({ title, intro, sections, icon: Icon, children }) {
  const { theme } = useLandingTheme();

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
          <p className="mt-3 text-xs text-stone-400">Effective date: July 23, 2026</p>

          <div className="mt-9 space-y-7">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-bold">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-stone-600">{section.body}</p>
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

  useEffect(() => {
    if (hash === '#data-processing-consent') {
      document.getElementById('data-processing-consent')?.scrollIntoView();
    }
  }, [hash]);

  return (
    <PublicPolicyLayout
      title="Privacy Notice"
      intro="This notice explains how Pambayang Dalubhasaan ng Marilao, through the Office for Scholarship and Financial Assistance, handles personal information in SMaRT-PDM. It should be read together with scholarship-specific notices and consent statements shown during application."
      sections={privacySections}
      icon={ShieldCheck}
    >
      <section id="data-processing-consent" className="scroll-mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <h2 className="text-lg font-bold">Data Processing Consent</h2>
        <p className="mt-2 text-sm leading-7 text-stone-600">
          Where consent is the appropriate basis for processing, applicants will be asked to confirm a specific consent statement before submitting information. Consent should be informed and freely given, and may be withdrawn for future consent-based processing by contacting OSFA. Withdrawal does not invalidate processing already performed and may affect services that cannot be completed without the required information.
        </p>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          Certain scholarship and institutional records may still be processed or retained when another lawful or institutional basis applies. Contact OSFA using the details published on the landing page for questions or requests.
        </p>
      </section>
    </PublicPolicyLayout>
  );
}

export function TermsOfUse() {
  return (
    <PublicPolicyLayout
      title="Terms of Use"
      intro="These terms govern access to and use of SMaRT-PDM. They are intended to protect applicants, scholars, staff, institutional records, and the integrity of scholarship processes."
      sections={termsSections}
      icon={FileText}
    />
  );
}
