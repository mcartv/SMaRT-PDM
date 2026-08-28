const supabase = require('../config/supabase');

const TABLE_NAME = 'general_settings';
const LEGACY_HERO_TITLE = 'Scholarship access, tracking, and updates in one system.';

const DEFAULT_LANDING_CONTENT = {
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
    { title: 'Secure Access', description: 'Role-based portals protect sensitive scholarship workflows.' },
  ],
  campus_title: 'Scholarship support built around PDM students.',
  campus_description:
    'One connected platform for scholarship access, office endorsement, requirements, and student progress.',
  credibility_title: 'Verify scholarship information through official channels.',
  credibility_description:
    "SMaRT-PDM is the scholarship monitoring platform of Pambayang Dalubhasaan ng Marilao and OSFA. Confirm important announcements through this site, the OSFA office, or PDM's official Facebook page.",
};

const LEGACY_POLICY_EFFECTIVE_DATE = '2026-07-23';
const LEGACY_PRIVACY_INTRO =
  'This notice explains how Pambayang Dalubhasaan ng Marilao, through the Office for Scholarship and Financial Assistance, handles personal information in SMaRT-PDM. It should be read together with scholarship-specific notices and consent statements shown during application.';

const DEFAULT_POLICY_CONTENT = {
  effective_date: '2026-08-28',
  privacy_icon: 'shield-check',
  privacy_intro:
    'This notice explains how Pambayang Dalubhasaan ng Marilao, through the Office for Scholarship and Financial Assistance, handles personal information in SMaRT-PDM. It applies to applicants, scholars, website visitors, administrators, and other authorized personnel. It should be read together with scholarship-specific notices and consent statements shown at the relevant point of collection.',
  privacy_sections: [
    { title: 'Information covered by this notice', body: 'SMaRT-PDM may process identity and contact details, enrollment and academic information, scholarship application responses, uploaded supporting documents, endorsement and review records, account activity, and technical information needed to operate and secure the service.' },
    { title: 'Why information is processed', body: 'Information is used to receive and evaluate scholarship applications, verify eligibility and requirements, coordinate authorized office reviews, communicate updates, administer scholar obligations and benefits, maintain records, prevent misuse, and comply with applicable institutional and legal responsibilities.' },
    { title: 'Document processing and verification', body: 'Uploaded documents may undergo automated text extraction and document-quality checks to assist authorized personnel during verification. These tools support the review process but do not independently approve, reject, endorse, or determine scholarship eligibility. Final decisions remain with authorized PDM personnel.' },
    { title: 'Access and disclosure', body: 'Access is limited to authorized PDM and OSFA personnel and designated reviewing offices according to their responsibilities. Information may also be disclosed when required by law, regulation, audit, or a lawful request. SMaRT-PDM does not present student records as public information.' },
    { title: 'Retention and protection', body: 'Records are retained only for as long as needed for scholarship administration, institutional recordkeeping, dispute resolution, audit, and applicable legal requirements. PDM applies administrative and technical safeguards, but no electronic system can guarantee absolute security.' },
    { title: 'Your privacy rights', body: 'Subject to applicable rules, data subjects may request access or correction, raise a concern about processing, and ask about retention or disposal. Some records may need to be preserved when required for an active application, scholarship administration, audit, or legal obligation.' },
    { title: 'Responsibility and scope', body: 'Pambayang Dalubhasaan ng Marilao, through OSFA and the authorized offices participating in scholarship administration, is responsible for the institutional processing described in this notice. The notice covers public website use, applicant and scholar services, authorized administrative workspaces, messaging, document review, endorsements, obligations, payouts, reports, and security monitoring.' },
    { title: 'Philippine privacy law and basis for processing', body: 'SMaRT-PDM processes personal data in accordance with Republic Act No. 10173, the Data Privacy Act of 2012, its Implementing Rules and Regulations, applicable issuances of the National Privacy Commission, and NPC Circular No. 16-01 on the security of personal data in government agencies. Processing follows the principles of transparency, legitimate purpose, and proportionality. Personal information is processed only when supported by consent or another lawful basis, including the delivery of requested scholarship services, performance of PDM and OSFA public and institutional functions, compliance with legal obligations, and protection of the platform and its users. Withdrawing consent affects future consent-based processing but does not invalidate prior lawful processing or records retained under another applicable basis.' },
    { title: 'Website and account activity', body: 'The public website uses an anonymous browser identifier to estimate unique visitors and prevent repeated page activity from being counted as different visitors. Authenticated portals record hashed session presence, authorized API traffic, account actions, and audit information for security, availability, accountability, and System Monitor reporting. These diagnostics do not store raw visitor identifiers or raw authentication tokens.' },
    { title: 'Service providers and data handling', body: 'PDM may use authorized service providers for hosting, database and file storage, communications, security, backup, and document-processing support. They may process only the information necessary to provide those services under applicable safeguards and PDM instructions. Information may also be shared with an authorized scholarship partner or government office when required for the relevant program, audit, public function, or lawful request.' },
    { title: 'Data retention and disposal', body: 'Public visitor, active-session, and authenticated-traffic records are retained temporarily for security, availability, and System Monitor reporting, then removed through the system cleanup process when they are no longer required. Scholarship, academic, financial, endorsement, messaging, audit, and account records are retained only while needed for their continuing administrative purpose, applicable institutional retention rules, dispute or audit requirements, and legal obligations. Records are then securely deleted, anonymized, or archived as appropriate.' },
    { title: 'Rights under the Data Privacy Act', body: 'Under Republic Act No. 10173, data subjects have the right to be informed, object to qualifying processing, obtain reasonable access, dispute inaccuracies and request correction, request blocking, removal, or destruction when the legal conditions are met, obtain data portability where applicable, lodge a complaint with the National Privacy Commission, and seek indemnification for damage caused by unlawful or inaccurate processing. These rights may be subject to lawful limitations and record-retention duties. Requests may be sent to OSFA using the official email, telephone number, office address, or office hours published on this website. PDM may verify identity before fulfilling a request.' },
  ],
  consent_icon: 'database',
  consent_title: 'Data Processing Consent',
  consent_body:
    'Where consent is the appropriate basis for processing, applicants will be asked to confirm a specific consent statement before submitting information. Consent should be informed and freely given, and may be withdrawn for future consent-based processing by contacting OSFA. Withdrawal does not invalidate processing already performed and may affect services that cannot be completed without the required information.',
  consent_note:
    'Certain scholarship and institutional records may still be processed or retained when another lawful or institutional basis applies. Contact OSFA using the details published on the landing page for questions or requests.',
  terms_icon: 'file-text',
  terms_intro:
    'These terms govern access to and use of SMaRT-PDM. They are intended to protect applicants, scholars, authorized users, institutional records, and the integrity of scholarship processes.',
  terms_sections: [
    { title: 'Purpose and acceptance', body: 'SMaRT-PDM supports scholarship applications, document review, endorsement, communication, monitoring, and related OSFA services. By using the platform, you agree to use it only for legitimate PDM scholarship activities and to follow these terms and applicable institutional policies.' },
    { title: 'Account responsibility', body: 'Users must provide accurate information, protect their credentials, and promptly report suspected unauthorized access. Actions performed through an account may be treated as actions of the registered user unless reported and verified otherwise.' },
    { title: 'Acceptable use', body: 'Users must not submit false or misleading records, impersonate another person, access data without authorization, disrupt the service, bypass security controls, upload malicious material, or use information obtained through the platform for an unrelated purpose.' },
    { title: 'Applications and decisions', body: 'Submission through SMaRT-PDM does not guarantee eligibility, endorsement, approval, payment, or continued scholarship status. Decisions remain subject to the rules of each scholarship program, document verification, available funding, and authorized institutional review.' },
    { title: 'Availability and changes', body: 'PDM may maintain, update, suspend, or restrict the platform when reasonably necessary. Notices, schedules, features, and these terms may be updated to reflect operational, institutional, or legal changes. Material updates should be communicated through official channels.' },
    { title: 'Official communications', body: 'Users should verify important scholarship information through SMaRT-PDM, OSFA, or PDM’s official communication channels. PDM is not responsible for instructions circulated through unofficial accounts or unverified third parties.' },
  ],
};

const DEFAULT_GENERAL_SETTINGS = {
  general_settings_id: 1,
  institution_name: 'Pambayang Dalubhasaan ng Marilao',
  office_name: 'Office for Scholarship and Financial Assistance',
  office_email: 'osfa@pdm.edu.ph',
  office_address: 'Abangan Norte, Marilao, Bulacan',
  landline_number: '(044) 919-8191',
  office_hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
  about_osfa:
    'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.',
  eligibility_summary:
    'Scholarship eligibility varies by program. Applicants must be enrolled at PDM, meet the academic and financial qualifications of the selected scholarship, and submit complete and accurate information for OSFA review.',
  landing_content: DEFAULT_LANDING_CONTENT,
  policy_content: DEFAULT_POLICY_CONTENT,
  featured_notice: [{
    notice_id: 'notice-default',
    title: 'Welcome to SMaRT-PDM',
    message: 'Check the mobile application and official OSFA channels for current scholarship updates.',
    link_label: '',
    link_url: '',
    is_visible: false,
    is_archived: false,
    start_date: null,
    end_date: null,
    created_at: null,
  }],
  landing_faqs: [
    {
      faq_id: 'faq-1',
      question: 'Who can apply?',
      answer:
        'Applicants must meet the eligibility requirements of the scholarship program and submit the required records through the SMaRT-PDM application process.',
      is_archived: false,
    },
    {
      faq_id: 'faq-2',
      question: 'What documents are required?',
      answer:
        'Required documents depend on the scholarship program, but applicants are expected to upload the listed requirements in the system before final review.',
      is_archived: false,
    },
    {
      faq_id: 'faq-3',
      question: 'How does endorsement work?',
      answer:
        'The endorsement slip passes through SDO, Guidance, and Program Director review. Each office records its decision before the slip can be completed.',
      is_archived: false,
    },
    {
      faq_id: 'faq-4',
      question: 'When does scholar activation happen?',
      answer:
        'Scholar activation only happens after both requirements and endorsement are complete and the admin side confirms final readiness.',
      is_archived: false,
    },
  ],
  global_deadline: '2026-03-31',
  applications_open: true,
  updated_at: null,
  updated_by_user_id: null,
  is_fallback: true,
};

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safeText(value, maxLength = 255) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  return normalized.slice(0, maxLength);
}

function normalizeDate(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeDateTime(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function sanitizeFeaturedNotice(notice = {}, fallbackId = '') {
  return {
    notice_id: safeText(notice.notice_id, 80) || safeText(fallbackId, 80),
    title: safeText(notice.title, 140),
    message: safeText(notice.message, 5000),
    link_label: safeText(notice.link_label, 60),
    link_url: safeText(notice.link_url, 500),
    is_visible: notice.is_visible === true,
    is_archived: notice.is_archived === true,
    start_date: normalizeDate(notice.start_date),
    end_date: normalizeDate(notice.end_date),
    created_at: normalizeDateTime(notice.created_at),
  };
}

function sanitizeFeaturedNotices(value) {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value]
      : [];

  return source
    .slice(0, 20)
    .map((notice, index) => sanitizeFeaturedNotice(notice, `notice-legacy-${index + 1}`))
    .filter((notice) => notice.title || notice.message);
}

function getManilaDateValue() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateFeaturedNoticeDateRanges(value) {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value]
      : [];
  const today = getManilaDateValue();

  source.slice(0, 20).forEach((notice, index) => {
    if (notice?.is_archived === true) return;
    const rawTitle = String(notice?.title ?? '').trim();
    const rawMessage = String(notice?.message ?? '').trim();
    const rawStartDate = String(notice?.start_date ?? '').trim();
    const rawEndDate = String(notice?.end_date ?? '').trim();
    const startDate = normalizeDate(rawStartDate);
    const endDate = normalizeDate(rawEndDate);
    const noticeLabel = safeText(notice?.title, 140) || `Notice ${index + 1}`;

    if (!rawTitle) {
      throw createHttpError(400, `Notice ${index + 1}: Notice Title is required.`);
    }
    if (!rawMessage) {
      throw createHttpError(400, `${noticeLabel}: Public Message is required.`);
    }
    if (!rawStartDate) {
      throw createHttpError(400, `${noticeLabel}: Show From is required.`);
    }
    if (!rawEndDate) {
      throw createHttpError(400, `${noticeLabel}: Show Until is required.`);
    }
    if (!startDate) {
      throw createHttpError(400, `${noticeLabel}: Show From must be a valid date.`);
    }
    if (!endDate) {
      throw createHttpError(400, `${noticeLabel}: Show Until must be a valid date.`);
    }
    if (startDate < today) {
      throw createHttpError(400, `${noticeLabel}: Show From cannot be earlier than today.`);
    }
    if (endDate < startDate) {
      throw createHttpError(400, `${noticeLabel}: Show Until must be the same as or later than Show From.`);
    }
  });
}

function sanitizeLandingItems(items, defaults) {
  if (!Array.isArray(items)) return defaults.map((item) => ({ ...item }));
  const normalized = items
    .map((item) => ({
      title: safeText(item?.title, 120),
      description: safeText(item?.description, 500),
    }))
    .filter((item) => item.title && item.description)
    .slice(0, 12);
  return normalized.length ? normalized : defaults.map((item) => ({ ...item }));
}

function sanitizeLandingTextItems(items, defaults, maxLength = 500) {
  if (!Array.isArray(items)) return [...defaults];
  const normalized = items
    .map((item) => safeText(item, maxLength))
    .filter(Boolean)
    .slice(0, 12);
  return normalized.length ? normalized : [...defaults];
}

function sanitizeLandingContent(content = {}) {
  const defaults = DEFAULT_LANDING_CONTENT;
  const heroTitle = safeText(content.hero_title, 180);
  return {
    about_title: safeText(content.about_title, 180) || defaults.about_title,
    about_description: safeText(content.about_description, 1200) || defaults.about_description,
    about_items: sanitizeLandingItems(content.about_items, defaults.about_items),
    hero_badge: safeText(content.hero_badge, 80) || defaults.hero_badge,
    hero_title: heroTitle === LEGACY_HERO_TITLE ? defaults.hero_title : heroTitle || defaults.hero_title,
    hero_description: safeText(content.hero_description, 600) || defaults.hero_description,
    mobile_app_title: safeText(content.mobile_app_title, 100) || defaults.mobile_app_title,
    mobile_app_description:
      safeText(content.mobile_app_description, 400) || defaults.mobile_app_description,
    guide_title: safeText(content.guide_title, 160) || defaults.guide_title,
    guide_description: safeText(content.guide_description, 400) || defaults.guide_description,
    guide_steps: sanitizeLandingItems(content.guide_steps, defaults.guide_steps),
    requirements_title:
      safeText(content.requirements_title, 160) || defaults.requirements_title,
    requirements_description:
      safeText(content.requirements_description, 600) || defaults.requirements_description,
    requirement_items:
      sanitizeLandingTextItems(content.requirement_items, defaults.requirement_items, 500),
    requirement_notices:
      sanitizeLandingTextItems(content.requirement_notices, defaults.requirement_notices, 500),
    features_title: safeText(content.features_title, 160) || defaults.features_title,
    features_description:
      safeText(content.features_description, 400) || defaults.features_description,
    feature_items: sanitizeLandingItems(content.feature_items, defaults.feature_items),
    campus_title: safeText(content.campus_title, 160) || defaults.campus_title,
    campus_description: safeText(content.campus_description, 400) || defaults.campus_description,
    credibility_title:
      safeText(content.credibility_title, 180) || defaults.credibility_title,
    credibility_description:
      safeText(content.credibility_description, 600) || defaults.credibility_description,
  };
}

const POLICY_ICONS = new Set(['shield-check', 'file-text', 'database', 'lock-keyhole', 'scale', 'landmark']);

function sanitizePolicySections(items, defaults) {
  if (!Array.isArray(items)) return defaults.map((item) => ({ ...item }));
  const normalized = items
    .map((item) => ({
      title: safeText(item?.title, 160),
      body: safeText(item?.body, 1800),
    }))
    .filter((item) => item.title && item.body)
    .slice(0, 12);
  return normalized.length ? normalized : defaults.map((item) => ({ ...item }));
}

function ensureRequiredPrivacySections(sections) {
  const upgradedSections = sections.map((section) => {
    const title = section.title.toLowerCase();
    if (title === 'basis for processing') {
      return { ...DEFAULT_POLICY_CONTENT.privacy_sections[7] };
    }
    if (title === 'exercising your rights and contacting pdm') {
      return { ...DEFAULT_POLICY_CONTENT.privacy_sections[11] };
    }
    if (title === 'retention periods') {
      return { ...DEFAULT_POLICY_CONTENT.privacy_sections[10] };
    }
    return section;
  });
  const includedTitles = new Set(
    upgradedSections.map((section) => section.title.toLowerCase())
  );
  const missingSections = DEFAULT_POLICY_CONTENT.privacy_sections.filter(
    (section) => !includedTitles.has(section.title.toLowerCase())
  );
  return [...upgradedSections, ...missingSections]
    .slice(0, 12)
    .map((section) => ({ ...section }));
}

function sanitizePolicyIcon(value, fallback) {
  const icon = safeText(value, 40).toLowerCase();
  return POLICY_ICONS.has(icon) ? icon : fallback;
}

function sanitizePolicyContent(content = {}) {
  const defaults = DEFAULT_POLICY_CONTENT;
  const effectiveDate = normalizeDate(content.effective_date);
  const privacyIntro = safeText(content.privacy_intro, 1600);
  return {
    effective_date:
      effectiveDate === LEGACY_POLICY_EFFECTIVE_DATE
        ? defaults.effective_date
        : effectiveDate || defaults.effective_date,
    privacy_icon: sanitizePolicyIcon(content.privacy_icon, defaults.privacy_icon),
    privacy_intro:
      privacyIntro === LEGACY_PRIVACY_INTRO
        ? defaults.privacy_intro
        : privacyIntro || defaults.privacy_intro,
    privacy_sections: ensureRequiredPrivacySections(
      sanitizePolicySections(content.privacy_sections, defaults.privacy_sections)
    ),
    consent_icon: sanitizePolicyIcon(content.consent_icon, defaults.consent_icon),
    consent_title: safeText(content.consent_title, 160) || defaults.consent_title,
    consent_body: safeText(content.consent_body, 1800) || defaults.consent_body,
    consent_note: safeText(content.consent_note, 1200) || defaults.consent_note,
    terms_icon: sanitizePolicyIcon(content.terms_icon, defaults.terms_icon),
    terms_intro: safeText(content.terms_intro, 1600) || defaults.terms_intro,
    terms_sections: sanitizePolicySections(content.terms_sections, defaults.terms_sections),
  };
}

function isFeaturedNoticePublished(notice = {}) {
  if (!notice.is_visible || !notice.title || !notice.message) return false;
  const today = getManilaDateKey();
  if (notice.start_date && notice.start_date > today) return false;
  if (notice.end_date && notice.end_date < today) return false;
  return true;
}

function getManilaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getFeaturedNoticeNextChangeAt(notice = {}) {
  if (!notice.is_visible || !notice.title || !notice.message) return null;
  const today = getManilaDateKey();

  if (notice.start_date && notice.start_date > today) {
    return new Date(`${notice.start_date}T00:00:00+08:00`).toISOString();
  }

  if ((!notice.start_date || notice.start_date <= today) && notice.end_date && notice.end_date >= today) {
    const endBoundary = new Date(`${notice.end_date}T00:00:00+08:00`).getTime() + 86400000;
    return new Date(endBoundary).toISOString();
  }

  return null;
}

function sortFeaturedNoticesNewestFirst(notices = []) {
  return notices
    .map((notice, index) => ({ notice, index }))
    .sort((a, b) => {
      const createdA = Date.parse(a.notice.created_at || '') || 0;
      const createdB = Date.parse(b.notice.created_at || '') || 0;
      if (createdA !== createdB) return createdB - createdA;

      const startA = Date.parse(a.notice.start_date || '') || 0;
      const startB = Date.parse(b.notice.start_date || '') || 0;
      if (startA !== startB) return startB - startA;

      return a.index - b.index;
    })
    .map(({ notice }) => notice);
}

function getFeaturedNoticesNextChangeAt(notices = []) {
  const boundaries = notices
    .map((notice) => getFeaturedNoticeNextChangeAt(notice))
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);

  if (!boundaries.length) return null;
  return new Date(Math.min(...boundaries)).toISOString();
}

function isMissingTableError(error, tableName) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  const normalizedTable = String(tableName || '').trim().toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    (message.includes('relation') && message.includes(normalizedTable)) ||
    (message.includes('could not find the table') && message.includes(normalizedTable)) ||
    (message.includes('schema cache') && message.includes(normalizedTable))
  );
}

function sanitizeSettings(payload = {}) {
  return {
    institution_name:
      safeText(payload.institution_name, 180) || DEFAULT_GENERAL_SETTINGS.institution_name,
    office_name:
      safeText(payload.office_name, 180) || DEFAULT_GENERAL_SETTINGS.office_name,
    office_email:
      safeText(payload.office_email, 180) || DEFAULT_GENERAL_SETTINGS.office_email,
    office_address:
      safeText(payload.office_address, 220) || DEFAULT_GENERAL_SETTINGS.office_address,
    landline_number:
      safeText(payload.landline_number, 80) || DEFAULT_GENERAL_SETTINGS.landline_number,
    office_hours:
      safeText(payload.office_hours, 120) || DEFAULT_GENERAL_SETTINGS.office_hours,
    about_osfa:
      safeText(payload.about_osfa, 2000) || DEFAULT_GENERAL_SETTINGS.about_osfa,
    eligibility_summary:
      safeText(payload.eligibility_summary, 1200) || DEFAULT_GENERAL_SETTINGS.eligibility_summary,
    landing_content: sanitizeLandingContent(payload.landing_content),
    policy_content: sanitizePolicyContent(payload.policy_content),
    featured_notice: sanitizeFeaturedNotices(payload.featured_notice),
    landing_faqs: sanitizeFaqs(payload.landing_faqs),
    global_deadline:
      normalizeDate(payload.global_deadline) || DEFAULT_GENERAL_SETTINGS.global_deadline,
    applications_open:
      typeof payload.applications_open === 'boolean'
        ? payload.applications_open
        : DEFAULT_GENERAL_SETTINGS.applications_open,
  };
}

function sanitizeFaqItem(item = {}, fallback = {}) {
  const faqId = safeText(item.faq_id, 80) || safeText(fallback.faq_id, 80);
  const question = safeText(item.question, 180);
  const answer = safeText(item.answer, 700);

  return {
    faq_id: faqId,
    question: question || safeText(fallback.question, 180),
    answer: answer || safeText(fallback.answer, 700),
    is_archived: typeof item.is_archived === 'boolean'
      ? item.is_archived
      : Boolean(fallback.is_archived),
  };
}

function sanitizeFaqs(faqs) {
  const source = Array.isArray(faqs) ? faqs : DEFAULT_GENERAL_SETTINGS.landing_faqs;
  const normalized = source
    .slice(0, 20)
    .map((item, index) => {
      const sanitized = sanitizeFaqItem(item, DEFAULT_GENERAL_SETTINGS.landing_faqs[index] || {});
      return {
        faq_id: sanitized.faq_id || `faq-${index + 1}`,
        question: sanitized.question,
        answer: sanitized.answer,
        is_archived: Boolean(sanitized.is_archived),
      };
    })
    .filter((item) => item.question && item.answer);

  return normalized.length ? normalized : DEFAULT_GENERAL_SETTINGS.landing_faqs;
}

function buildFallbackSettings() {
  return {
    ...DEFAULT_GENERAL_SETTINGS,
    landing_content: sanitizeLandingContent(DEFAULT_GENERAL_SETTINGS.landing_content),
    policy_content: sanitizePolicyContent(DEFAULT_GENERAL_SETTINGS.policy_content),
    featured_notice: sanitizeFeaturedNotices(DEFAULT_GENERAL_SETTINGS.featured_notice),
    landing_faqs: sanitizeFaqs(DEFAULT_GENERAL_SETTINGS.landing_faqs),
  };
}

function canManage(actor = {}) {
  return String(actor.role || '').trim().toLowerCase() === 'admin';
}

async function getGeneralSettings() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      'general_settings_id, institution_name, office_name, office_email, office_address, landline_number, office_hours, about_osfa, eligibility_summary, landing_content, policy_content, featured_notice, landing_faqs, global_deadline, applications_open, updated_at, updated_by_user_id'
    )
    .eq('general_settings_id', 1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, TABLE_NAME)) {
      return buildFallbackSettings();
    }
    throw error;
  }

  const source = data || buildFallbackSettings();
  return {
    ...source,
    landing_content: sanitizeLandingContent(source.landing_content),
    policy_content: sanitizePolicyContent(source.policy_content),
    featured_notice: sanitizeFeaturedNotices(source.featured_notice),
    landing_faqs: sanitizeFaqs(source.landing_faqs),
  };
}

async function getPublicGeneralSettings() {
  const settings = await getGeneralSettings();
  const featuredNotices = sanitizeFeaturedNotices(settings.featured_notice);
  const publishedFeaturedNotices = sortFeaturedNoticesNewestFirst(
    featuredNotices.filter(
      (notice) => notice.is_archived !== true && isFeaturedNoticePublished(notice)
    )
  );
  return {
    ...settings,
    featured_notices: publishedFeaturedNotices,
    // Keep the newest item for compatibility with older frontend builds.
    featured_notice: publishedFeaturedNotices[0] || null,
    featured_notice_next_change_at: getFeaturedNoticesNextChangeAt(
      featuredNotices.filter((notice) => notice.is_archived !== true)
    ),
    landing_faqs: sanitizeFaqs(settings.landing_faqs).filter((item) => item.is_archived !== true),
  };
}

async function updateGeneralSettings(payload = {}, actor = {}) {
  if (!canManage(actor)) {
    throw createHttpError(403, 'Access denied for general settings.');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'featured_notice')) {
    validateFeaturedNoticeDateRanges(payload.featured_notice);
  }

  const currentSettings = await getGeneralSettings();
  const sanitized = sanitizeSettings({
    ...currentSettings,
    ...payload,
  });

  const upsertPayload = {
    general_settings_id: 1,
    ...sanitized,
    updated_at: new Date().toISOString(),
    updated_by_user_id: actor.userId || actor.user_id || null,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(upsertPayload, { onConflict: 'general_settings_id' })
    .select(
      'general_settings_id, institution_name, office_name, office_email, office_address, landline_number, office_hours, about_osfa, eligibility_summary, landing_content, policy_content, featured_notice, landing_faqs, global_deadline, applications_open, updated_at, updated_by_user_id'
    )
    .single();

  if (error) {
    if (isMissingTableError(error, TABLE_NAME)) {
      throw createHttpError(
        500,
        'General settings table is missing. Please run the general settings migration first.'
      );
    }
    throw error;
  }

  return data;
}

module.exports = {
  DEFAULT_GENERAL_SETTINGS,
  getGeneralSettings,
  getPublicGeneralSettings,
  updateGeneralSettings,
};
