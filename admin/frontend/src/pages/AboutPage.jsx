import React from 'react';
import {
  FileText,
  GraduationCap,
  Route,
  ScanLine,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import LandingInstitutionHeader from '@/components/landing/LandingInstitutionHeader';
import PublicContentCard, { PublicCardHeading } from '@/components/landing/PublicContentCard';
import PublicPageBanner from '@/components/landing/PublicPageBanner';
import PublicPageNav from '@/components/landing/PublicPageNav';
import useLandingTheme from '@/hooks/useLandingTheme';
import pdmFacade from '@/assets/PDM-Facade-optimized.jpg';

const smartStory = [
  {
    title: 'From a Manual Process to a Shared Vision',
    body: 'Scholarship services at PDM once depended on paper forms, physical documents, office logbooks, spreadsheets, and separate group chats. Students had limited visibility into available slots and application progress, while OSFA personnel handled repeated checking, follow-ups, and reporting by hand. SMaRT-PDM began with a shared vision: make scholarship assistance easier to reach, simpler to manage, and clearer for everyone involved.',
    icon: FileText,
    lead: true,
  },
  {
    title: 'One Guided Journey for Every Applicant',
    body: 'SMaRT-PDM connects the stages that once felt separate. Students begin with a verified PDM identity, discover available programs, complete a structured application, and follow every requirement from submission to verification. Through the companion Android application, instructions, announcements, deficiencies, and status updates remain accessible throughout the journey.',
    icon: Route,
  },
  {
    title: 'Technology That Supports Human Review',
    body: 'OCR-assisted scanning helps capture printed documents and identify important details such as the student name and GWA. The technology organizes information; it does not replace institutional judgment. Authorized OSFA personnel review every scanned record, verify its accuracy, and decide whether a requirement is accepted or needs to be submitted again.',
    icon: ScanLine,
  },
  {
    title: 'A Fair and Accountable Path to Selection',
    body: 'Verified applications move through Student Discipline, Guidance, and Program Director endorsement. Only applicants who complete both requirements verification and endorsement enter the first-come, first-served readiness queue. Selection follows the available slots for each opening, while qualified applicants beyond capacity may enter the waiting list and be promoted when a slot becomes available.',
    icon: ShieldCheck,
  },
  {
    title: 'Support That Continues Beyond Approval',
    body: 'The journey continues after activation. SMaRT-PDM brings together payout schedules, academic monitoring, Return of Obligation assignments, renewal requirements, announcements, official communication, and scholarship history. Role-based workspaces, reports, notifications, and audit trails give OSFA and partner offices one dependable source of information while authorized personnel retain responsibility for every important decision.',
    icon: GraduationCap,
  },
];

const pdmObjectives = [
  'Inculcate among students and all stakeholders a culture of excellence by communicating the school vision and mission across all sectors of the college.',
  'Impart knowledge through effective instruction delivered by a core of qualified and competent faculty.',
  'Offer relevant degree and non-degree programs that are responsive to current needs.',
  'Instill social awareness among all stakeholders through relevant and worthwhile community extension programs.',
  'Nurture the talents and skills of students through various social, cultural, and co-curricular activities.',
  'Assist students through the provision of support services that address varied needs and concerns.',
  'Tap and mold future leaders through active student involvement.',
  'Adapt to changes in society through the continuing professional development of the teaching and non-teaching force.',
  'Contribute to the development of new knowledge through research.',
  'Strengthen the skills and capabilities of students through relevant exposure and the establishment of linkages.',
  'Inculcate the virtues of goodwill, integrity, nationalism, and pride in our heritage as a people.',
];

const bannerContent = {
  pdm: {
    title: 'Pambayang Dalubhasaan ng Marilao',
    description: "Discover the institution's beginnings, vision, mission, and commitment to accessible quality education.",
  },
  'smart-pdm': {
    title: 'A Better Scholarship Journey for PDM',
    description: "The story of how PDM's scholarship process became one connected, transparent, and student-centered experience.",
  },
  developers: {
    title: 'The Team Behind SMaRT-PDM',
    description: 'Meet the people responsible for the research, design, and development of the scholarship platform.',
  },
};

export default function AboutPage() {
  const { theme } = useLandingTheme();
  const routeKey = useLocation().pathname.split('/').filter(Boolean).pop();
  const pageKey = bannerContent[routeKey] ? routeKey : 'smart-pdm';

  return (
    <div className="min-h-screen text-stone-900" style={{ background: theme.pageBg }}>
      <LandingInstitutionHeader theme={theme} />
      <PublicPageNav theme={theme} />
      <main className="mx-auto w-full max-w-[80rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <PublicPageBanner {...bannerContent[pageKey]} theme={theme} />
        <div className="mt-6 md:mt-8">
          {pageKey === 'pdm' && <PdmContent theme={theme} />}
          {pageKey === 'smart-pdm' && <SmartContent theme={theme} />}
          {pageKey === 'developers' && <DevelopersContent theme={theme} />}
        </div>
      </main>
    </div>
  );
}

function PdmContent({ theme }) {
  return (
    <div className="grid gap-5 md:gap-6">
      <InstitutionStatementCard
        theme={theme}
        eyebrow="Institutional History"
        title="A college created for the Marilenyo community"
        backgroundImage={pdmFacade}
      >
        Pambayang Dalubhasaan ng Marilao grew from a shared vision that began in 2007, when local leaders and benefactors sought to create better educational opportunities for every Marilenyo. What was initially considered as a third public high school in the municipality developed into a local college in response to public demand and the needs of underserved sectors. Today, PDM continues that purpose by providing accessible tertiary education and preparing students to become capable, responsible, and community-minded graduates.
      </InstitutionStatementCard>

      <InstitutionStatementCard
        theme={theme}
        eyebrow="Our Vision"
        featured
      >
        The Pambayang Dalubhasaan ng Marilao (PDM) envisions becoming one of the premier higher educational institutions in the region, providing quality subsidized tertiary education and industry training programs committed to producing competent, competitive, capable, and skillful graduates who excel in their chosen fields.
      </InstitutionStatementCard>

      <InstitutionStatementCard
        theme={theme}
        eyebrow="Our Mission"
        featured
      >
        Cognizant of the importance of contributing to the realization of national development goals and every citizen&apos;s right to quality education, PDM commits itself to providing quality education and molding its students into productive and responsible citizens who are imbued with virtues, aware of their national heritage, and proud of their local culture.
      </InstitutionStatementCard>

      <PublicContentCard theme={theme}>
        <div className="px-6 py-8 sm:px-8 md:py-10 lg:px-10">
          <h2
            className="text-3xl font-medium italic leading-none tracking-[-0.03em] md:text-4xl"
            style={{ color: theme.dark, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Our Objectives
          </h2>
          <span className="mt-4 block h-px w-40" style={{ background: theme.base }} aria-hidden="true" />
          <p className="mt-6 text-[15px] leading-7 text-stone-600">To achieve this, the college aims to:</p>
          <ul className="mt-7 grid gap-x-10 xl:grid-cols-2">
            {pdmObjectives.map((item) => (
              <li
                key={item}
                className="flex gap-4 border-t py-4 text-[15px] leading-7 text-stone-700"
                style={{ borderColor: theme.border }}
              >
                <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full" style={{ background: theme.base }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </PublicContentCard>
    </div>
  );
}

function InstitutionStatementCard({
  theme,
  eyebrow,
  title,
  featured = false,
  backgroundImage,
  children,
}) {
  if (featured) {
    return (
      <PublicContentCard theme={theme}>
        <div className="px-6 py-8 text-left sm:px-8 md:py-10 lg:px-10">
          <h2
            className="text-3xl font-medium italic leading-none tracking-[-0.03em] md:text-4xl"
            style={{ color: theme.dark, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {eyebrow}
          </h2>
          <span className="mt-4 block h-px w-32" style={{ background: theme.base }} aria-hidden="true" />
          <p className="mt-6 max-w-5xl text-base leading-8 text-stone-600 md:text-[17px]">{children}</p>
        </div>
      </PublicContentCard>
    );
  }

  if (backgroundImage) {
    return (
      <PublicContentCard theme={theme} className="relative isolate">
        <span
          className="pointer-events-none absolute inset-y-0 right-0 z-0 w-full bg-cover bg-center opacity-90 sm:w-[74%] lg:w-[54%]"
          style={{ backgroundImage: `url(${backgroundImage})` }}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-full bg-gradient-to-r from-white via-white/90 to-white/10 sm:w-[80%] lg:w-[62%]"
          aria-hidden="true"
        />
        <div className="relative z-10 px-6 py-8 sm:px-8 md:py-9 lg:px-10 lg:py-10">
          <div className="max-w-3xl lg:max-w-[62%]">
            <PublicCardHeading theme={theme} eyebrow={eyebrow} title={title} />
            <p className="mt-5 text-[15px] leading-8 text-stone-600">{children}</p>
          </div>
        </div>
      </PublicContentCard>
    );
  }

  return (
    <PublicContentCard theme={theme} className="relative">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: theme.accent }} aria-hidden="true" />
      <div className="px-6 py-8 sm:px-8 md:py-9 lg:px-10">
        <PublicCardHeading theme={theme} eyebrow={eyebrow} title={title} />
        <p className="mt-5 max-w-5xl text-[15px] leading-8 text-stone-600">{children}</p>
      </div>
    </PublicContentCard>
  );
}

function SmartContent({ theme }) {
  return (
    <PublicContentCard theme={theme}>
      {smartStory.map(({ title, body, icon }, index) => (
        <section
          key={title}
          className={`grid gap-6 px-6 py-8 sm:px-8 md:grid-cols-[17rem_minmax(0,1fr)] md:gap-10 md:py-9 lg:px-10 ${index ? 'border-t' : ''}`}
          style={index ? { borderColor: theme.border } : undefined}
        >
          <div>
            <PublicCardHeading
              theme={theme}
              icon={icon}
              eyebrow={`Chapter ${String(index + 1).padStart(2, '0')}`}
              title={title}
            />
          </div>
          <p className="max-w-3xl text-[15px] leading-8 text-stone-600 md:pt-1">{body}</p>
        </section>
      ))}
    </PublicContentCard>
  );
}

function DevelopersContent({ theme }) {
  return (
    <PublicContentCard theme={theme}>
      <div className="px-6 py-14 text-center sm:px-8 md:py-16">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: theme.soft, color: theme.base }}>
          <UserRound size={24} strokeWidth={1.8} />
        </span>
        <h2 className="mt-5 text-xl font-bold md:text-2xl">Developer profiles coming soon</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-stone-500">
          Names, roles, biographies, and photographs will be added when the official team details are provided.
        </p>
      </div>
    </PublicContentCard>
  );
}
