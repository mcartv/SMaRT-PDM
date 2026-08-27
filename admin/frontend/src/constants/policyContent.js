export const POLICY_ICON_OPTIONS = [
  { value: 'shield-check', label: 'Shield' },
  { value: 'file-text', label: 'Document' },
  { value: 'database', label: 'Database' },
  { value: 'lock-keyhole', label: 'Lock' },
  { value: 'scale', label: 'Scale' },
  { value: 'landmark', label: 'Institution' },
];

const LEGACY_POLICY_EFFECTIVE_DATE = '2026-07-23';
const LEGACY_PRIVACY_INTRO =
  'This notice explains how Pambayang Dalubhasaan ng Marilao, through the Office for Scholarship and Financial Assistance, handles personal information in SMaRT-PDM. It should be read together with scholarship-specific notices and consent statements shown during application.';

export const DEFAULT_POLICY_CONTENT = {
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


function normalizeUserTerminology(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\bstaff\b/gi, 'authorized users');
}

export function mergePolicyContent(content) {
  const source = content && typeof content === 'object' ? content : {};
  const normalizedSource = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      typeof value === 'string' ? normalizeUserTerminology(value) : value,
    ])
  );
  const normalizeSections = (items, defaults) => {
    if (!Array.isArray(items)) return defaults;
    const normalized = items
      .map((item) => ({
        title: normalizeUserTerminology(String(item?.title || '').trim()),
        body: normalizeUserTerminology(String(item?.body || '').trim()),
      }))
      .filter((item) => item.title && item.body)
      .slice(0, 12);
    return normalized.length ? normalized : defaults;
  };
  const ensureRequiredPrivacySections = (sections) => {
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
  };
  return {
    ...DEFAULT_POLICY_CONTENT,
    ...normalizedSource,
    effective_date:
      normalizedSource.effective_date === LEGACY_POLICY_EFFECTIVE_DATE
        ? DEFAULT_POLICY_CONTENT.effective_date
        : normalizedSource.effective_date || DEFAULT_POLICY_CONTENT.effective_date,
    privacy_intro:
      normalizedSource.privacy_intro === LEGACY_PRIVACY_INTRO
        ? DEFAULT_POLICY_CONTENT.privacy_intro
        : normalizedSource.privacy_intro || DEFAULT_POLICY_CONTENT.privacy_intro,
    privacy_sections: ensureRequiredPrivacySections(
      normalizeSections(
        normalizedSource.privacy_sections,
        DEFAULT_POLICY_CONTENT.privacy_sections
      )
    ),
    terms_sections: normalizeSections(
      normalizedSource.terms_sections,
      DEFAULT_POLICY_CONTENT.terms_sections
    ),
  };
}
