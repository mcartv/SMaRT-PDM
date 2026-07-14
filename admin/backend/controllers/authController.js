const crypto = require('crypto');
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { resolveStaffRole } = require('../utils/staffRoles');
const { sendAdminResetOtp } = require('../utils/mailer');
const { resolveAvatarUrl } = require('../services/avatarService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

const ALLOWED_ADMIN_EMAIL = String(
    process.env.ALLOWED_ADMIN_EMAIL || 'smartpdm.system@gmail.com'
).trim().toLowerCase();

const RESET_OTP_TTL_SECONDS = Number(process.env.RESET_OTP_TTL_SECONDS || 60);
const RESET_RESEND_SECONDS = Number(process.env.RESET_RESEND_SECONDS || 60);
const MAX_RESET_ATTEMPTS = Number(process.env.MAX_RESET_ATTEMPTS || 5);
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

async function hasAdminProfilePhotoColumn() {
    const result = await db.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_profiles'
          AND column_name = 'profile_photo_url'
        LIMIT 1
        `
    );

    return result.rows.length > 0;
}

function buildAdminUserQuery(photoEnabled = false) {
    return `
        SELECT
            u.user_id,
            u.email,
            u.username,
            u.role AS user_role,
            u.password_hash,
            u.phone_number,
            a.admin_id,
            a.first_name,
            a.last_name,
            a.department,
            a.position,
            ${photoEnabled ? 'a.profile_photo_url' : 'NULL::text AS profile_photo_url'}
        FROM users u
        LEFT JOIN admin_profiles a ON u.user_id = a.user_id
        WHERE LOWER(u.email) = LOWER($1)
          AND (a.user_id IS NULL OR a.is_archived = false)
        LIMIT 1
    `;
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function buildToken(profile, role) {
    const fallbackName =
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        profile.username ||
        profile.email;

    return jwt.sign(
        {
            sub: profile.user_id,
            userId: profile.user_id,
            user_id: profile.user_id,
            adminId: profile.admin_id || null,
            role,
            name: fallbackName,
            email: profile.email,
            department: profile.department || null,
            position: profile.position || null,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
}

function hashSecret(value) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required for OTP/reset hashing');
    }

    return crypto
        .createHmac('sha256', process.env.JWT_SECRET)
        .update(String(value))
        .digest('hex');
}

function makeOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function makeResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

function validatePasswordPolicy(password) {
    const value = String(password || '');
    const errors = [];

    if (value.length < 10) errors.push('at least 10 characters');
    if (!/[a-z]/.test(value)) errors.push('a lowercase letter');
    if (!/[A-Z]/.test(value)) errors.push('an uppercase letter');
    if (!/\d/.test(value)) errors.push('a number');
    if (!/[^A-Za-z0-9]/.test(value)) errors.push('a special character');

    return errors;
}

async function findStaffByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const photoEnabled = await hasAdminProfilePhotoColumn();

    const result = await db.query(buildAdminUserQuery(photoEnabled), [normalizedEmail]);

    return result.rows[0] || null;
}

async function findAuthorizedAdminForReset(email) {
    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail !== ALLOWED_ADMIN_EMAIL) {
        return null;
    }

    const user = await findStaffByEmail(normalizedEmail);

    if (!user) return null;
    if (!user.admin_id) return null;
    if (normalizeEmail(user.email) !== ALLOWED_ADMIN_EMAIL) return null;

    const resolvedRole = resolveStaffRole(user);

    if (resolvedRole !== 'admin') {
        return null;
    }

    return user;
}

async function loginWithRole(req, res, role) {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    try {
        if (!normalizedEmail || !password) {
            return res.status(400).json({
                message: 'Email and password are required',
            });
        }

        const user = await findStaffByEmail(normalizedEmail);

        if (!user) {
            return res.status(401).json({
                message: 'Invalid credentials or account deactivated',
            });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({
                message: 'Invalid credentials',
            });
        }

        const resolvedRole = resolveStaffRole(user);

        if (role === 'admin') {
            if (
                !resolvedRole ||
                !['admin', 'pd', 'guidance', 'sdo'].includes(resolvedRole)
            ) {
                return res.status(403).json({
                    message: 'This account is not authorized for the admin portal',
                });
            }
        }

        const departmentPortalLabels = {
            pd: 'PD',
            guidance: 'Guidance',
            sdo: 'SDO',
        };

        if (departmentPortalLabels[role] && resolvedRole !== role) {
            return res.status(403).json({
                message: `This account is not authorized for the ${departmentPortalLabels[role]} portal`,
            });
        }

        const tokenRole = departmentPortalLabels[role] ? role : resolvedRole;

        if (!tokenRole) {
            return res.status(403).json({
                message: 'This account is not authorized for this portal',
            });
        }

        const displayName =
            [user.first_name, user.last_name].filter(Boolean).join(' ') ||
            user.username ||
            user.email;

        const token = buildToken(user, tokenRole);

        const portalTitle = departmentPortalLabels[role];
        const avatarUrl = await resolveAvatarUrl(user.profile_photo_url || null);

        return res.status(200).json({
            token,
            message: portalTitle ? `Welcome to the ${portalTitle} panel` : 'Welcome back',
            user: {
                user_id: user.user_id,
                admin_id: user.admin_id || null,
                name: displayName,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                email: user.email,
                phone_number: user.phone_number || '',
                position:
                    user.position ||
                    (tokenRole === 'sdo' ? 'SDO Officer' : 'Staff'),
                department:
                    user.department ||
                    (tokenRole === 'sdo'
                        ? 'Student Disciplinary Office'
                        : null),
                role: tokenRole,
                profile_photo_url: user.profile_photo_url || null,
                avatar_url: avatarUrl,
            },
        });
    } catch (err) {
        console.error(`${role.toUpperCase()} LOGIN ERROR:`, err);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

exports.adminLogin = async (req, res) => loginWithRole(req, res, 'admin');
exports.pdLogin = async (req, res) => loginWithRole(req, res, 'pd');
exports.guidanceLogin = async (req, res) => loginWithRole(req, res, 'guidance');
exports.sdoLogin = async (req, res) => loginWithRole(req, res, 'sdo');

exports.startAdminPasswordReset = async (req, res) => {
    const normalizedEmail = normalizeEmail(req.body?.email);

    const genericResponse = {
        message: 'If this authorized admin account exists, a recovery code has been sent.',
    };

    try {
        if (!normalizedEmail) {
            return res.status(400).json({
                message: 'Email is required',
            });
        }

        const user = await findAuthorizedAdminForReset(normalizedEmail);

        // Prevent account enumeration.
        if (!user) {
            return res.status(200).json(genericResponse);
        }

        const activeOtpResult = await db.query(
            `
            SELECT reset_otp_id, resend_available_at
            FROM password_reset_otps
            WHERE user_id = $1
              AND used_at IS NULL
              AND expires_at > now()
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [user.user_id]
        );

        const activeOtp = activeOtpResult.rows[0];

        if (
            activeOtp?.resend_available_at &&
            new Date(activeOtp.resend_available_at) > new Date()
        ) {
            return res.status(429).json({
                message: 'Please wait before requesting another recovery code.',
            });
        }

        await db.query(
            `
            UPDATE password_reset_otps
            SET used_at = now()
            WHERE user_id = $1
              AND used_at IS NULL
            `,
            [user.user_id]
        );

        const otp = makeOtp();
        const otpHash = hashSecret(otp);

        const insertResult = await db.query(
            `
            INSERT INTO password_reset_otps (
                user_id,
                otp_hash,
                expires_at,
                resend_available_at
            )
            VALUES (
                $1,
                $2,
                now() + ($3 || ' seconds')::interval,
                now() + ($4 || ' seconds')::interval
            )
            RETURNING reset_otp_id
            `,
            [user.user_id, otpHash, RESET_OTP_TTL_SECONDS, RESET_RESEND_SECONDS]
        );

        const resetOtpId = insertResult.rows[0]?.reset_otp_id;

        const resetEmailRecipient =
            process.env.ADMIN_RESET_EMAIL_TO ||
            user.email;

        try {
            await sendAdminResetOtp({
                to: resetEmailRecipient,
                otp,
                expiresSeconds: RESET_OTP_TTL_SECONDS,
            });
        } catch (mailErr) {
            if (resetOtpId) {
                await db.query(
                    `
                    UPDATE password_reset_otps
                    SET used_at = now()
                    WHERE reset_otp_id = $1
                    `,
                    [resetOtpId]
                );
            }

            throw mailErr;
        }

        return res.status(200).json(genericResponse);
    } catch (err) {
        console.error('ADMIN PASSWORD RESET START ERROR:', err);
        return res.status(500).json({
            message: 'Unable to send recovery code right now.',
        });
    }
};

exports.verifyAdminPasswordResetOtp = async (req, res) => {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '').trim();

    try {
        if (!normalizedEmail || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                message: 'A valid 6-digit code is required.',
            });
        }

        const user = await findAuthorizedAdminForReset(normalizedEmail);

        if (!user) {
            return res.status(400).json({
                message: 'Invalid or expired recovery code.',
            });
        }

        const result = await db.query(
            `
            SELECT reset_otp_id, user_id, otp_hash, attempts
            FROM password_reset_otps
            WHERE user_id = $1
              AND used_at IS NULL
              AND expires_at > now()
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [user.user_id]
        );

        const resetRow = result.rows[0];

        if (!resetRow) {
            return res.status(400).json({
                message: 'Invalid or expired recovery code.',
            });
        }

        if (Number(resetRow.attempts) >= MAX_RESET_ATTEMPTS) {
            await db.query(
                `
                UPDATE password_reset_otps
                SET used_at = now()
                WHERE reset_otp_id = $1
                `,
                [resetRow.reset_otp_id]
            );

            return res.status(429).json({
                message: 'Too many invalid attempts. Request a new code.',
            });
        }

        const isOtpMatch = hashSecret(otp) === resetRow.otp_hash;

        if (!isOtpMatch) {
            const nextAttempts = Number(resetRow.attempts) + 1;

            await db.query(
                `
                UPDATE password_reset_otps
                SET attempts = attempts + 1,
                    used_at = CASE WHEN $2 >= $3 THEN now() ELSE used_at END
                WHERE reset_otp_id = $1
                `,
                [resetRow.reset_otp_id, nextAttempts, MAX_RESET_ATTEMPTS]
            );

            return res.status(400).json({
                message: 'Invalid or expired recovery code.',
            });
        }

        const resetToken = makeResetToken();
        const resetTokenHash = hashSecret(resetToken);

        await db.query(
            `
            UPDATE password_reset_otps
            SET verified_at = now(),
                reset_token_hash = $2
            WHERE reset_otp_id = $1
            `,
            [resetRow.reset_otp_id, resetTokenHash]
        );

        return res.status(200).json({
            message: 'Recovery code verified.',
            resetToken,
        });
    } catch (err) {
        console.error('ADMIN PASSWORD RESET VERIFY ERROR:', err);
        return res.status(500).json({
            message: 'Unable to verify recovery code right now.',
        });
    }
};

exports.resetAdminPassword = async (req, res) => {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const resetToken = String(req.body?.resetToken || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    try {
        if (!normalizedEmail || !resetToken) {
            return res.status(400).json({
                message: 'Reset session is missing or expired.',
            });
        }

        const policyErrors = validatePasswordPolicy(newPassword);

        if (policyErrors.length) {
            return res.status(400).json({
                message: `Password must contain ${policyErrors.join(', ')}.`,
            });
        }

        const user = await findAuthorizedAdminForReset(normalizedEmail);

        if (!user) {
            return res.status(400).json({
                message: 'Reset session is invalid or expired.',
            });
        }

        const resetTokenHash = hashSecret(resetToken);

        const result = await db.query(
            `
            SELECT
                r.reset_otp_id,
                r.user_id,
                u.password_hash
            FROM password_reset_otps r
            JOIN users u ON u.user_id = r.user_id
            WHERE r.user_id = $1
              AND r.reset_token_hash = $2
              AND r.verified_at IS NOT NULL
              AND r.used_at IS NULL
              AND r.expires_at > now()
            ORDER BY r.created_at DESC
            LIMIT 1
            `,
            [user.user_id, resetTokenHash]
        );

        const resetRow = result.rows[0];

        if (!resetRow) {
            return res.status(400).json({
                message: 'Reset session is invalid or expired.',
            });
        }

        const isSameAsOld = await bcrypt.compare(
            newPassword,
            resetRow.password_hash
        );

        if (isSameAsOld) {
            return res.status(400).json({
                message: 'New password must be different from the old password.',
            });
        }

        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        const client = await db.connect();

        try {
            await client.query('BEGIN');

            await client.query(
                `
                UPDATE users
                SET password_hash = $1
                WHERE user_id = $2
                `,
                [passwordHash, resetRow.user_id]
            );

            await client.query(
                `
                UPDATE password_reset_otps
                SET used_at = now()
                WHERE reset_otp_id = $1
                `,
                [resetRow.reset_otp_id]
            );

            await client.query(
                `
                UPDATE password_reset_otps
                SET used_at = now()
                WHERE user_id = $1
                  AND used_at IS NULL
                `,
                [resetRow.user_id]
            );

            await client.query('COMMIT');
        } catch (transactionErr) {
            await client.query('ROLLBACK');
            throw transactionErr;
        } finally {
            client.release();
        }

        return res.status(200).json({
            message: 'Password reset successful.',
        });
    } catch (err) {
        console.error('ADMIN PASSWORD RESET FINALIZE ERROR:', err);
        return res.status(500).json({
            message: 'Unable to reset password right now.',
        });
    }
};


/* Realtime + audit wrapper
 * This adds audit trail coverage to controller actions that previously had realtime only,
 * or no centralized audit. It skips read-only handlers.
 */
(function attachRealtimeAuditWrapper() {
    const MODULE_NAME = 'Authentication';
    const EVENT_BASE = 'auth';

    const readOnlyPrefixes = ['get', 'fetch', 'list', 'download', 'export'];

    function isReadOnlyAction(name) {
        return readOnlyPrefixes.some((prefix) => String(name).startsWith(prefix));
    }

    function resolveActionName(name) {
        const raw = String(name || '').toLowerCase();

        if (raw.includes('archive')) return 'archived';
        if (raw.includes('restore')) return 'restored';
        if (raw.includes('approve')) return 'approved';
        if (raw.includes('reject')) return 'rejected';
        if (raw.includes('disqualify')) return 'disqualified';
        if (raw.includes('create') || raw.includes('upload')) return 'created';
        return 'updated';
    }

    function getActorUserId(req) {
        return req.user?.user_id || req.user?.userId || req.user?.id || null;
    }

    function getEntityId(req, body) {
        return (
            req.params?.id ||
            req.params?.applicationId ||
            req.params?.studentId ||
            req.params?.scholarId ||
            req.params?.reviewId ||
            req.params?.ticketId ||
            req.params?.settingId ||
            body?.data?.id ||
            body?.data?.application_id ||
            body?.data?.student_id ||
            body?.id ||
            body?.application_id ||
            body?.student_id ||
            null
        );
    }

    function safeAudit(req, functionName, responseBody) {
        try {
            const action = resolveActionName(functionName);
            const entityId = getEntityId(req, responseBody);
            const actionTaken = `${action.toUpperCase()}_${EVENT_BASE.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;

            if (typeof auditLogService?.logAudit === 'function') {
                auditLogService.logAudit({
                    req,
                    userId: getActorUserId(req),
                    actionTaken,
                    module: MODULE_NAME,
                    entityType: EVENT_BASE,
                    entityId: entityId ? String(entityId) : null,
                    description: `${MODULE_NAME}: ${functionName} completed successfully.`,
                    metadata: {
                        action,
                        params: req.params || {},
                        query: req.query || {},
                        body_keys: Object.keys(req.body || {}),
                    },
                }).catch((error) => {
                    console.error(`${MODULE_NAME} AUDIT WRAPPER ERROR:`, error.message);
                });
            }

            const io = req.app?.get?.('io');
            if (io && socketEvents?.emitEvent) {
                socketEvents.emitEvent(io, `${EVENT_BASE}:${action}`, {
                    module: MODULE_NAME,
                    action,
                    entity_id: entityId ? String(entityId) : null,
                    source: functionName,
                    updated_at: new Date().toISOString(),
                });

                socketEvents.emitEvent(io, 'audit:created', {
                    module: MODULE_NAME,
                    action_taken: actionTaken,
                    entity_type: EVENT_BASE,
                    entity_id: entityId ? String(entityId) : null,
                    created_at: new Date().toISOString(),
                });
            }
        } catch (error) {
            console.error(`${MODULE_NAME} REALTIME/AUDIT WRAPPER ERROR:`, error.message);
        }
    }

    Object.entries(module.exports).forEach(([functionName, handler]) => {
        if (typeof handler !== 'function' || isReadOnlyAction(functionName)) return;
        if (handler.__realtimeAuditWrapped) return;

        const wrapped = async function realtimeAuditWrappedHandler(req, res, next) {
            let captured = false;
            const originalJson = res.json.bind(res);

            res.json = function patchedJson(body) {
                if (!captured && res.statusCode >= 200 && res.statusCode < 400) {
                    captured = true;
                    safeAudit(req, functionName, body || {});
                }

                return originalJson(body);
            };

            return handler(req, res, next);
        };

        wrapped.__realtimeAuditWrapped = true;
        module.exports[functionName] = wrapped;
    });
})();
