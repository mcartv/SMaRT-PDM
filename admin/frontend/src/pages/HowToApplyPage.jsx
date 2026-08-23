import React from 'react';
import { Check, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import LandingInstitutionHeader from '@/components/landing/LandingInstitutionHeader';
import PublicContentCard, { PublicCardHeading } from '@/components/landing/PublicContentCard';
import PublicPageBanner from '@/components/landing/PublicPageBanner';
import PublicPageNav from '@/components/landing/PublicPageNav';
import PublicPageFooter from '@/components/landing/PublicPageFooter';
import useLandingTheme from '@/hooks/useLandingTheme';
import { DEFAULT_LANDING_CONTENT } from '@/constants/landingContent';

const pages = {
  process: {
    title: 'Your Path from Applicant to Scholar',
    description: 'Start with the steps you need to complete as an applicant, then see how your submitted application moves through verification, endorsement, selection, and scholar activation.',
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

const applicantInstructions = [
  {
    title: 'Create and verify your applicant account',
    body: 'Register using your verified PDM Student ID and confirm the email address connected to your account before starting an application.',
  },
  {
    title: 'Review available scholarship openings',
    body: 'Check the scholarship program, application period, eligibility conditions, required documents, and available slots before choosing an opening.',
  },
  {
    title: 'Complete the application form',
    body: 'Provide accurate and current personal, family, academic, residency, and contact information required by the selected scholarship opening.',
  },
  {
    title: 'Prepare and submit the required documents',
    body: 'Provide clear and readable copies of every documentary requirement listed for the scholarship. Make sure the documents correspond to the information entered in your application.',
  },
  {
    title: 'Review the application before submission',
    body: 'Check the information and attached requirements carefully. Correct incomplete or inaccurate entries before sending the application for review.',
  },
  {
    title: 'Submit and monitor your application',
    body: 'After submission, use SMaRT-PDM to monitor document verification, deficiencies, endorsement progress, announcements, notifications, and other application updates.',
  },
  {
    title: 'Respond to deficiencies when required',
    body: 'If a requirement needs correction or resubmission, follow the instruction shown in SMaRT-PDM and provide the corrected document within the applicable application period.',
  },
];

const processStages = [
  {
    id: 'verification',
    stage: 'Stage 01',
    title: 'Requirements Verification',
    summary: 'The submitted application and documentary requirements are reviewed for completeness and validity.',
    steps: [
      ['Document review begins', 'Authorized personnel review the submitted requirements and the information recorded in the application.'],
      ['Deficiencies are returned for correction', 'Documents that are incomplete, unreadable, inconsistent, or require replacement are marked for correction or resubmission.'],
      ['Requirements are completed', 'The application can proceed only after the required documentary requirements have completed verification.'],
    ],
  },
  {
    id: 'endorsement',
    stage: 'Stage 02',
    title: 'Inter-Office Endorsement',
    summary: 'Applications that complete requirements verification proceed through the required institutional reviews.',
    steps: [
      ['Student Discipline review', 'The application proceeds to the Student Discipline Office for the required endorsement or review.'],
      ['Guidance review', 'The application proceeds to Guidance for the required endorsement or review.'],
      ['Program Director review', 'The Program Director completes the academic or program-level endorsement required by the scholarship workflow.'],
    ],
  },
  {
    id: 'selection',
    stage: 'Stage 03',
    title: 'Selection and Scholar Activation',
    summary: 'Applications that complete verification and endorsement become eligible for selection according to readiness and available scholarship slots.',
    note: 'Selection is subject to completed requirements and endorsements, applicant readiness, and the available capacity of the scholarship opening.',
    steps: [
      ['Enter the readiness queue', 'After completing requirements verification and the required endorsements, the application enters the first-come, first-served readiness queue.'],
      ['Receive the selection result', 'Available slots are filled according to the scholarship opening capacity. Qualified applicants beyond the available capacity may be placed on the waiting list.'],
      ['Become an active scholar', 'Selected applicants are activated as scholars. Waitlisted applicants may be promoted if a scholarship slot becomes available.'],
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
      <PublicPageFooter theme={theme} />
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
            description="Applicants must be enrolled at PDM and meet the academic, residency, financial, and program-specific qualifications of the selected scholarship. Eligibility rules, application periods, documentary requirements, and available slots may vary by opening."
          />
        </div>
      </PublicContentCard>

      <PublicContentCard theme={theme} className="scroll-mt-28">
        <div className="px-6 py-8 sm:px-8 md:py-9 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
              Application Instructions
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] md:text-3xl" style={{ color: theme.dark }}>
              What you need to do as an applicant
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-stone-600">
              These are the actions you complete in SMaRT-PDM before and after submitting your application. The institutional review process begins only after the application is submitted.
            </p>
          </div>

          <ol className="mt-8 grid gap-x-8 gap-y-0 lg:grid-cols-2">
            {applicantInstructions.map((instruction, index) => (
              <li
                key={instruction.title}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-t py-5 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:gap-4"
                style={{ borderColor: theme.border }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                  style={{ background: theme.soft, color: theme.base }}
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-[15px] font-bold leading-6" style={{ color: theme.dark }}>
                    {instruction.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-7 text-stone-600">{instruction.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </PublicContentCard>

      <div>
        <div className="mb-5 px-1 md:mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
            Application Process
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] md:text-3xl" style={{ color: theme.dark }}>
            What happens after you submit
          </h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-stone-600">
            Once submitted, the application moves through document verification, required office endorsements, and scholarship selection. These stages describe the institutional workflow rather than actions the applicant performs directly.
          </p>
        </div>

        <div className="grid gap-5 md:gap-6">
          {processStages.map((stage, stageIndex) => (
            <PublicContentCard key={stage.id} theme={theme} className="scroll-mt-28">
              <div className="grid gap-7 px-6 py-8 sm:px-8 md:py-9 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
                <header
                  className="text-left sm:text-center lg:flex lg:min-h-full lg:flex-col lg:items-center lg:justify-center lg:border-r lg:pr-10"
                  style={{ borderColor: theme.border }}
                >
                  <span
                    className="inline-flex rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ background: theme.accent, color: theme.dark }}
                  >
                    {stage.stage}
                  </span>
                  <h3 className="mt-4 text-xl font-bold leading-7 md:text-2xl md:leading-8">{stage.title}</h3>
                  <p className="mt-3 max-w-none text-sm leading-6 text-stone-500 sm:mx-auto sm:max-w-xl md:text-[15px] md:leading-7 lg:max-w-[13rem]">{stage.summary}</p>
                  {stage.note && (
                    <p
                      className="mt-4 max-w-none rounded-lg px-3 py-2 text-xs font-semibold leading-5 sm:mx-auto sm:max-w-xl lg:max-w-[13rem]"
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
                      <li key={title} className="relative flex gap-4 pb-7 last:pb-0 sm:gap-5">
                        <span
                          className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white text-xs font-bold"
                          style={{ background: theme.soft, color: theme.base }}
                        >
                          {String(stepNumber).padStart(2, '0')}
                        </span>
                        <div className="pt-1">
                          <h4 className="text-[15px] font-bold">{title}</h4>
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
      </div>

      <PublicContentCard theme={theme} tone="soft">
        <div className="px-6 py-8 sm:px-8 md:py-9">
          <PublicCardHeading
            theme={theme}
            icon={CheckCircle2}
            iconBackground="white"
            eyebrow="Application Reminders"
            title="Keep Monitoring Your Application"
            description="Submitting an application does not guarantee scholarship approval. Monitor SMaRT-PDM for deficiencies, endorsement progress, selection results, waiting-list updates, schedules, and further instructions. Scholarship decisions remain subject to eligibility, completed requirements and endorsements, and the available slots of the scholarship opening."
          />
        </div>
      </PublicContentCard>
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
