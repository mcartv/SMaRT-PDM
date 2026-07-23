export const POLICY_ICON_OPTIONS = [
  { value: 'shield-check', label: 'Shield' },
  { value: 'file-text', label: 'Document' },
  { value: 'database', label: 'Database' },
  { value: 'lock-keyhole', label: 'Lock' },
  { value: 'scale', label: 'Scale' },
  { value: 'landmark', label: 'Institution' },
];

export const DEFAULT_POLICY_CONTENT = {
  effective_date: '2026-07-23',
  privacy_icon: 'shield-check',
  privacy_intro:
    'This notice explains how Pambayang Dalubhasaan ng Marilao, through the Office for Scholarship and Financial Assistance, handles personal information in SMaRT-PDM. It should be read together with scholarship-specific notices and consent statements shown during application.',
  privacy_sections: [
    { title: 'Information covered by this notice', body: 'SMaRT-PDM may process identity and contact details, enrollment and academic information, scholarship application responses, uploaded supporting documents, endorsement and review records, account activity, and technical information needed to operate and secure the service.' },
    { title: 'Why information is processed', body: 'Information is used to receive and evaluate scholarship applications, verify eligibility and requirements, coordinate authorized office reviews, communicate updates, administer scholar obligations and benefits, maintain records, prevent misuse, and comply with applicable institutional and legal responsibilities.' },
    { title: 'Access and disclosure', body: 'Access is limited to authorized PDM and OSFA personnel and designated reviewing offices according to their responsibilities. Information may also be disclosed when required by law, regulation, audit, or a lawful request. SMaRT-PDM does not present student records as public information.' },
    { title: 'Retention and protection', body: 'Records are retained only for as long as needed for scholarship administration, institutional recordkeeping, dispute resolution, audit, and applicable legal requirements. PDM applies administrative and technical safeguards, but no electronic system can guarantee absolute security.' },
    { title: 'Your privacy rights', body: 'Subject to applicable rules, data subjects may request access or correction, raise a concern about processing, and ask about retention or disposal. Some records may need to be preserved when required for an active application, scholarship administration, audit, or legal obligation.' },
  ],
  consent_icon: 'database',
  consent_title: 'Data Processing Consent',
  consent_body:
    'Where consent is the appropriate basis for processing, applicants will be asked to confirm a specific consent statement before submitting information. Consent should be informed and freely given, and may be withdrawn for future consent-based processing by contacting OSFA. Withdrawal does not invalidate processing already performed and may affect services that cannot be completed without the required information.',
  consent_note:
    'Certain scholarship and institutional records may still be processed or retained when another lawful or institutional basis applies. Contact OSFA using the details published on the landing page for questions or requests.',
  terms_icon: 'file-text',
  terms_intro:
    'These terms govern access to and use of SMaRT-PDM. They are intended to protect applicants, scholars, staff, institutional records, and the integrity of scholarship processes.',
  terms_sections: [
    { title: 'Purpose and acceptance', body: 'SMaRT-PDM supports scholarship applications, document review, endorsement, communication, monitoring, and related OSFA services. By using the platform, you agree to use it only for legitimate PDM scholarship activities and to follow these terms and applicable institutional policies.' },
    { title: 'Account responsibility', body: 'Users must provide accurate information, protect their credentials, and promptly report suspected unauthorized access. Actions performed through an account may be treated as actions of the registered user unless reported and verified otherwise.' },
    { title: 'Acceptable use', body: 'Users must not submit false or misleading records, impersonate another person, access data without authorization, disrupt the service, bypass security controls, upload malicious material, or use information obtained through the platform for an unrelated purpose.' },
    { title: 'Applications and decisions', body: 'Submission through SMaRT-PDM does not guarantee eligibility, endorsement, approval, payment, or continued scholarship status. Decisions remain subject to the rules of each scholarship program, document verification, available funding, and authorized institutional review.' },
    { title: 'Availability and changes', body: 'PDM may maintain, update, suspend, or restrict the platform when reasonably necessary. Notices, schedules, features, and these terms may be updated to reflect operational, institutional, or legal changes. Material updates should be communicated through official channels.' },
    { title: 'Official communications', body: 'Users should verify important scholarship information through SMaRT-PDM, OSFA, or PDM’s official communication channels. PDM is not responsible for instructions circulated through unofficial accounts or unverified third parties.' },
  ],
};

export function mergePolicyContent(content) {
  const source = content && typeof content === 'object' ? content : {};
  const normalizeSections = (items, defaults) => {
    if (!Array.isArray(items)) return defaults;
    const normalized = items
      .map((item) => ({
        title: String(item?.title || '').trim(),
        body: String(item?.body || '').trim(),
      }))
      .filter((item) => item.title && item.body)
      .slice(0, 12);
    return normalized.length ? normalized : defaults;
  };
  return {
    ...DEFAULT_POLICY_CONTENT,
    ...source,
    privacy_sections: normalizeSections(
      source.privacy_sections,
      DEFAULT_POLICY_CONTENT.privacy_sections
    ),
    terms_sections: normalizeSections(
      source.terms_sections,
      DEFAULT_POLICY_CONTENT.terms_sections
    ),
  };
}
