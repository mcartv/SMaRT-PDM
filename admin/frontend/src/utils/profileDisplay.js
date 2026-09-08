// Presentation only: never use these labels for authorization or save payloads.
const PROFILE_DISPLAY = {
  sdo: {
    accountRole: 'Student Discipline Office Administrator',
    position: 'Student Discipline Office Coordinator',
    organizationalUnit: 'Student Discipline Office',
  },
  guidance: {
    accountRole: 'Guidance and Counseling Administrator',
    position: 'Psychologist',
    organizationalUnit: 'Guidance and Counseling Office',
  },
  pd: { accountRole: 'Program Director Administrator' },
  ro_coordinator: { accountRole: 'RO Coordinator', position: 'RO Coordinator' },
};

const SYSTEM_LABELS = {
  pending_sdo: 'Pending SDO',
  pending_guidance: 'Pending Guidance',
  pending_pd: 'Pending Program Director',
  ro_coordinator: 'RO Coordinator',
  sdo: 'SDO',
  pd: 'Program Director',
};

export function formatSystemLabel(value) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return SYSTEM_LABELS[text.toLowerCase()]
    || (text.includes('_')
      ? text.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
      : text);
}

export function getProfileDisplay(profile = {}, fallbackRole = '') {
  const rawRole = String(profile.role || fallbackRole).trim().toLowerCase();
  const role = {
    'sdo user': 'sdo',
    'guidance officer': 'guidance',
    'program director': 'pd',
    'ro coordinator': 'ro_coordinator',
  }[rawRole] || rawRole;
  const labels = PROFILE_DISPLAY[role] || {};
  // Registrar is a position in the existing account model, not a new role.
  if (String(profile.position || '').trim().toLowerCase() === 'registrar') {
    return {
      accountRole: 'Student Personnel Service Administrator',
      position: 'Registrar',
      organizationalUnit: "Registrar's Office",
    };
  }
  const courses = Array.isArray(profile.assigned_courses)
    ? [...new Set(profile.assigned_courses.map((course) => course.course_name || course.course_code).filter(Boolean))].join(', ')
    : '';
  return {
    accountRole: labels.accountRole || formatSystemLabel(profile.role || fallbackRole).replace(/^admin$/i, 'Admin'),
    position: labels.position || (role === 'pd'
      ? `Program Director${courses ? ` – ${courses}` : ''}`
      : formatSystemLabel(profile.position)),
    organizationalUnit: labels.organizationalUnit || (role === 'pd' && courses
      ? courses
      : formatSystemLabel(profile.department)),
  };
}
