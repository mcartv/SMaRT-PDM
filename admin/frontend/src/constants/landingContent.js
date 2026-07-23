export const DEFAULT_LANDING_CONTENT = {
  hero_badge: 'OSFA Digital Scholarship Platform',
  hero_title: 'Scholarship access, tracking, and updates in one system.',
  hero_description:
    'SMaRT-PDM helps applicants, scholars, and authorized staff manage scholarship applications, document updates, monitoring, and announcements through a centralized web and mobile platform.',
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
    'The applicant must not be receiving another scholarship grant.',
    'The applicant must have no derogatory or disciplinary record from SDO.',
    'Applications are processed on a first-come, first-served basis.',
    'Available slots depend on the allocation provided by each benefactor.',
    'Submitting complete requirements does not automatically guarantee approval.',
  ],
  features_title: 'Built for scholarship operations',
  features_description:
    'Designed for applicants, scholars, and OSFA staff who need a clean, direct, and reliable workflow.',
  feature_items: [
    { title: 'Application Tracking', description: 'Applicants can monitor submission progress and requirements.' },
    { title: 'Live Announcements', description: 'Scholars receive updates from OSFA and department offices.' },
    { title: 'Centralized Messaging', description: 'Communication stays organized inside one scholarship platform.' },
    { title: 'Secure Access', description: 'Role-based portals protect sensitive scholarship workflows.' },
  ],
  campus_title: 'Scholarship support built around PDM students.',
  campus_description:
    'One connected platform for scholarship access, office endorsement, requirements, and student progress.',
  credibility_title: 'Verify scholarship information through official channels.',
  credibility_description:
    "SMaRT-PDM is the scholarship monitoring platform of Pambayang Dalubhasaan ng Marilao and OSFA. Confirm important announcements through this site, the OSFA office, or PDM's official Facebook page.",
};

export function mergeLandingContent(content) {
  const source = content && typeof content === 'object' ? content : {};
  return {
    ...DEFAULT_LANDING_CONTENT,
    ...source,
    guide_steps:
      Array.isArray(source.guide_steps) && source.guide_steps.length === 4
        ? source.guide_steps
        : DEFAULT_LANDING_CONTENT.guide_steps,
    feature_items:
      Array.isArray(source.feature_items) && source.feature_items.length === 4
        ? source.feature_items
        : DEFAULT_LANDING_CONTENT.feature_items,
    requirement_items:
      Array.isArray(source.requirement_items) && source.requirement_items.length === 7
        ? source.requirement_items
        : DEFAULT_LANDING_CONTENT.requirement_items,
    requirement_notices:
      Array.isArray(source.requirement_notices) && source.requirement_notices.length === 6
        ? source.requirement_notices
        : DEFAULT_LANDING_CONTENT.requirement_notices,
  };
}
