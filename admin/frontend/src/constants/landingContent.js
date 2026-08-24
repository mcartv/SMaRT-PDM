const LEGACY_HERO_TITLE = 'Scholarship access, tracking, and updates in one system.';

export const DEFAULT_LANDING_CONTENT = {
  about_title: 'One connected platform for every scholarship journey.',
  about_description:
    'SMaRT-PDM brings PDM scholarship services into one secure and organized platform. It helps applicants submit requirements, follow application progress, receive official updates, and move through coordinated office reviews, while giving OSFA the tools to manage records and support scholars with greater clarity, accountability, and efficiency.',
  about_items: [
    { title: 'Centralized Scholarship Monitoring', description: 'Applications, requirements, updates, and scholar records stay organized in one reliable system.' },
    { title: 'Guided Multi-office Review', description: 'OSFA, Guidance, Student Discipline, and Program Director reviews follow a clear and accountable process.' },
    { title: 'Transparent Application Tracking', description: 'Applicants can follow progress and receive official updates throughout their scholarship journey.' },
  ],
  hero_badge: 'OSFA Digital Scholarship Platform',
  hero_title: 'Your scholarship journey, connected from application to success.',
  hero_description:
    'SMaRT-PDM helps applicants, scholars, and authorized users manage scholarship applications, document updates, monitoring, and announcements through a centralized web and mobile platform.',
  mobile_app_title: 'Scholar Mobile App',
  mobile_app_description:
    'Install the APK to track application updates and scholarship activity from your phone.',
  guide_title: 'Get started in four clear steps',
  guide_description:
    'Prepare your information, submit the application, monitor its status, and wait for the authorized office review.',
  guide_steps: [
    { title: 'Prepare your information', description: 'Review the scholarship notice and prepare accurate personal, academic, and supporting information.' },
    { title: 'Submit your application', description: 'Complete the application and upload the documents requested for the scholarship program.' },
    { title: 'Monitor your status', description: 'Follow application updates, document review, and office announcements through SMaRT-PDM.' },
    { title: 'Wait for endorsement', description: 'OSFA and the designated offices review qualified applications before final scholar activation.' },
  ],
  requirements_title: 'Application requirements',
  requirements_description:
    'Prepare clear and current copies of the required records before submitting your application through SMaRT-PDM.',
  requirement_items: [
    'Fully accomplished application form',
    'Completed endorsement slip',
    'Letter requesting scholarship or financial assistance',
    'Latest Certificate of Registration (COR)',
    'Latest Student Grade Form, with a GWA of 2.0 or better and no final grade of 5.0',
    'Certificate of Indigency issued or certified by the Punong Barangay',
    'Recent semi-formal photo for the applicant system profile',
  ],
  requirement_notices: [
    'The applicant must be a resident of Marilao, Bulacan.',
    'The applicant must not be receiving another scholarship grant, such as Pondo/Iskolar ng Bayan, Garcia/Villarica, TES, or TDP.',
    'The applicant must have no derogatory or disciplinary record from SDO.',
    'Applications are processed on a first-come, first-served basis.',
    'Available slots depend on the allocation provided by each benefactor.',
    'Submitting complete requirements does not automatically guarantee approval.',
  ],
  features_title: 'Built for scholarship operations',
  features_description:
    'Designed for applicants, scholars, and authorized OSFA users who need a clean, direct, and reliable workflow.',
  feature_items: [
    { title: 'Application Tracking', description: 'Applicants can monitor submission progress and requirements.' },
    { title: 'Live Announcements', description: 'Scholars receive updates from OSFA and department offices.' },
    { title: 'Centralized Messaging', description: 'Communication stays organized inside one scholarship platform.' },
    { title: 'Secure Access', description: 'Role-based access protects sensitive scholarship workflows.' },
  ],
  campus_title: 'Scholarship support built around PDM students.',
  campus_description:
    'One connected platform for scholarship access, office endorsement, requirements, and student progress.',
  credibility_title: 'Verify scholarship information through official channels.',
  credibility_description:
    "SMaRT-PDM is the scholarship monitoring platform of Pambayang Dalubhasaan ng Marilao and OSFA. Confirm important announcements through this site, the OSFA office, or PDM's official Facebook page.",
};


function normalizeUserTerminology(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\bauthorized staff\b/gi, 'authorized users')
    .replace(/\bOSFA staff\b/gi, 'authorized OSFA users')
    .replace(/\bstaff\b/gi, 'users');
}

export function mergeLandingContent(content) {
  const source = content && typeof content === 'object' ? content : {};
  const normalizedSource = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      typeof value === 'string' ? normalizeUserTerminology(value) : value,
    ])
  );
  const normalizeTextItems = (items, defaults) => {
    if (!Array.isArray(items)) return defaults;
    const normalized = items
      .map((item) => normalizeUserTerminology(String(item || '').trim()))
      .filter(Boolean)
      .slice(0, 12);
    return normalized.length ? normalized : defaults;
  };
  const normalizeContentItems = (items, defaults) => {
    if (!Array.isArray(items)) return defaults;
    const normalized = items
      .map((item) => ({
        title: normalizeUserTerminology(String(item?.title || '').trim()),
        description: normalizeUserTerminology(String(item?.description || '').trim()),
      }))
      .filter((item) => item.title && item.description)
      .slice(0, 12);
    return normalized.length ? normalized : defaults;
  };
  return {
    ...DEFAULT_LANDING_CONTENT,
    ...normalizedSource,
    hero_title:
      normalizedSource.hero_title === LEGACY_HERO_TITLE
        ? DEFAULT_LANDING_CONTENT.hero_title
        : normalizedSource.hero_title || DEFAULT_LANDING_CONTENT.hero_title,
    guide_steps: normalizeContentItems(normalizedSource.guide_steps, DEFAULT_LANDING_CONTENT.guide_steps),
    about_items: normalizeContentItems(normalizedSource.about_items, DEFAULT_LANDING_CONTENT.about_items),
    feature_items: normalizeContentItems(normalizedSource.feature_items, DEFAULT_LANDING_CONTENT.feature_items),
    requirement_items: normalizeTextItems(
      normalizedSource.requirement_items,
      DEFAULT_LANDING_CONTENT.requirement_items
    ),
    requirement_notices: normalizeTextItems(
      normalizedSource.requirement_notices,
      DEFAULT_LANDING_CONTENT.requirement_notices
    ),
  };
}
