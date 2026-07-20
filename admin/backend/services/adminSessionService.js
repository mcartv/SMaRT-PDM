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
          AND p.is_active = true
          AND p.last_seen_at < now() - ($2 * interval '1 second')
        `,
        [userId, STALE_PAGE_SECONDS]
    );

    // Page/tab activity must not control whether the remembered Admin login
    // remains valid. A session stays active until explicit logout or expiry.
    await client.query(
        `
        UPDATE admin_sessions s
        SET is_active = false,
            released_at = COALESCE(s.released_at, now())
        WHERE s.user_id = $1
          AND s.is_active = true
          AND (
              s.expires_at <= now()
              OR s.logged_out_at IS NOT NULL
          )
        `,
        [userId]
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
        },
        requireJwtSecret(),
        { expiresIn: ttlSeconds }
    );

    const tokenHash = hashToken(token);
    const client = await db.connect();

    try {
        await client.query('BEGIN');
        await cleanupStalePages(client, user.user_id);

        const activeResult = await client.query(
            `
            SELECT session_id, device_id
            FROM admin_sessions
            WHERE user_id = $1
              AND is_active = true
              AND logged_out_at IS NULL
              AND expires_at > now()
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
            `,
            [user.user_id]
        );

        const activeSession = activeResult.rows[0];

        if (activeSession && activeSession.device_id !== cleanDeviceId) {
            throw new AdminSessionError(
                'This Admin account is currently active on another device. Log out or close the active Admin session before signing in here.',
                {
                    statusCode: 409,
                    code: 'ADMIN_ACTIVE_ON_ANOTHER_DEVICE',
                }
            );
        }

        if (activeSession) {
            await client.query(
                `
                UPDATE admin_sessions
                SET is_active = false,
                    released_at = now(),
                    logged_out_at = now()
                WHERE session_id = $1
                `,
                [activeSession.session_id]
            );

            await client.query(
                `
                UPDATE admin_session_pages
                SET is_active = false,
                    released_at = now()
                WHERE session_id = $1
                  AND is_active = true
                `,
                [activeSession.session_id]
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
                expires_at
            )
            VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8)
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
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');

        if (error?.code === '23505') {
            throw new AdminSessionError(
                'This Admin account is currently active on another device.',
                {
                    statusCode: 409,
                    code: 'ADMIN_ACTIVE_ON_ANOTHER_DEVICE',
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

    return decoded;
}

async function loadSessionForUpdate(client, decoded, rawToken) {
    const result = await client.query(
        `
        SELECT *
        FROM admin_sessions
        WHERE session_id = $1
          AND user_id = $2
        LIMIT 1
        FOR UPDATE
        `,
        [decoded.sid, decoded.user_id || decoded.userId || decoded.sub]
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
            SELECT session_id
            FROM admin_sessions
            WHERE user_id = $1
              AND session_id <> $2
              AND is_active = true
              AND logged_out_at IS NULL
              AND expires_at > now()
            LIMIT 1
            FOR UPDATE
            `,
            [userId, session.session_id]
        );

        if (otherActiveResult.rows[0]) {
            throw new AdminSessionError(
                'This Admin account is currently active on another device.',
                {
                    statusCode: 409,
                    code: 'ADMIN_ACTIVE_ON_ANOTHER_DEVICE',
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
            `,
            [session.session_id]
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
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');

        if (error?.code === '23505') {
            throw new AdminSessionError(
                'This Admin account is currently active on another device.',
                {
                    statusCode: 409,
                    code: 'ADMIN_ACTIVE_ON_ANOTHER_DEVICE',
                }
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

async function assertActiveAdminSession({ decoded, rawToken }) {
    const result = await db.query(
        `
        SELECT session_id, user_id, token_hash, is_active, expires_at, logged_out_at
        FROM admin_sessions
        WHERE session_id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [decoded.sid, decoded.user_id || decoded.userId || decoded.sub]
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
              AND logged_out_at IS NULL
              AND expires_at > now()
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
    getBearerToken,
};
