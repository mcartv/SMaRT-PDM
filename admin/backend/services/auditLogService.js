const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getJwtSecret() {
    const secret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;

    if (!secret) {
        throw createHttpError(500, 'JWT secret is not configured.');
    }

    return secret;
}

function getActorUserId(req) {
    return req?.user?.user_id || req?.user?.userId || null;
}

async function verifyAuditPassword({ userId, password }) {
    if (!userId) {
        throw createHttpError(401, 'Unauthorized request.');
    }

    if (!password) {
        throw createHttpError(400, 'Password is required.');
    }

    const result = await db.query(
        `
        select user_id, email, role, password_hash
        from users
        where user_id = $1
        limit 1
        `,
        [userId]
    );

    const user = result.rows[0];

    if (!user) {
        throw createHttpError(404, 'Account not found.');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
        throw createHttpError(401, 'Incorrect password.');
    }

    const auditAccessToken = jwt.sign(
        {
            user_id: user.user_id,
            email: user.email,
            role: user.role,
            scope: 'audit_logs',
        },
        getJwtSecret(),
        {
            expiresIn: '10m',
        }
    );

    return {
        audit_access_token: auditAccessToken,
        expires_in: 600,
    };
}

function verifyAuditAccessToken(token, currentUserId) {
    if (!token) {
        throw createHttpError(401, 'Audit access password is required.');
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());

        if (decoded.scope !== 'audit_logs') {
            throw createHttpError(403, 'Invalid audit access token.');
        }

        if (String(decoded.user_id) !== String(currentUserId)) {
            throw createHttpError(403, 'Audit access token does not match current user.');
        }

        return decoded;
    } catch (err) {
        if (err.statusCode) throw err;

        throw createHttpError(401, 'Audit access expired. Please enter your password again.');
    }
}

async function listAuditLogs({ limit = 100, offset = 0, search = '', module = '' } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const q = String(search || '').trim();
    const moduleFilter = String(module || '').trim();

    const values = [];
    const where = [];

    if (q) {
        values.push(`%${q.toLowerCase()}%`);
        where.push(`
            (
                lower(coalesce(a.action_taken, '')) like $${values.length}
                or lower(coalesce(a.description, '')) like $${values.length}
                or lower(coalesce(a.module, '')) like $${values.length}
                or lower(coalesce(a.actor_email, u.email, '')) like $${values.length}
                or lower(coalesce(a.actor_role, u.role::text, '')) like $${values.length}
            )
        `);
    }

    if (moduleFilter && moduleFilter !== 'all') {
        values.push(moduleFilter);
        where.push(`a.module = $${values.length}`);
    }

    const whereSql = where.length ? `where ${where.join(' and ')}` : '';

    const countResult = await db.query(
        `
        select count(*)::int as total
        from audit_logs a
        left join users u on u.user_id = a.user_id
        ${whereSql}
        `,
        values
    );

    values.push(safeLimit);
    values.push(safeOffset);

    const result = await db.query(
        `
        select
            a.log_id,
            a.user_id,
            coalesce(a.actor_email, u.email) as actor_email,
            coalesce(a.actor_role, u.role::text) as actor_role,
            a.module,
            a.action_taken,
            a.entity_type,
            a.entity_id,
            a.description,
            a.metadata,
            a.ip_address,
            a.user_agent,
            a.timestamp
        from audit_logs a
        left join users u on u.user_id = a.user_id
        ${whereSql}
        order by a.timestamp desc
        limit $${values.length - 1}
        offset $${values.length}
        `,
        values
    );

    return {
        total: countResult.rows[0]?.total || 0,
        limit: safeLimit,
        offset: safeOffset,
        items: result.rows,
    };
}

async function logAudit({
    req = null,
    userId = null,
    actionTaken,
    module = null,
    entityType = null,
    entityId = null,
    description = null,
    metadata = {},
}) {
    try {
        const actorUserId = userId || getActorUserId(req);
        const actorRole = req?.user?.role || null;
        const actorEmail = req?.user?.email || null;
        const ipAddress =
            req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
            req?.ip ||
            null;
        const userAgent = req?.get?.('user-agent') || null;

        await db.query(
            `
            insert into audit_logs (
                user_id,
                action_taken,
                ip_address,
                module,
                entity_type,
                entity_id,
                description,
                metadata,
                actor_role,
                actor_email,
                user_agent
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
            `,
            [
                actorUserId,
                actionTaken,
                ipAddress,
                module,
                entityType,
                entityId ? String(entityId) : null,
                description,
                JSON.stringify(metadata || {}),
                actorRole,
                actorEmail,
                userAgent,
            ]
        );
    } catch (err) {
        console.error('AUDIT LOG ERROR:', err.message);
    }
}

module.exports = {
    listAuditLogs,
    logAudit,
    verifyAuditAccessToken,
    verifyAuditPassword,
};