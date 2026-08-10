const db = require('../config/db');

const TOKEN_VERSION_FALLBACK = 1;

// The current schema stores PD, Guidance, RO Coordinator, and Admin accounts
// under users.role = 'Admin'. SDO uses users.role = 'SDO'. The portal role is
// carried in the JWT and is revoked with users.token_version when Admin changes
// that primary role through Account Maintenance.
const ROLE_BACKING = Object.freeze({
    admin: 'admin',
    pd: 'admin',
    guidance: 'admin',
    ro_coordinator: 'admin',
    sdo: 'sdo',
});

class StaffSessionError extends Error {
    constructor(message, { statusCode = 401, code = 'STAFF_SESSION_ERROR' } = {}) {
        super(message);
        this.name = 'StaffSessionError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

function normalizeRole(value) {
    return String(value || '').trim().toLowerCase();
}

function resolveUserId(decoded = {}) {
    return String(
        decoded.user_id || decoded.userId || decoded.sub || ''
    ).trim();
}

function normalizeTokenVersion(value, fallback = TOKEN_VERSION_FALLBACK) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        return fallback;
    }

    return parsed;
}

function getDecodedTokenVersion(decoded = {}) {
    // Backward compatibility: tokens issued before this hardening patch do not
    // contain token_version. Existing production accounts start at version 1,
    // so those tokens remain usable until the account is archived/restored or
    // its primary role changes.
    return normalizeTokenVersion(
        decoded.token_version ?? decoded.tokenVersion,
        TOKEN_VERSION_FALLBACK
    );
}

function expectedBackingRole(tokenRole) {
    return ROLE_BACKING[normalizeRole(tokenRole)] || null;
}

async function loadCurrentStaffAccount(userId) {
    const result = await db.query(
        `
        SELECT
            u.user_id,
            u.role AS user_role,
            COALESCE(u.token_version, 1)::integer AS token_version,
            a.admin_id,
            a.first_name,
            a.last_name,
            a.department,
            a.position,
            COALESCE(a.is_archived, false) AS is_archived
        FROM users u
        INNER JOIN admin_profiles a
            ON a.user_id = u.user_id
        WHERE u.user_id = $1
        LIMIT 1
        `,
        [userId]
    );

    return result.rows[0] || null;
}

async function assertCurrentStaffSession({ decoded = {} } = {}) {
    const userId = resolveUserId(decoded);
    const tokenRole = normalizeRole(decoded.role);
    const backingRole = expectedBackingRole(tokenRole);

    if (!userId || !backingRole) {
        throw new StaffSessionError('This session is invalid. Please sign in again.', {
            code: 'STAFF_SESSION_INVALID',
        });
    }

    const account = await loadCurrentStaffAccount(userId);

    if (!account) {
        throw new StaffSessionError('This account is no longer available. Please sign in again.', {
            code: 'STAFF_ACCOUNT_NOT_FOUND',
        });
    }

    if (account.is_archived === true) {
        throw new StaffSessionError(
            'This account has been deactivated. Contact an administrator.',
            {
                code: 'ACCOUNT_DEACTIVATED',
            }
        );
    }

    const currentBackingRole = normalizeRole(account.user_role);

    if (currentBackingRole !== backingRole) {
        throw new StaffSessionError(
            'Your account access has changed. Please sign in again.',
            {
                code: 'SESSION_ROLE_CHANGED',
            }
        );
    }

    const tokenVersion = getDecodedTokenVersion(decoded);
    const currentTokenVersion = normalizeTokenVersion(account.token_version);

    if (tokenVersion !== currentTokenVersion) {
        throw new StaffSessionError(
            'Your session is no longer active. Please sign in again.',
            {
                code: 'SESSION_REVOKED',
            }
        );
    }

    return {
        ...account,
        role: tokenRole,
        token_version: currentTokenVersion,
    };
}

module.exports = {
    ROLE_BACKING,
    StaffSessionError,
    assertCurrentStaffSession,
    getDecodedTokenVersion,
    loadCurrentStaffAccount,
    normalizeRole,
    normalizeTokenVersion,
    resolveUserId,
};
