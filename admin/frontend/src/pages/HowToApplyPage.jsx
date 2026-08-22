import React from 'react';
import { Check, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import LandingInstitutionHeader from '@/components/landing/LandingInstitutionHeader';
import PublicContentCard, { PublicCardHeading } from '@/components/landing/PublicContentCard';
import PublicPageBanner from '@/components/landing/PublicPageBanner';
import PublicPageNav from '@/components/landing/PublicPageNav';
import useLandingTheme from '@/hooks/useLandingTheme';
import { DEFAULT_LANDING_CONTENT } from '@/constants/landingContent';

const pages = {
  process: {
    title: 'Your Path from Applicant to Scholar',
    description: 'Follow the complete scholarship journey - from account verification and application review to selection and scholar activation.',
  },
  requirements: {
    title: 'Prepare a Complete Application',
    description: 'Review the documents and submission reminders you need before applying to an open scholarship program.',
  },
  obligations: {
    title: 'Responsibilities of an Active Scholar',
    description: 'Understand the academic, service, conduct, and reporting responsibilities required throughout the scholarship grant.',
  },
};

const processStages = [
  {
    id: 'application',
    stage: 'Stage 01',
    title: 'Application',
    summary: 'Create a verified account. Applications are open to qualified 1st- through 4th-year students.',
    steps: [
      ['Register with your Student ID', 'Create your account using a verified PDM Student ID.'],
      ['Verify your email', 'Confirm the email address connected to your applicant account.'],
      ['Choose an open program', 'Review current scholarship openings and select a program that fits your qualifications.'],
      ['Complete the application', 'Provide accurate personal, academic, and family information before submitting.'],
    ],
  },
  {
    id: 'review',
    stage: 'Stage 02',
    title: 'Requirements and Endorsement',
    summary: 'Complete document verification and the required office reviews.',
    steps: [
      ['Submit all requirements', 'Upload clear and readable copies of every document required by the opening.'],
      ['Complete requirements review', 'Wait for OSFA verification and replace any document marked for resubmission.'],
      ['Complete office endorsements', 'Your application proceeds through Student Discipline, Guidance, and the Program Director.'],
    ],
  },
  {
    id: 'selection',
    stage: 'Stage 03',
    title: 'Selection and Activation',
    summary: 'Qualified applicants proceed according to readiness and available slots.',
    note: 'Note: Applications follow a first-come, first-served basis after review and endorsements.',
    steps: [
      ['Enter the readiness queue', 'After completing document review and endorsements, you enter the first-come, first-served queue.'],
      ['Receive the selection result', 'The number of available slots depends on the allocation set by the benefactor. Slots are filled in queue order, while qualified overflow applicants are waitlisted.'],
      ['Become an active scholar', 'Selected applicants are activated; waitlisted applicants may be promoted when a slot becomes available.'],
    ],
  },
];

const obligations = [
  'Carry the required academic load each semester as prescribed by the course.',
  'Do not shift to another course or transfer to another school during the scholarship grant.',
  'Pass all subjects and maintain a General Weighted Average of at least 2.00, preferably within 1.00-1.99.',
  'Submit a copy of the registration form for recording and monitoring purposes.',
  'Submit a copy of grades or valid proof of grades from the previous semester for renewal.',
  'Render no fewer than ten (10) hours of Return of Obligation per semester as a PDM student assistant.',
  'Complete the Return of Obligation within the semester or inform the coordinator as soon as possible.',
  'Maintain good moral character and right conduct, especially toward faculty and staff.',
  'Finish the course within the prescribed curriculum period.',
  'Submit a diploma or certificate of graduation upon completion of the degree.',
  'Disclose any other scholarship grant and provide proof to the Scholarship Coordinator.',
  'Do not engage in illegal or immoral activities harmful to PDM, Marilao, or the benefactor.',
  'Do not commit any major academic or school offense throughout the grant.',
  'Keep the Scholarship Coordinator informed of changes to contact information.',
  'Follow Scholarship Committee policies and reasonable conditions required by the benefactor.',
];

export default function HowToApplyPage() {
  const { theme } = useLandingTheme();
  const routeKey = useLocation().pathname.split('/').filter(Boolean).pop();
  const pageKey = pages[routeKey] ? routeKey : 'process';
  const page = pages[pageKey];

  return (
    <div className="min-h-screen text-stone-900" style={{ background: theme.pageBg }}>
      <LandingInstitutionHeader theme={theme} />
      <PublicPageNav theme={theme} />
      <main className="mx-auto w-full max-w-[80rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <PublicPageBanner title={page.title} description={page.description} theme={theme} />
        <div className="mt-6 md:mt-8">
          {pageKey === 'process' && <ProcessGuide theme={theme} />}
          {pageKey === 'requirements' && <RequirementsGuide theme={theme} />}
          {pageKey === 'obligations' && <ObligationsGuide theme={theme} />}
        </div>
      </main>
    </div>
  );
}

function ProcessGuide({ theme }) {
  return (
    <div className="grid gap-5 md:gap-6">
      <PublicContentCard theme={theme} tone="soft" className="relative scroll-mt-28">
        <div className="h-1.5" style={{ background: theme.accent }} aria-hidden="true" />
        <div className="px-6 py-7 sm:px-8 md:py-8">
          <PublicCardHeading
            theme={theme}
            icon={ShieldCheck}
            iconBackground="white"
            eyebrow="Before You Begin"
            title="Confirm Your Eligibility"
            description="Applicants must be enrolled at PDM and meet the academic, residency, financial, and program-specific qualifications of the selected scholarship. Eligibility rules and available slots may vary by opening."
          />
        </div>
      </PublicContentCard>

      {processStages.map((stage, stageIndex) => (
        <PublicContentCard key={stage.id} theme={theme} className="scroll-mt-28">
          <div className="grid gap-7 px-6 py-8 sm:px-8 md:py-9 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
            <header
              className="text-center lg:flex lg:min-h-full lg:flex-col lg:items-center lg:justify-center lg:border-r lg:pr-10"
              style={{ borderColor: theme.border }}
            >
              <span
                className="inline-flex rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ background: theme.accent, color: theme.dark }}
              >
                {stage.stage}
              </span>
              <h2 className="mt-4 text-xl font-bold leading-7 md:text-2xl md:leading-8">{stage.title}</h2>
              <p className="mx-auto mt-3 max-w-[13rem] text-sm leading-6 text-stone-500 md:text-[15px] md:leading-7">{stage.summary}</p>
              {stage.note && (
                <p
                  className="mx-auto mt-4 max-w-[13rem] rounded-lg px-3 py-2 text-xs font-semibold leading-5"
                  style={{ background: theme.soft, color: theme.base }}
                >
                  {stage.note}
                </p>
              )}
            </header>
            <ol className="relative before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-stone-200">
              {stage.steps.map(([title, body], stepIndex) => {
                const stepNumber = processStages
                  .slice(0, stageIndex)
                  .reduce((total, currentStage) => total + currentStage.steps.length, 0) + stepIndex + 1;
                return (
                  <li key={title} className="relative flex gap-5 pb-7 last:pb-0">
                    <span
                      className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white text-xs font-bold"
                      style={{ background: theme.soft, color: theme.base }}
                    >
                      {String(stepNumber).padStart(2, '0')}
                    </span>
                    <div className="pt-1">
                      <h3 className="text-[15px] font-bold">{title}</h3>
                      <p className="mt-1.5 text-[15px] leading-7 text-stone-600">{body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </PublicContentCard>
      ))}
    </div>
  );
}

function RequirementsGuide({ theme }) {
  return (
    <div className="grid gap-5 md:gap-6">
      <PublicContentCard theme={theme}>
        <div className="px-6 py-8 sm:px-8 md:py-9">
          <PublicCardHeading
            theme={theme}
            icon={FileText}
            eyebrow="Application Checklist"
            title="Required Documents"
            description="Prepare clear, current, and readable copies of each required document."
          />
          <ul className="mx-auto mt-7 max-w-5xl">
            {DEFAULT_LANDING_CONTENT.requirement_items.map((item, index) => (
              <li
                key={item}
                className="flex items-start gap-4 border-t py-4.5"
                style={{ borderColor: theme.border }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                  style={{ background: theme.soft, color: theme.base }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="pt-0.5 text-[15px] leading-7 text-stone-700">{item}</p>
              </li>
            ))}
          </ul>

        </div>
      </PublicContentCard>

      <PublicContentCard theme={theme} tone="soft">
        <div className="px-6 py-8 sm:px-8 md:py-9">
          <PublicCardHeading
            theme={theme}
            icon={CheckCircle2}
            iconBackground="white"
            eyebrow="Before Submission"
            title="Important Reminders"
            description="Use this final check before sending your application."
          />
          <ul className="mx-auto mt-7 max-w-5xl">
            {DEFAULT_LANDING_CONTENT.requirement_notices.map((item) => (
              <li
                key={item}
                className="flex gap-4 border-t py-4.5 text-[15px] leading-7 text-stone-700"
                style={{ borderColor: theme.border }}
              >
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: theme.base }}>
                  <Check size={14} strokeWidth={2.5} />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </PublicContentCard>
    </div>
  );
}

function ObligationsGuide({ theme }) {
  return (
    <PublicContentCard theme={theme}>
      <div className="h-1" style={{ background: theme.accent }} aria-hidden="true" />
      <div className="px-6 py-8 sm:px-8 md:py-9 lg:px-10">
        <div className="max-w-4xl">
          <PublicCardHeading
            theme={theme}
            icon={ShieldCheck}
            eyebrow="Official OSFA Guidelines"
            title="Scholar's Obligations"
            description="One complete list of the responsibilities every active scholar must observe throughout the grant."
          />
        </div>

        <ol className="relative mx-auto mt-8 max-w-4xl">
          <span
            className="pointer-events-none absolute bottom-4 left-4 top-4 w-px"
            style={{ background: theme.border }}
            aria-hidden="true"
          />
          {obligations.map((obligation, index) => (
            <li
              key={obligation}
              className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-4 pb-6 last:pb-0 md:gap-5 md:pb-7"
            >
              <span
                className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold tabular-nums ring-4 ring-white"
                style={{ background: theme.soft, borderColor: theme.border, color: theme.base }}
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="pt-0.5 text-[15px] leading-7 text-stone-700">{obligation}</p>
            </li>
          ))}
        </ol>
      </div>
    </PublicContentCard>
  );
}
