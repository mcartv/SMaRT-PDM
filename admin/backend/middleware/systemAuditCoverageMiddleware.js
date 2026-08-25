'use strict';

const auditLogService = require('../services/auditLogService');

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const QUIET_PATHS = [
    /^\/api\/audit-logs(?:\/|$)/i,
    /^\/api\/internal\/realtime(?:\/|$)/i,
    /^\/api\/personal-tools(?:\/|$)/i,
    // Messaging already has purpose-built logging for meaningful message actions.
    /^\/api\/messages(?:\/|$)/i,
    // Read-state changes are UI bookkeeping, not operational System Logs.
    /^\/api\/notifications\/(?:read-all|seen)(?:\/|$)/i,
    /^\/api\/notifications\/[^/]+\/(?:read|seen)(?:\/|$)/i,
    // Session keep-alive/page lifecycle calls must not flood System Logs.
    /^\/api\/auth\/session\/(?:resume|heartbeat|release|release-beacon)(?:\/|$)/i,
];

const MODULE_RULES = [
    [/^\/api\/selections(?:\/|$)/i, { name: 'Application Selection', key: 'APPLICATION_SELECTION', entityType: 'selection' }],
    [/^\/api\/applications(?:\/|$)/i, { name: 'Application Review', key: 'APPLICATION', entityType: 'application' }],
    [/^\/api\/endorsement-slips(?:\/|$)/i, { name: 'Endorsement Slips', key: 'ENDORSEMENT', entityType: 'endorsement' }],
    [/^\/api\/scholars(?:\/|$)/i, { name: 'Scholars', key: 'SCHOLAR', entityType: 'scholar' }],
    [/^\/api\/renewals(?:\/|$)/i, { name: 'Renewals', key: 'RENEWAL', entityType: 'renewal' }],
    [/^\/api\/payouts(?:\/|$)/i, { name: 'Payout Management', key: 'PAYOUT', entityType: 'payout' }],
    [/^\/api\/ro-coordinator(?:\/|$)/i, { name: 'RO Coordinator', key: 'RO_COORDINATOR', entityType: 'ro' }],
    [/^\/api\/ro(?:\/|$)/i, { name: 'Return of Obligation', key: 'RO', entityType: 'ro' }],
    [/^\/api\/program-openings(?:\/|$)/i, { name: 'Scholarship Openings', key: 'SCHOLARSHIP_OPENING', entityType: 'opening' }],
    [/^\/api\/announcements(?:\/|$)/i, { name: 'Announcements', key: 'ANNOUNCEMENT', entityType: 'announcement' }],
    [/^\/api\/admin\/profile-photos(?:\/|$)/i, { name: 'Profile Photos', key: 'PROFILE_PHOTO', entityType: 'profile_photo' }],
    [/^\/api\/student-registry(?:\/|$)/i, { name: 'Student Registry', key: 'STUDENT_REGISTRY', entityType: 'student_registry' }],
    [/^\/api\/accounts(?:\/|$)/i, { name: 'Accounts', key: 'ACCOUNT', entityType: 'account' }],
    [/^\/api\/scholarship-program(?:\/|$)/i, { name: 'Scholarship Programs', key: 'SCHOLARSHIP_PROGRAM', entityType: 'scholarship_program' }],
    [/^\/api\/benefactors(?:\/|$)/i, { name: 'Benefactors', key: 'BENEFACTOR', entityType: 'benefactor' }],
    [/^\/api\/academic-years(?:\/|$)/i, { name: 'Academic Years', key: 'ACADEMIC_YEAR', entityType: 'academic_year' }],
    [/^\/api\/courses(?:\/|$)/i, { name: 'Courses', key: 'COURSE', entityType: 'course' }],
    [/^\/api\/theme-settings(?:\/|$)/i, { name: 'Maintenance - Theme Settings', key: 'THEME_SETTING', entityType: 'theme_setting' }],
    [/^\/api\/general-settings(?:\/|$)/i, { name: 'Maintenance - General Settings', key: 'GENERAL_SETTING', entityType: 'general_setting' }],
    [/^\/api\/ro-settings(?:\/|$)/i, { name: 'Maintenance - RO Settings', key: 'RO_SETTING', entityType: 'ro_setting' }],
    [/^\/api\/ocr(?:\/|$)/i, { name: 'OCR / Document Verification', key: 'OCR', entityType: 'ocr' }],
    [/^\/api\/pi(?:\/|$)/i, { name: 'OCR / Scanner', key: 'SCANNER', entityType: 'scanner' }],
    [/^\/api\/reports(?:\/|$)/i, { name: 'Reports', key: 'REPORT', entityType: 'report' }],
    [/^\/api\/auth(?:\/|$)/i, { name: 'Authentication', key: 'AUTH', entityType: 'auth' }],
];

const ACTION_RULES = [
    [/request[-_/]?reupload|reupload/i, 'REQUEST_REUPLOAD'],
    [/manual[-_/]?adjust|adjustment/i, 'MANUAL_ADJUST'],
    [/approve/i, 'APPROVE'],
    [/reject/i, 'REJECT'],
    [/disqualif/i, 'DISQUALIFY'],
    [/activate/i, 'ACTIVATE'],
    [/qualif/i, 'QUALIFY'],
    [/finaliz/i, 'FINALIZE'],
    [/promote/i, 'PROMOTE'],
    [/archive/i, 'ARCHIVE'],
    [/restore/i, 'RESTORE'],
    [/verify/i, 'VERIFY'],
    [/cancel/i, 'CANCEL'],
    [/clear/i, 'CLEAR'],
    [/close/i, 'CLOSE'],
    [/submit/i, 'SUBMIT'],
    [/upload/i, 'UPLOAD'],
    [/import/i, 'IMPORT'],
    [/publish/i, 'PUBLISH'],
    [/assign/i, 'ASSIGN'],
    [/reset/i, 'RESET'],
    [/toggle/i, 'TOGGLE'],
    [/decision|decide/i, 'DECIDE'],
    [/status/i, 'UPDATE_STATUS'],
];

const ENTITY_PARAM_KEYS = [
    'applicationId',
    'openingId',
    'studentId',
    'scholarId',
    'renewalId',
    'payoutId',
    'batchId',
    'requestId',
    'placementId',
    'accountId',
    'programId',
    'courseId',
    'academicYearId',
    'announcementId',
    'photoId',
    'reviewId',
    'settingId',
    'id',
];

function requestPath(req) {
    return String(req?.originalUrl || req?.url || '')
        .split('?')[0]
        .replace(/\\/g, '/')
        .replace(/\/{2,}/g, '/');
}

function isQuietPath(pathname) {
    return QUIET_PATHS.some((pattern) => pattern.test(pathname));
}

function resolveModule(pathname) {
    const match = MODULE_RULES.find(([pattern]) => pattern.test(pathname));
    return match?.[1] || { name: 'System', key: 'SYSTEM', entityType: 'system' };
}

function resolveAction(method, pathname, moduleKey) {
    const match = ACTION_RULES.find(([pattern]) => pattern.test(pathname));
    const verb = match?.[1] || (
        method === 'POST'
            ? 'CREATE'
            : method === 'DELETE'
                ? 'DELETE'
                : 'UPDATE'
    );

    return `${verb}_${moduleKey}`;
}

function resolveEntityId(req, pathname) {
    for (const key of ENTITY_PARAM_KEYS) {
        const value = req?.params?.[key];
        if (value !== undefined && value !== null && String(value).trim()) {
            return String(value).trim();
        }
    }

    const tokens = pathname.split('/').filter(Boolean).reverse();
    return (
        tokens.find((value) =>
            /^\d+$/.test(value) ||
            /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value) ||
            /^PDM-/i.test(value)
        ) || null
    );
}

function humanizeAction(actionTaken) {
    return String(actionTaken || '')
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function attachSystemAuditCoverage(req, res) {
    if (req.__systemAuditCoverageAttached === true) return;

    const method = String(req.method || '').toUpperCase();
    const pathname = requestPath(req);

    if (!MUTATION_METHODS.has(method) || isQuietPath(pathname)) {
        return;
    }

    req.__systemAuditCoverageAttached = true;

    res.once('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 400) return;
        if (req.__systemAuditLogged === true || req.__systemAuditPending === true) return;

        const moduleInfo = resolveModule(pathname);
        const actionTaken = resolveAction(method, pathname, moduleInfo.key);
        const entityId = resolveEntityId(req, pathname);

        setImmediate(() => {
            if (req.__systemAuditLogged === true || req.__systemAuditPending === true) return;

            auditLogService.logAudit({
                req,
                actionTaken,
                module: moduleInfo.name,
                entityType: moduleInfo.entityType,
                entityId,
                description: `${humanizeAction(actionTaken)} completed successfully.`,
                metadata: {
                    method,
                    path: pathname,
                    status_code: res.statusCode,
                    audit_source: 'protected_mutation_fallback',
                },
            }).catch((error) => {
                console.error('SYSTEM AUDIT COVERAGE ERROR:', error.message);
            });
        });
    });
}

module.exports = {
    attachSystemAuditCoverage,
    // Exported only for regression tests.
    _internals: {
        isQuietPath,
        requestPath,
        resolveAction,
        resolveEntityId,
        resolveModule,
    },
};
