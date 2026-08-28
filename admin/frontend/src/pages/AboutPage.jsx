import React, { useEffect, useRef, useState } from 'react';
import {
  FileText,
  GraduationCap,
  Mail,
  Route,
  ScanLine,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import LandingInstitutionHeader from '@/components/landing/LandingInstitutionHeader';
import PublicContentCard, { PublicCardHeading } from '@/components/landing/PublicContentCard';
import PublicPageBanner from '@/components/landing/PublicPageBanner';
import PublicPageNav from '@/components/landing/PublicPageNav';
import PublicPageFooter from '@/components/landing/PublicPageFooter';
import useLandingTheme from '@/hooks/useLandingTheme';
import pdmFacade from '@/assets/PDM-Facade-optimized.jpg';
import carlDeveloperCard from '@/assets/developers/carl-arthur-buenavidez.png';
import jerryDeveloperCard from '@/assets/developers/jerry-geoff-bho.png';
import leoDeveloperCard from '@/assets/developers/leo-lawrence-galve.png';
import veniceDeveloperCard from '@/assets/developers/venice-eve-pelima.png';

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
        {pageKey !== 'developers' && <PublicPageBanner {...bannerContent[pageKey]} theme={theme} />}
        <div className={pageKey === 'developers' ? '' : 'mt-6 md:mt-8'}>
          {pageKey === 'pdm' && <PdmContent theme={theme} />}
          {pageKey === 'smart-pdm' && <SmartContent theme={theme} />}
          {pageKey === 'developers' && <DevelopersContent theme={theme} />}
        </div>
      </main>
      <PublicPageFooter theme={theme} />
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
          className={`grid gap-6 px-6 py-8 sm:px-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10 md:py-9 lg:px-10 ${index ? 'border-t' : ''}`}
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

const developerTeam = [
  {
    name: 'Jerry Geoff DS. Bho',
    teamCategory: 'Technical Writer',
    primaryRole: 'Technical Writer',
    supportingRole: 'Internet of Things Assistant',
    supportingRoles: ['Internet of Things Assistant'],
    image: jerryDeveloperCard,
    summary: 'Leads the technical writing and documentation work for SMaRT-PDM while assisting with the Internet of Things component. His work focuses on keeping the manuscript, user documentation, process descriptions, and technical references aligned with the implemented system.',
    email: 'jerrybho8@gmail.com',
    github: 'butterbyeee',
    contributions: [
      { title: 'Technical Writing & Documentation', body: 'Prepares and refines the manuscript, user documentation, process descriptions, and technical materials used to explain SMaRT-PDM.' },
      { title: 'Internet of Things Assistance', body: 'Assists with the Raspberry Pi-connected document-processing component and supports the documentation of its workflow and operation.' },
    ],
  },
  {
    name: 'Carl Arthur Buenavidez',
    teamCategory: 'Core Developer',
    primaryRole: 'Full-Stack Developer',
    supportingRole: 'Web Application · Mobile Application · Database Manager',
    supportingRoles: ['Web Application', 'Mobile Application', 'Database Manager'],
    image: carlDeveloperCard,
    summary: "Serves as one of the core developers of SMaRT-PDM, contributing across the web application, mobile application, and database management. His work focuses on connecting user-facing scholarship workflows with shared services and records so web and mobile features remain consistent across the platform.",
    email: 'buenavidezcarlarthur@gmail.com',
    github: 'mcartv',
    contributions: [
      { title: 'Web Application Development', body: 'Develops and integrates web interfaces, application workflows, and backend-connected features across SMaRT-PDM. His work helps keep web modules connected to shared services and scholarship records.' },
      { title: 'Mobile Application Development', body: 'Contributes to Flutter-based applicant and scholar workflows, including screens and data interactions that connect mobile features to shared APIs and records.' },
      { title: 'Database Management', body: 'Manages the organization and integration of scholarship data in PostgreSQL and Supabase, helping web and mobile modules work from consistent and synchronized records.' },
    ],
  },
  {
    name: 'Leo Lawrence M. Galve',
    teamCategory: 'Core Developer',
    primaryRole: 'Full-Stack Developer',
    supportingRole: 'Web Application · Mobile Application · Internet of Things Developer',
    supportingRoles: ['Web Application', 'Mobile Application', 'Internet of Things Developer'],
    image: leoDeveloperCard,
    summary: 'Serves as one of the core developers of SMaRT-PDM, contributing to the web application, mobile application, and Internet of Things components. His work focuses on connecting scholarship workflows across the web platform, student mobile experience, and Raspberry Pi-based document-processing component so these parts operate as one system.',
    email: 'galveleolawrence@gmail.com',
    github: 'lolesciax',
    contributions: [
      { title: 'Web Application Development', body: 'Builds and connects web functionality for scholarship workflows, supporting role-based screens, backend interactions, and integration with other SMaRT-PDM components.' },
      { title: 'Mobile Application Development', body: 'Contributes to Flutter-based applicant and scholar workflows, linking mobile screens to shared APIs, schedules, notifications, and scholarship records.' },
      { title: 'Internet of Things Development', body: 'Works on Raspberry Pi-connected document capture and OCR-assisted processing, helping connect the scanning workflow and extracted information to the rest of SMaRT-PDM.' },
    ],
  },
  {
    name: 'Venice Eve Pelima',
    teamCategory: 'Core Developer',
    primaryRole: 'Full-Stack Developer',
    supportingRole: 'Web Application · Mobile Application · Internet of Things Developer',
    supportingRoles: ['Web Application', 'Mobile Application', 'Internet of Things Developer'],
    image: veniceDeveloperCard,
    summary: 'Serves as one of the core developers of SMaRT-PDM, contributing across the web application, mobile application, and Internet of Things document-processing component. Her work focuses on connecting scholarship workflows across these parts of the system and supporting the Raspberry Pi-based OCR-assisted document-processing implementation.',
    email: 'vncvppp@gmail.com',
    github: 'vncvppp',
    contributions: [
      { title: 'Web Application Development', body: 'Develops and integrates web interfaces and scholarship workflows across multiple SMaRT-PDM modules, helping connect frontend behavior with shared system services.' },
      { title: 'Mobile Application Development', body: 'Develops Flutter workflows for applicants and scholars across application, monitoring, schedules, renewals, and other continuing scholarship services.' },
      { title: 'Internet of Things Development', body: 'Works on Raspberry Pi 4B document scanning, image preprocessing, and OCR-assisted text extraction, including the connection of processed results to the system workflow.' },
    ],
  },
];

const projectTechnologyGroups = [
  {
    number: '01',
    title: 'Web Application',
    description: 'Public pages and role-based web workspaces used by PDM offices.',
    rows: [
      { label: 'Frontend', items: ['JavaScript / JSX', 'React', 'Vite', 'Tailwind CSS', 'Radix UI'] },
      { label: 'Connected Features', items: ['Socket.IO', 'ExcelJS', 'PDFKit', 'Multer'] },
    ],
  },
  {
    number: '02',
    title: 'Mobile Application',
    description: 'The Flutter application used by applicants and scholars.',
    rows: [
      { label: 'Core', items: ['Dart', 'Flutter', 'Provider', 'HTTP'] },
      { label: 'Device & Documents', items: ['Image Picker', 'Geolocator', 'QR Flutter', 'Syncfusion Flutter PDF'] },
    ],
  },
  {
    number: '03',
    title: 'Backend & Data',
    description: 'Application services, authentication, records, messaging, and integrations.',
    rows: [
      { label: 'Server & Database', items: ['Node.js', 'Express.js', 'Supabase', 'PostgreSQL', 'SQL'] },
      { label: 'Authentication & Services', items: ['JWT', 'bcrypt', 'Twilio', 'Nodemailer', 'Enhanced OCR provider'] },
    ],
  },
  {
    number: '04',
    title: 'Internet of Things & OCR',
    description: 'The Raspberry Pi document-scanning workflow used for image capture and text extraction.',
    rows: [
      { label: 'Capture & OCR', items: ['Raspberry Pi 4B', 'Raspberry Pi Camera / rpicam-apps', 'Python', 'Tesseract OCR / pytesseract', 'OpenCV'] },
      { label: 'Processing & API', items: ['NumPy', 'Pillow', 'PaddleOCR', 'PaddlePaddle', 'ONNX Runtime', 'Flask / Flask-CORS', 'Requests', 'Supabase Python Client', 'python-dotenv'] },
    ],
  },
  {
    number: '05',
    title: 'Development & Deployment',
    description: 'Source control and deployment services used to maintain and publish SMaRT-PDM.',
    rows: [
      { label: 'Development', items: ['Git', 'GitHub'] },
      { label: 'Deployment', items: ['Vercel', 'Render'] },
    ],
  },
];


const systemScope = [
  {
    label: 'Scholarship Program & Opening Management',
    body: 'Organizes benefactors, scholarship programs, openings, available capacity, application periods, scholar records, renewal cycles, payout schedules, and other scholarship administration records in one system.',
  },
  {
    label: 'Application, Requirements & Verification',
    body: 'Captures applicant information and documentary requirements, records review results and deficiencies, and supports OCR-assisted extraction for selected printed document fields without replacing manual verification by authorized personnel.',
  },
  {
    label: 'Inter-Office Review & Endorsement',
    body: 'Routes eligible applications through the Student Discipline Office, Guidance, Program Directors, and other authorized responsibilities while preserving one synchronized application record and its endorsement history.',
  },
  {
    label: 'Scholar Monitoring & Continuing Services',
    body: 'Continues beyond applicant approval through scholar activation, payout schedules, renewal requirements, Return of Obligation activities, announcements, notifications, monitoring records, reports, and account services.',
  },
];

const systemBuildCards = [
  {
    chapter: 'We started with the scholarship process',
    title: 'Turning separate scholarship activities into one monitored lifecycle',
    body: 'The project began by studying how scholarship programs, openings, applications, documentary requirements, verification, endorsements, scholar activation, renewals, payout schedules, Return of Obligation, and continuing monitoring were handled across separate records and office activities. These stages became the foundation of one connected SMaRT-PDM workflow.',
    items: [
      'Scholarship programs, benefactors, openings, application periods, and capacity',
      'Applications, documentary requirements, deficiencies, verification, and endorsements',
      'Scholar activation, renewals, payouts, Return of Obligation, and continuing monitoring',
    ],
    icon: FileText,
  },
  {
    chapter: 'We connected the participating PDM offices',
    title: 'Building the role-based web administration and monitoring platform',
    body: 'The team translated the institutional workflow into role-appropriate web workspaces. Admin, Student Discipline Office, Guidance, Program Directors, and RO Coordinators can perform their assigned responsibilities while working from synchronized scholarship records instead of recreating the same information in disconnected files.',
    items: [
      'Role-based access to applications, documents, endorsements, scholars, reports, and maintenance functions',
      'Office-specific actions that preserve one application record and its review history',
      'Centralized monitoring of renewals, payout schedules, obligations, and system activity',
    ],
    icon: Route,
  },
  {
    chapter: 'We brought the process directly to applicants and scholars',
    title: 'Extending SMaRT-PDM through a mobile application',
    body: 'The Flutter mobile application gives applicants and active scholars direct access to the parts of the scholarship process relevant to them. It uses the same backend services as the web platform so application progress, schedules, requirements, notifications, and continuing scholarship records remain consistent across devices.',
    items: [
      'Structured application forms, documentary requirements, deficiencies, and progress tracking',
      'Announcements, notifications, scholarship information, schedules, and account services',
      'Renewal requirements, payout schedules, scholar responsibilities, obligations, and monitoring information',
    ],
    icon: GraduationCap,
  },
  {
    chapter: 'We added OCR-assisted document processing',
    title: 'Supporting verification through Raspberry Pi-based document capture and OCR',
    body: 'The final connected component extends selected document-verification workflows beyond manual transcription. Raspberry Pi 4B hardware captures document images, Python and OpenCV prepare them for processing, and Tesseract OCR / pytesseract extracts selected printed information so authorized personnel can compare structured results with the source document.',
    items: [
      'Raspberry Pi 4B and Raspberry Pi Camera / rpicam-apps for controlled document image capture',
      'Python, OpenCV, Tesseract OCR / pytesseract, and supporting libraries for preprocessing and extraction',
      'OCR output remains verification assistance only; authorized personnel retain the final verification decision',
    ],
    icon: ScanLine,
  },
];

const developmentApproach = [
  {
    number: '01',
    title: 'Research',
    body: 'Study the existing scholarship process, user needs, recurring delays, and points where information becomes difficult to track.',
  },
  {
    number: '02',
    title: 'Design',
    body: 'Translate the process into connected workflows for applicants, scholars, OSFA, and participating offices before implementation.',
  },
  {
    number: '03',
    title: 'Development',
    body: 'Build and integrate the web application, mobile application, backend, database, and Internet of Things-supported document workflow.',
  },
  {
    number: '04',
    title: 'Validation',
    body: 'Test the workflows as one system and verify that each feature supports the intended scholarship process and user responsibility.',
  },
];

function colorWithAlpha(color, alpha) {
  const value = String(color || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return value;
}

function DevelopersContent({ theme }) {
  const [selectedDeveloper, setSelectedDeveloper] = useState(null);
  const lastTriggerRef = useRef(null);

  useEffect(() => {
    if (!selectedDeveloper) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [selectedDeveloper]);

  const openDeveloper = (developer, trigger) => {
    lastTriggerRef.current = trigger || document.activeElement;
    setSelectedDeveloper(developer);
  };

  const closeDeveloper = () => {
    setSelectedDeveloper(null);
    requestAnimationFrame(() => lastTriggerRef.current?.focus?.());
  };


  return (
    <div className="grid gap-6 md:gap-8">
      <DeveloperTeamSection theme={theme} onOpenDeveloper={openDeveloper} />
      <AboutSystemSection theme={theme} />
      <WhatWeBuiltSection theme={theme} />
      <ProjectTechnologySection theme={theme} />
      <DevelopmentApproachSection theme={theme} />

      {selectedDeveloper && (
        <DeveloperProfileModal
          developer={selectedDeveloper}
          theme={theme}
          onClose={closeDeveloper}
        />
      )}
    </div>
  );
}

function DeveloperTeamSection({ theme, onOpenDeveloper }) {
  return (
    <section
      aria-labelledby="meet-the-team-title"
      className="relative isolate overflow-hidden rounded-[1.2rem]"
    >
      <span
        className="absolute inset-0 -z-30 bg-cover bg-center"
        style={{
          backgroundImage: `url(${pdmFacade})`,
          filter: 'saturate(1.02) brightness(1.01)',
        }}
        aria-hidden="true"
      />

      <span
        className="absolute inset-x-0 bottom-0 -z-20 h-[52%]"
        style={{
          background: `linear-gradient(to bottom, transparent 0%, transparent 22%, ${colorWithAlpha(theme.pageBg, 0.16)} 54%, ${colorWithAlpha(theme.pageBg, 0.52)} 76%, ${colorWithAlpha(theme.pageBg, 0.84)} 90%, ${theme.pageBg} 100%)`,
        }}
        aria-hidden="true"
      />

      <span
        className="absolute inset-x-0 top-0 -z-20 h-[26%]"
        style={{
          background: `linear-gradient(to bottom, ${colorWithAlpha(theme.pageBg, 0.14)} 0%, transparent 100%)`,
        }}
        aria-hidden="true"
      />

      <div className="px-6 pb-8 pt-8 sm:px-8 md:pb-10 md:pt-10 lg:px-10">
        <div className="relative max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
            Meet the Team
          </p>
          <h2
            id="meet-the-team-title"
            className="mt-2 text-3xl font-bold tracking-[-0.035em] sm:text-4xl"
            style={{ color: theme.dark }}
          >
            The people behind SMaRT-PDM
          </h2>
          <p className="mt-3 text-[15px] font-semibold leading-7" style={{ color: theme.dark }}>
            Information Technology · Academic Year 2025–2026
          </p>
        </div>

        <div className="mt-9 grid gap-x-7 gap-y-10 sm:grid-cols-2 md:mt-11 xl:grid-cols-4">
          {developerTeam.map((developer) => (
            <DeveloperPortrait
              key={developer.name}
              developer={developer}
              theme={theme}
              onOpen={(trigger) => onOpenDeveloper(developer, trigger)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}


function DeveloperPortrait({ developer, theme, onOpen }) {
  return (
    <button
      type="button"
      onClick={(event) => onOpen(event.currentTarget)}
      className="group mx-auto flex w-full max-w-[18.4rem] cursor-pointer flex-col items-center text-center outline-none transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      style={{ '--tw-ring-color': theme.base }}
      aria-label={`Open ${developer.name}'s developer profile`}
    >
      <div className="w-full rounded-[1.05rem] transition-[filter] duration-200 ease-out group-hover:drop-shadow-[0_16px_22px_rgba(45,28,16,0.18)] group-focus-visible:drop-shadow-[0_16px_22px_rgba(45,28,16,0.18)]">
        <DeveloperArtwork developer={developer} theme={theme} floating />
      </div>
      <div className="mt-4 max-w-[17rem] px-1">
        <p className="text-[15px] font-bold leading-6" style={{ color: theme.dark }}>
          {developer.primaryRole}
        </p>
        <p className="mt-1 text-[13px] font-medium leading-5 text-stone-600">
          {developer.supportingRole}
        </p>
      </div>
    </button>
  );
}


function DeveloperArtwork({ developer, theme, compact = false, floating = false }) {
  return (
    <div
      className={`relative overflow-hidden bg-black ${compact ? 'aspect-[361/463] rounded-[1.05rem] border' : 'aspect-[337/486]'} ${floating ? 'rounded-[1.05rem] drop-shadow-[0_12px_22px_rgba(45,28,16,0.16)]' : ''}`}
      style={{ borderColor: theme.border }}
    >
      <img
        src={developer.image}
        alt={`${developer.name} developer portrait card`}
        className={`absolute left-1/2 h-auto max-w-none -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 ease-out ${compact ? 'top-[58%] w-[532%]' : 'top-1/2 w-[490%] group-hover:scale-[1.018] group-focus-visible:scale-[1.018]'}`}
        draggable="false"
      />
    </div>
  );
}


function AboutSystemSection({ theme }) {
  const systemOverview = [
    {
      number: '01',
      title: 'Unified Scholarship Lifecycle',
      body: 'SMaRT-PDM digitizes and connects scholarship programs and openings, applicant intake, documentary requirements, verification, inter-office endorsement, scholar activation, renewals, payout schedules, Return of Obligation, and continuing scholar monitoring. These activities are maintained as related stages of one scholarship record instead of separate manual files and disconnected office processes.',
      icon: Route,
    },
    {
      number: '02',
      title: 'Connected Web and Mobile Access',
      body: 'Authorized PDM offices work through role-based web workspaces, while applicants and scholars use the mobile application for the information and actions relevant to them. Both interfaces use the same backend services and centralized PostgreSQL/Supabase records so application status, schedules, notifications, endorsements, and monitoring information remain synchronized across the system.',
      icon: GraduationCap,
    },
    {
      number: '03',
      title: 'OCR-Assisted Document Verification',
      body: 'A Raspberry Pi-based document-processing component supports selected verification workflows through controlled image capture, image preprocessing, and Optical Character Recognition. Extracted information is presented as verification assistance only. Authorized personnel still review the source document and retain responsibility for the final verification decision.',
      icon: ScanLine,
    },
  ];

  return (
    <PublicContentCard theme={theme}>
      <div className="px-6 py-8 sm:px-8 md:py-10 lg:px-10">
        <div className="max-w-4xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
            About the System
          </p>
          <h2 className="mt-2 text-2xl font-bold leading-tight tracking-[-0.025em] md:text-3xl" style={{ color: theme.dark }}>
            One connected system for the PDM scholarship lifecycle
          </h2>
          <p className="mt-3 max-w-4xl text-[14px] font-semibold leading-6" style={{ color: theme.base }}>
            SMART-PDM: A Web-Based and Mobile Application Scholarship Monitoring System Using Optical Character Recognition Document Processing for Pambayang Dalubhasaan ng Marilao
          </p>
          <p className="mt-5 max-w-4xl text-[15px] leading-8 text-stone-600">
            SMaRT-PDM was developed to provide Pambayang Dalubhasaan ng Marilao with a single scholarship monitoring environment that connects institutional administration, applicant and scholar services, shared data, and OCR-assisted document processing. The system is designed to support the complete scholarship process while keeping verification, endorsement, selection, and other institutional decisions under authorized PDM personnel.
          </p>
        </div>

        <div className="mt-8 grid gap-x-8 gap-y-6 lg:grid-cols-3">
          {systemOverview.map(({ number, title, body, icon: Icon }) => (
            <article key={number} className="border-t pt-5" style={{ borderColor: theme.border }}>
              <div className="grid min-h-[3.5rem] grid-cols-[minmax(0,1fr)_2.25rem] items-start gap-4">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 pt-0.5 text-xl font-black tracking-[-0.04em]" style={{ color: theme.accent }}>{number}</span>
                  <h3 className="text-base font-bold leading-6" style={{ color: theme.dark }}>{title}</h3>
                </div>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: theme.soft, color: theme.base }}
                  aria-hidden="true"
                >
                  <Icon size={17} strokeWidth={1.8} />
                </span>
              </div>
              <p className="mt-3 text-[14px] leading-7 text-stone-600">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-9 border-t pt-7" style={{ borderColor: theme.border }}>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: theme.base }}>
                System Coverage
              </p>
              <h3 className="mt-1.5 text-lg font-bold" style={{ color: theme.dark }}>
                Scholarship functions monitored across SMaRT-PDM
              </h3>
            </div>
            <p className="max-w-xl text-[14px] leading-6 text-stone-500 md:text-right">
              These areas share one connected record instead of being treated as unrelated activities.
            </p>
          </div>

          <div className="mt-5 grid gap-x-8 gap-y-1 md:grid-cols-2">
            {systemScope.map((item, index) => (
              <article
                key={item.label}
                className="border-t py-4"
                style={{ borderColor: theme.border }}
              >
                <div className="flex gap-3">
                  <span className="mt-0.5 text-[11px] font-black" style={{ color: theme.accent }}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h4 className="text-[15px] font-semibold leading-6" style={{ color: theme.dark }}>{item.label}</h4>
                    <p className="mt-1.5 text-[15px] leading-7 text-stone-600">{item.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </PublicContentCard>
  );
}



function WhatWeBuiltSection({ theme }) {
  return (
    <PublicContentCard theme={theme}>
      <div className="px-6 py-8 sm:px-8 md:py-10 lg:px-10">
        <div className="max-w-4xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
            What We Built
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] md:text-3xl" style={{ color: theme.dark }}>
            How SMaRT-PDM became one connected scholarship monitoring system
          </h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-stone-600">
            The project developed through a sequence of connected solutions. Each stage addressed a specific part of PDM&apos;s scholarship process, then became part of the same monitored system.
          </p>
        </div>

        <div className="mt-8 border-y" style={{ borderColor: theme.border }}>
          {systemBuildCards.map(({ chapter, title, body, items, icon: Icon }, index) => (
            <article
              key={chapter}
              className={`py-7 ${index ? 'border-t' : ''}`}
              style={index ? { borderColor: theme.border } : undefined}
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10">
                <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3">
                  <span
                    className="mt-5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: theme.soft, color: theme.base }}
                    aria-hidden="true"
                  >
                    <Icon size={17} strokeWidth={1.8} />
                  </span>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: theme.base }}>
                      {chapter}
                    </p>
                    <h3 className="mt-2 text-lg font-bold leading-7" style={{ color: theme.dark }}>{title}</h3>
                    <p className="mt-3 text-[15px] leading-8 text-stone-600">{body}</p>
                  </div>
                </div>

                <ul className="grid content-center gap-3 lg:min-h-full lg:border-l lg:pl-8" style={{ borderColor: theme.border }}>
                  {items.map((item) => (
                    <li key={item} className="grid grid-cols-[0.9rem_minmax(0,1fr)] gap-2.5 text-[15px] leading-7 text-stone-600">
                      <span className="mt-[0.55rem] h-1.5 w-1.5 rounded-full" style={{ background: theme.accent }} aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6">
          <p className="max-w-4xl text-[15px] font-medium leading-7" style={{ color: theme.dark }}>
            Together, these stages form SMaRT-PDM: a connected web, mobile, data, and OCR-assisted scholarship monitoring system developed for Pambayang Dalubhasaan ng Marilao.
          </p>
        </div>
      </div>
    </PublicContentCard>
  );
}


function ProjectTechnologySection({ theme }) {
  return (
    <PublicContentCard theme={theme}>
      <div className="px-6 py-8 sm:px-8 md:py-10 lg:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
              Technologies Used
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] md:text-2xl" style={{ color: theme.dark }}>
              Programming languages and tools used to build SMaRT-PDM
            </h2>
          </div>
          <p className="max-w-xl text-[15px] leading-7 text-stone-600 lg:text-right">
            Grouped by where each language, framework, library, platform, or development tool is used in the implementation.
          </p>
        </div>

        <div className="mt-8 border-y" style={{ borderColor: theme.border }}>
          {projectTechnologyGroups.map((group, index) => (
            <article
              key={group.title}
              className={`grid gap-5 py-6 md:grid-cols-[3.25rem_14rem_minmax(0,1fr)] md:gap-7 ${index ? 'border-t' : ''}`}
              style={index ? { borderColor: theme.border } : undefined}
            >
              <span className="text-lg font-black tracking-[-0.04em]" style={{ color: theme.accent }}>
                {group.number}
              </span>

              <div>
                <h3 className="text-base font-bold leading-6" style={{ color: theme.dark }}>{group.title}</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-stone-500">{group.description}</p>
              </div>

              <ul className="grid gap-3">
                {group.rows.map((row) => (
                  <li key={row.label} className="grid grid-cols-[0.8rem_minmax(0,1fr)] gap-2.5 text-[15px] leading-7 text-stone-600">
                    <span className="mt-[0.55rem] h-1.5 w-1.5 rounded-full" style={{ background: theme.accent }} aria-hidden="true" />
                    <span>
                      <strong className="font-semibold" style={{ color: theme.dark }}>{row.label}:</strong>{' '}
                      {row.items.join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </PublicContentCard>
  );
}

function DevelopmentApproachSection({ theme }) {
  return (
    <PublicContentCard theme={theme}>
      <div className="px-6 py-8 sm:px-8 md:py-10 lg:px-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
          Development Approach
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] md:text-2xl" style={{ color: theme.dark }}>
          From process study to system validation
        </h2>

        <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
          {developmentApproach.map((step) => (
            <article key={step.number} className="border-t pt-5" style={{ borderColor: theme.border }}>
              <div className="flex items-baseline gap-3">
                <span className="text-xl font-black tracking-[-0.04em]" style={{ color: theme.accent }}>{step.number}</span>
                <h3 className="text-base font-bold" style={{ color: theme.dark }}>{step.title}</h3>
              </div>
              <p className="mt-3 text-[15px] leading-7 text-stone-600">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </PublicContentCard>
  );
}

function GitHubMark({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .7a11.3 11.3 0 0 0-3.57 22.02c.57.1.78-.25.78-.55v-2.13c-3.18.69-3.85-1.35-3.85-1.35-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.53-2.54-.29-5.21-1.27-5.21-5.59 0-1.23.44-2.24 1.17-3.03-.12-.29-.51-1.45.11-2.99 0 0 .95-.31 3.11 1.16A10.8 10.8 0 0 1 12 6.09c.96 0 1.92.13 2.82.38 2.16-1.47 3.11-1.16 3.11-1.16.62 1.54.23 2.7.11 2.99.73.79 1.17 1.8 1.17 3.03 0 4.33-2.68 5.3-5.23 5.58.41.35.78 1.05.78 2.12v3.14c0 .3.21.66.79.55A11.3 11.3 0 0 0 12 .7Z" />
    </svg>
  );
}


function CopyMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DeveloperProfileModal({
  developer,
  theme,
  onClose,
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    setCopiedEmail(false);
  }, [developer.name]);

  useEffect(() => () => {
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
  }, []);

  const requestClose = () => onClose();

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const copyEmail = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(developer.email);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = developer.email;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopiedEmail(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedEmail(false), 1600);
    } catch {
      setCopiedEmail(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-[3px] sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="developer-profile-name"
        aria-describedby="developer-profile-summary"
        onKeyDown={handleKeyDown}
        className="relative max-h-[94vh] w-full max-w-[54rem] overflow-y-auto rounded-[1.25rem] border bg-white sm:max-h-none sm:overflow-visible sm:rounded-[1.4rem]"
        style={{
          borderColor: colorWithAlpha(theme.base, 0.22),
          boxShadow: `0 0 0 1px ${colorWithAlpha(theme.base, 0.06)}, 0 28px 80px rgba(0,0,0,0.30)`,
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1"
          style={{ background: `linear-gradient(90deg, ${theme.base}, ${theme.accent}, ${theme.heroEnd || theme.base})` }}
          aria-hidden="true"
        />
        <button
          ref={closeButtonRef}
          type="button"
          onClick={requestClose}
          className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border bg-white/95 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:right-4 sm:top-4"
          style={{ borderColor: theme.border, color: theme.dark, '--tw-ring-color': theme.base }}
          aria-label="Close developer profile"
        >
          <X size={19} />
        </button>

        <div>
          <div
            className="relative isolate overflow-hidden border-b px-5 pb-6 pt-6 sm:px-8 sm:pb-7 sm:pt-8"
            style={{
              borderColor: theme.border,
              background: `linear-gradient(135deg, ${theme.soft} 0%, #ffffff 76%)`,
            }}
          >
            <span
              className="pointer-events-none absolute inset-y-0 right-0 -z-30 w-[78%] bg-cover bg-center opacity-[0.14] sm:w-[68%]"
              style={{ backgroundImage: `url(${pdmFacade})` }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute inset-0 -z-20"
              style={{
                background: `linear-gradient(90deg, ${theme.soft} 0%, ${colorWithAlpha(theme.soft, 0.90)} 40%, rgba(255,255,255,0.80) 68%, rgba(255,255,255,0.96) 100%)`,
              }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute -left-14 -top-20 -z-10 h-56 w-56 rounded-full blur-3xl"
              style={{ background: colorWithAlpha(theme.accent, 0.10) }}
              aria-hidden="true"
            />

            <div className="relative grid items-start gap-5 sm:grid-cols-[10.75rem_minmax(0,1fr)] sm:gap-8">
              <div className="mx-auto w-full max-w-[9.5rem] rounded-[1.15rem] p-1 sm:mx-0 sm:max-w-[10.75rem]" style={{ background: colorWithAlpha(theme.base, 0.08) }}>
                <DeveloperArtwork developer={developer} theme={theme} compact />
              </div>

              <div className="min-w-0 pr-8 sm:pt-1">
                <span
                  className="inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ borderColor: theme.border, background: '#fff', color: theme.base }}
                >
                  {developer.teamCategory}
                </span>

                <h2
                  id="developer-profile-name"
                  className="mt-3 text-2xl font-bold leading-8 tracking-[-0.025em] sm:text-[1.75rem]"
                  style={{ color: theme.dark }}
                >
                  {developer.name}
                </h2>

                <p className="mt-2 text-[16px] font-bold leading-6" style={{ color: theme.dark }}>
                  {developer.primaryRole}
                </p>

                {developer.supportingRoles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[13px] font-medium leading-5" style={{ color: theme.base }}>
                    {developer.supportingRoles.map((role, index) => (
                      <React.Fragment key={role}>
                        {index > 0 && <span className="text-stone-300" aria-hidden="true">·</span>}
                        <span>{role}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}

                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  <div className="flex min-w-0 items-center rounded-[0.9rem] border bg-white transition hover:-translate-y-0.5 hover:shadow-sm" style={{ borderColor: theme.border }}>
                    <a
                      href={`mailto:${developer.email}`}
                      className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset"
                      style={{ '--tw-ring-color': theme.base }}
                      aria-label={`Email ${developer.name} at ${developer.email}`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem]" style={{ background: theme.soft, color: theme.base }}>
                        <Mail size={16} strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Email</span>
                        <span className="mt-0.5 block truncate text-[12.5px] font-semibold" style={{ color: theme.dark }}>{developer.email}</span>
                      </span>
                    </a>
                    <button
                      type="button"
                      onClick={copyEmail}
                      className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 focus:outline-none focus-visible:ring-2"
                      style={{ '--tw-ring-color': theme.base }}
                      aria-label={`Copy ${developer.name}'s email address`}
                      title="Copy email"
                    >
                      <CopyMark size={15} />
                    </button>
                  </div>

                  <a
                    href={`https://github.com/${developer.github}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex min-w-0 items-center gap-3 rounded-[0.9rem] border bg-white px-3.5 py-3 transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus-visible:ring-2"
                    style={{ borderColor: theme.border, '--tw-ring-color': theme.base }}
                    aria-label={`Open ${developer.name}'s GitHub profile in a new tab`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem]" style={{ background: theme.soft, color: theme.base }}>
                      <GitHubMark size={16} />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">GitHub</span>
                      <span className="mt-0.5 block truncate text-[12.5px] font-semibold" style={{ color: theme.dark }}>@{developer.github}</span>
                    </span>
                  </a>
                </div>
                <span className="sr-only" role="status" aria-live="polite">
                  {copiedEmail ? 'Email address copied.' : ''}
                </span>
                {copiedEmail && (
                  <p className="mt-2 text-[11px] font-semibold" style={{ color: theme.base }}>
                    Email copied to clipboard.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 pb-7 pt-6 sm:px-8 sm:pb-8">
            <section>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: theme.base }}>
                Contribution to SMaRT-PDM
              </p>
              <p id="developer-profile-summary" className="mt-2 max-w-4xl text-[15px] leading-7 text-stone-600">
                {developer.summary}
              </p>
            </section>

            <section className="mt-6 border-t pt-6" style={{ borderColor: theme.border }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: theme.base }}>
                  Project Responsibilities
                </p>
                <h3 className="mt-1.5 text-lg font-bold" style={{ color: theme.dark }}>
                  Areas handled in SMaRT-PDM
                </h3>
              </div>

              <div className={`mt-5 grid auto-rows-fr gap-x-6 ${
                  developer.contributions.length === 3
                    ? 'sm:grid-cols-2 lg:grid-cols-3'
                    : 'sm:grid-cols-2'
                }`}>
                {developer.contributions.map((item) => (
                  <article
                    key={item.title}
                    className="h-full border-t py-4"
                    style={{ borderColor: theme.border }}
                  >
                    <h4 className="text-[15px] font-semibold leading-6" style={{ color: theme.dark }}>
                      {item.title}
                    </h4>
                    <p className="mt-1.5 text-[14px] leading-7 text-stone-600">
                      {item.body}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <div className="mt-5 border-t pt-4 text-[12px] text-stone-500" style={{ borderColor: theme.border }}>
              Information Technology · Academic Year 2025–2026
            </div>
          </div>
        </div>

      </section>
    </div>
  );
}
