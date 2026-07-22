const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const DEFAULT_SESSION_HOURS = Number(
    process.env.ADMIN_SESSION_HOURS || 12
);
const REMEMBER_SESSION_DAYS = Number(
    process.env.ADMIN_REMEMBER_SESSION_DAYS || 30
);
const STALE_PAGE_SECONDS = Number(
    process.env.ADMIN_SESSION_STALE_PAGE_SECONDS || 300
);

const ADMIN_ROLE = 'admin';
const IS_PRODUCTION = String(process.env.NODE_ENV || '')
    .trim()
    .toLowerCase() === 'production';
const SESSION_SCOPE = String(
    process.env.ADMIN_SESSION_SCOPE || (IS_PRODUCTION ? 'production' : 'development')
)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .slice(0, 30) || (IS_PRODUCTION ? 'production' : 'development');
const MAX_ACTIVE_DEVICES = Math.max(
    1,
    Number(
        process.env.ADMIN_MAX_ACTIVE_DEVICES || (IS_PRODUCTION ? 1 : 2)
    ) || 1
);

class AdminSessionError extends Error {
    constructor(message, { statusCode = 401, code = 'ADMIN_SESSION_ERROR' } = {}) {
        super(message);
        this.name = 'AdminSessionError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

function normalizeRole(value) {
    return String(value || '').trim().toLowerCase();
}

function assertSessionScope(value) {
    const tokenScope = String(value || '').trim().toLowerCase();

    if (!tokenScope || tokenScope !== SESSION_SCOPE) {
        throw new AdminSessionError(
            'This Admin session belongs to a different environment. Please sign in again.',
            {
                statusCode: 401,
                code: 'ADMIN_SESSION_SCOPE_MISMATCH',
            }
        );
    }
}

async function lockUserScope(client, userId) {
    await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [`${userId}:${SESSION_SCOPE}`]
    );
}

function requireJwtSecret() {
    const secret = String(process.env.JWT_SECRET || '').trim();

    if (!secret) {
        throw new Error('JWT_SECRET is required');
    }

    return secret;
}

function hashToken(token) {
    return crypto
        .createHash('sha256')
        .update(String(token || ''))
        .digest('hex');
}

function safeEqualHex(left, right) {
    const leftBuffer = Buffer.from(String(left || ''), 'utf8');
    const rightBuffer = Buffer.from(String(right || ''), 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getBearerToken(req) {
    const header = String(req.headers?.authorization || '').trim();

    if (!header.toLowerCase().startsWith('bearer ')) {
        return '';
    }

    return header.slice(7).trim();
}

function getRequestIp(req) {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '')
        .split(',')[0]
        .trim();

    return forwarded || req.ip || req.socket?.remoteAddress || null;
}

function sanitizeClientId(value, fieldName) {
    const normalized = String(value || '').trim();

    if (!normalized) {
        throw new AdminSessionError(`${fieldName} is required.`, {
            statusCode: 400,
            code: `MISSING_${fieldName.toUpperCase()}`,
        });
    }

    if (normalized.length > 200) {
        throw new AdminSessionError(`${fieldName} is invalid.`, {
            statusCode: 400,
            code: `INVALID_${fieldName.toUpperCase()}`,
        });
    }

    return normalized;
}

function sessionTtlSeconds(stayLoggedIn) {
    if (stayLoggedIn) {
        return Math.max(1, REMEMBER_SESSION_DAYS) * 24 * 60 * 60;
    }

    return Math.max(1, DEFAULT_SESSION_HOURS) * 60 * 60;
}

async function cleanupStalePages(client, userId) {
    await client.query(
        `
        UPDATE admin_session_pages p
        SET is_active = false,
            released_at = COALESCE(p.released_at, now())
        FROM admin_sessions s
        WHERE p.session_id = s.session_id
          AND s.user_id = $1
          AND s.session_scope = $2
          AND p.is_active = true
          AND p.last_seen_at < now() - ($3 * interval '1 second')
        `,
        [userId, SESSION_SCOPE, STALE_PAGE_SECONDS]
    );

    // Page/tab activity must not control whether the remembered Admin login
    // remains valid. A session stays active until explicit logout or expiry.
    await client.query(
        `
        UPDATE admin_sessions s
        SET is_active = false,
            released_at = COALESCE(s.released_at, now())
        WHERE s.user_id = $1
          AND s.session_scope = $2
          AND s.is_active = true
          AND (
              s.expires_at <= now()
              OR s.logged_out_at IS NOT NULL
          )
        `,
        [userId, SESSION_SCOPE]
    );
}

async function createAdminSession({
    user,
    role,
    displayName,
    stayLoggedIn,
    deviceId,
    pageId,
    req,
}) {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole !== ADMIN_ROLE) {
        throw new AdminSessionError('Only the Admin account uses managed sessions.', {
            statusCode: 403,
            code: 'NOT_ADMIN_ACCOUNT',
        });
    }

    const cleanDeviceId = sanitizeClientId(deviceId, 'deviceId');
    const cleanPageId = sanitizeClientId(pageId, 'pageId');
    const ttlSeconds = sessionTtlSeconds(Boolean(stayLoggedIn));
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const token = jwt.sign(
        {
            sub: user.user_id,
            userId: user.user_id,
            user_id: user.user_id,
            adminId: user.admin_id || null,
            role: ADMIN_ROLE,
            name: displayName,
            email: user.email,
            department: user.department || null,
            position: user.position || null,
            sid: sessionId,
            session_id: sessionId,
            session_scope: SESSION_SCOPE,
        },
        requireJwtSecret(),
        { expiresIn: ttlSeconds }
    );

    const tokenHash = hashToken(token);
    const client = await db.connect();

    try {
        await client.query('BEGIN');
        await lockUserScope(client, user.user_id);
        await cleanupStalePages(client, user.user_id);

        const activeResult = await client.query(
            `
            SELECT session_id, device_id
            FROM admin_sessions
            WHERE user_id = $1
              AND session_scope = $2
              AND is_active = true
              AND logged_out_at IS NULL
              AND expires_at > now()
            ORDER BY created_at DESC
            FOR UPDATE
            `,
            [user.user_id, SESSION_SCOPE]
        );

        const sameDeviceSessions = activeResult.rows.filter(
            (session) => session.device_id === cleanDeviceId
        );

        if (sameDeviceSessions.length > 0) {
            const sessionIds = sameDeviceSessions.map((session) => session.session_id);

            await client.query(
                `
                UPDATE admin_sessions
                SET is_active = false,
                    released_at = now(),
                    logged_out_at = now()
                WHERE session_id = ANY($1::uuid[])
                `,
                [sessionIds]
            );

            await client.query(
                `
                UPDATE admin_session_pages
                SET is_active = false,
                    released_at = now()
                WHERE session_id = ANY($1::uuid[])
                  AND is_active = true
                `,
                [sessionIds]
            );
        }

        const activeOtherDevices = new Set(
            activeResult.rows
                .filter((session) => session.device_id !== cleanDeviceId)
                .map((session) => session.device_id)
        );

        if (activeOtherDevices.size >= MAX_ACTIVE_DEVICES) {
            throw new AdminSessionError(
                `This Admin account already has ${MAX_ACTIVE_DEVICES} active ${
                    MAX_ACTIVE_DEVICES === 1 ? 'device' : 'devices'
                } in the ${SESSION_SCOPE} environment. Log out an active device before signing in here.`,
                {
                    statusCode: 409,
                    code: 'ADMIN_ACTIVE_DEVICE_LIMIT_REACHED',
                }
            );
        }

        await client.query(
            `
            INSERT INTO admin_sessions (
                session_id,
                user_id,
                device_id,
                token_hash,
                stay_logged_in,
                is_active,
                ip_address,
                user_agent,
                expires_at,
                session_scope
            )
            VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9)
            `,
            [
                sessionId,
                user.user_id,
                cleanDeviceId,
                tokenHash,
                Boolean(stayLoggedIn),
                getRequestIp(req),
                String(req.headers?.['user-agent'] || '').slice(0, 1000) || null,
                expiresAt,
                SESSION_SCOPE,
            ]
        );

        await client.query(
            `
            INSERT INTO admin_session_pages (
                session_id,
                page_id,
                is_active,
                last_seen_at
            )
            VALUES ($1, $2, true, now())
            `,
            [sessionId, cleanPageId]
        );

        await client.query('COMMIT');

        return {
            token,
            session: {
                session_id: sessionId,
                stay_logged_in: Boolean(stayLoggedIn),
                expires_at: expiresAt.toISOString(),
                session_scope: SESSION_SCOPE,
                max_active_devices: MAX_ACTIVE_DEVICES,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');

        if (error?.code === '23505') {
            throw new AdminSessionError(
                'An active Admin session already exists for this device.',
                {
                    statusCode: 409,
                    code: 'ADMIN_ACTIVE_SESSION_CONFLICT',
                }
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

function verifyAdminToken(rawToken) {
    if (!rawToken) {
        throw new AdminSessionError('Admin session token is missing.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_TOKEN_MISSING',
        });
    }

    let decoded;

    try {
        decoded = jwt.verify(rawToken, requireJwtSecret());
    } catch (error) {
        throw new AdminSessionError('Admin session has expired or is invalid.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_INVALID',
        });
    }

    if (normalizeRole(decoded.role) !== ADMIN_ROLE || !decoded.sid) {
        throw new AdminSessionError('Admin session is invalid.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_INVALID',
        });
    }

    assertSessionScope(decoded.session_scope);
    return decoded;
}

async function loadSessionForUpdate(client, decoded, rawToken) {
    const result = await client.query(
        `
        SELECT *
        FROM admin_sessions
        WHERE session_id = $1
          AND user_id = $2
          AND session_scope = $3
        LIMIT 1
        FOR UPDATE
        `,
        [
            decoded.sid,
            decoded.user_id || decoded.userId || decoded.sub,
            SESSION_SCOPE,
        ]
    );

    const session = result.rows[0];

    if (!session) {
        throw new AdminSessionError('Admin session was not found.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_NOT_FOUND',
        });
    }

    if (!safeEqualHex(session.token_hash, hashToken(rawToken))) {
        throw new AdminSessionError('Admin session token does not match.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_TOKEN_MISMATCH',
        });
    }

    if (session.logged_out_at) {
        throw new AdminSessionError('Admin session has already been logged out.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_LOGGED_OUT',
        });
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
        throw new AdminSessionError('Admin session has expired.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_EXPIRED',
        });
    }

    return session;
}

async function resumeAdminSession({ rawToken, deviceId, pageId }) {
    const decoded = verifyAdminToken(rawToken);
    const cleanDeviceId = sanitizeClientId(deviceId, 'deviceId');
    const cleanPageId = sanitizeClientId(pageId, 'pageId');
    const userId = decoded.user_id || decoded.userId || decoded.sub;
    const client = await db.connect();

    try {
        await client.query('BEGIN');
        await lockUserScope(client, userId);
        await cleanupStalePages(client, userId);

        const session = await loadSessionForUpdate(client, decoded, rawToken);

        if (session.device_id !== cleanDeviceId) {
            throw new AdminSessionError(
                'This saved Admin session belongs to a different device.',
                {
                    statusCode: 401,
                    code: 'ADMIN_SESSION_DEVICE_MISMATCH',
                }
            );
        }

        const otherActiveResult = await client.query(
            `
            SELECT COUNT(DISTINCT device_id)::integer AS active_devices
            FROM admin_sessions
            WHERE user_id = $1
              AND session_scope = $2
              AND session_id <> $3
              AND device_id <> $4
              AND is_active = true
              AND logged_out_at IS NULL
              AND expires_at > now()
            `,
            [userId, SESSION_SCOPE, session.session_id, cleanDeviceId]
        );

        const otherActiveDevices = Number(
            otherActiveResult.rows[0]?.active_devices || 0
        );

        if (otherActiveDevices >= MAX_ACTIVE_DEVICES) {
            throw new AdminSessionError(
                `The ${SESSION_SCOPE} Admin device limit has been reached.`,
                {
                    statusCode: 409,
                    code: 'ADMIN_ACTIVE_DEVICE_LIMIT_REACHED',
                }
            );
        }

        await client.query(
            `
            UPDATE admin_sessions
            SET is_active = true,
                released_at = NULL,
                last_seen_at = now()
            WHERE session_id = $1
              AND session_scope = $2
            `,
            [session.session_id, SESSION_SCOPE]
        );

        await client.query(
            `
            INSERT INTO admin_session_pages (
                session_id,
                page_id,
                is_active,
                last_seen_at,
                released_at
            )
            VALUES ($1, $2, true, now(), NULL)
            ON CONFLICT (session_id, page_id)
            DO UPDATE SET
                is_active = true,
                last_seen_at = now(),
                released_at = NULL
            `,
            [session.session_id, cleanPageId]
        );

        await client.query('COMMIT');

        return {
            decoded,
            session: {
                session_id: session.session_id,
                stay_logged_in: session.stay_logged_in,
                expires_at: session.expires_at,
                session_scope: SESSION_SCOPE,
                max_active_devices: MAX_ACTIVE_DEVICES,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');

        if (error?.code === '23505') {
            throw new AdminSessionError(
                'An active Admin session already exists for this device.',
                {
                    statusCode: 409,
                    code: 'ADMIN_ACTIVE_SESSION_CONFLICT',
                }
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

async function assertActiveAdminSession({ decoded, rawToken }) {
    assertSessionScope(decoded.session_scope);

    const result = await db.query(
        `
        SELECT
            session_id,
            user_id,
            token_hash,
            is_active,
            expires_at,
            logged_out_at,
            session_scope
        FROM admin_sessions
        WHERE session_id = $1
          AND user_id = $2
          AND session_scope = $3
        LIMIT 1
        `,
        [
            decoded.sid,
            decoded.user_id || decoded.userId || decoded.sub,
            SESSION_SCOPE,
        ]
    );

    const session = result.rows[0];

    if (!session || !session.is_active || session.logged_out_at) {
        throw new AdminSessionError('Admin session is no longer active.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_INACTIVE',
        });
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
        throw new AdminSessionError('Admin session has expired.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_EXPIRED',
        });
    }

    if (!safeEqualHex(session.token_hash, hashToken(rawToken))) {
        throw new AdminSessionError('Admin session token does not match.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_TOKEN_MISMATCH',
        });
    }

    return session;
}

async function heartbeatAdminSession({ decoded, pageId }) {
    const cleanPageId = sanitizeClientId(pageId, 'pageId');
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const pageResult = await client.query(
            `
            UPDATE admin_session_pages
            SET is_active = true,
                last_seen_at = now(),
                released_at = NULL
            WHERE session_id = $1
              AND page_id = $2
            RETURNING session_id
            `,
            [decoded.sid, cleanPageId]
        );

        if (!pageResult.rows[0]) {
            await client.query(
                `
                INSERT INTO admin_session_pages (
                    session_id,
                    page_id,
                    is_active,
                    last_seen_at
                )
                VALUES ($1, $2, true, now())
                `,
                [decoded.sid, cleanPageId]
            );
        }

        await client.query(
            `
            UPDATE admin_sessions
            SET last_seen_at = now(),
                is_active = true,
                released_at = NULL
            WHERE session_id = $1
              AND session_scope = $2
              AND logged_out_at IS NULL
              AND expires_at > now()
            `,
            [decoded.sid, SESSION_SCOPE]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function releaseAdminPage({ decoded, pageId }) {
    const cleanPageId = sanitizeClientId(pageId, 'pageId');
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        await client.query(
            `
            UPDATE admin_session_pages
            SET is_active = false,
                released_at = now(),
                last_seen_at = now()
            WHERE session_id = $1
              AND page_id = $2
            `,
            [decoded.sid, cleanPageId]
        );

        // Releasing a browser page only updates page-level tracking.
        // It must not invalidate the 30-day Admin session. Explicit logout
        // is handled separately by logoutAdminSession().

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function logoutAdminSession({ decoded }) {
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        await client.query(
            `
            UPDATE admin_session_pages
            SET is_active = false,
                released_at = now(),
                last_seen_at = now()
            WHERE session_id = $1
              AND is_active = true
            `,
            [decoded.sid]
        );

        await client.query(
            `
            UPDATE admin_sessions
            SET is_active = false,
                released_at = now(),
                logged_out_at = now(),
                last_seen_at = now()
            WHERE session_id = $1
            `,
            [decoded.sid]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}


async function listRecentAdminSessions({
    userId,
    currentSessionId = null,
    limit = 8,
} = {}) {
    if (!userId) {
        throw new AdminSessionError('Unauthorized request.', {
            statusCode: 401,
            code: 'ADMIN_SESSION_USER_MISSING',
        });
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);

    await db.query(
        `
        UPDATE admin_sessions
        SET is_active = false,
            released_at = COALESCE(released_at, now())
        WHERE user_id = $1
          AND session_scope = $2
          AND is_active = true
          AND (
              expires_at <= now()
              OR logged_out_at IS NOT NULL
          )
        `,
        [userId, SESSION_SCOPE]
    );

    const result = await db.query(
        `
        SELECT
            s.session_id,
            s.device_id,
            s.ip_address,
            s.user_agent,
            s.stay_logged_in,
            s.is_active,
            s.created_at,
            s.last_seen_at,
            s.expires_at,
            s.released_at,
            s.logged_out_at,
            s.session_scope,
            EXISTS (
                SELECT 1
                FROM admin_session_pages p
                WHERE p.session_id = s.session_id
                  AND p.is_active = true
                  AND p.last_seen_at >= now() - ($4 * interval '1 second')
            ) AS has_recent_active_page
        FROM admin_sessions s
        WHERE s.user_id = $1
          AND s.session_scope = $2
        ORDER BY COALESCE(s.last_seen_at, s.created_at) DESC
        LIMIT $3
        `,
        [userId, SESSION_SCOPE, safeLimit, STALE_PAGE_SECONDS]
    );

    return result.rows.map((row) => {
        const expired = new Date(row.expires_at).getTime() <= Date.now();
        const isCurrent =
            currentSessionId &&
            String(row.session_id) === String(currentSessionId);

        let status = 'Ended';

        if (isCurrent && row.is_active && !row.logged_out_at && !expired) {
            status = 'Current';
        } else if (row.is_active && !row.logged_out_at && !expired) {
            status = row.has_recent_active_page ? 'Active' : 'Remembered';
        } else if (expired) {
            status = 'Expired';
        } else if (row.logged_out_at) {
            status = 'Logged out';
        }

        return {
            session_id: row.session_id,
            device_id: row.device_id,
            ip_address: row.ip_address,
            user_agent: row.user_agent,
            stay_logged_in: row.stay_logged_in === true,
            is_active:
                row.is_active === true &&
                !row.logged_out_at &&
                !expired,
            is_current: Boolean(isCurrent),
            status,
            created_at: row.created_at,
            last_seen_at: row.last_seen_at,
            expires_at: row.expires_at,
            released_at: row.released_at,
            logged_out_at: row.logged_out_at,
            session_scope: row.session_scope,
        };
    });
}

async function revokeAllAdminSessionsForUser(client, userId) {
    await client.query(
        `
        UPDATE admin_session_pages p
        SET is_active = false,
            released_at = now(),
            last_seen_at = now()
        FROM admin_sessions s
        WHERE p.session_id = s.session_id
          AND s.user_id = $1
          AND p.is_active = true
        `,
        [userId]
    );

    await client.query(
        `
        UPDATE admin_sessions
        SET is_active = false,
            released_at = now(),
            logged_out_at = now(),
            last_seen_at = now()
        WHERE user_id = $1
          AND logged_out_at IS NULL
        `,
        [userId]
    );
}

module.exports = {
    AdminSessionError,
    createAdminSession,
    verifyAdminToken,
    resumeAdminSession,
    assertActiveAdminSession,
    heartbeatAdminSession,
    releaseAdminPage,
    logoutAdminSession,
    revokeAllAdminSessionsForUser,
    listRecentAdminSessions,
    getBearerToken,
    sessionConfig: Object.freeze({
        scope: SESSION_SCOPE,
        maxActiveDevices: MAX_ACTIVE_DEVICES,
    }),
};

