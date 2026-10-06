// SMaRT-PDM: staff Roles — staff Roles (admin backend); supports backend application behavior.
function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

// includesAny: handles includes any for the staff Roles flow.
function includesAny(haystack, terms) {
    return terms.some((term) => haystack.includes(term));
}

// resolveStaffRole: resolves resolve staff role for the staff Roles flow.
function resolveStaffRole(profile = {}) {
    const explicitUserRole = safeText(profile.user_role || profile.role).toLowerCase();
    const department = safeText(profile.department).toLowerCase();
    const position = safeText(profile.position).toLowerCase();

    if (explicitUserRole === 'ro_coordinator' || includesAny(position, ['ro coordinator', 'return of obligation coordinator', 'ro personnel-in-charge'])) {
        return 'ro_coordinator';
    }
    if (explicitUserRole === 'pd' || includesAny(department, ['program department', 'pd']) || includesAny(position, ['program director', 'program chair', 'department chair', 'pd reviewer'])) {
        return 'pd';
    }
    if (explicitUserRole === 'guidance' || includesAny(department, ['guidance']) || includesAny(position, ['guidance'])) {
        return 'guidance';
    }
    if (explicitUserRole === 'sdo' || includesAny(department, ['disciplinary', 'student discipline', 'sdo']) || includesAny(position, ['disciplinary', 'student discipline', 'sdo'])) {
        return 'sdo';
    }
    if (explicitUserRole === 'admin') return 'admin';

    return profile.admin_id ? 'admin' : explicitUserRole || null;
}

module.exports = {
    resolveStaffRole,
};
