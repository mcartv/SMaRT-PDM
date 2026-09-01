const crypto = require('crypto');
const db = require('../config/db');
const { mailFrom, transporter } = require('../config/mailer');
const { normalizeEmail, validateEmail } = require('../utils/emailValidation');

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function generateOtp() {
    let code = '';
    for (let index = 0; index < 6; index += 1) {
        code += crypto.randomInt(0, 10).toString();
    }
    return code;
}

function hashOtp(requestId, otp) {
    return crypto
        .createHash('sha256')
        .update(`${requestId}:${otp}:${process.env.JWT_SECRET || 'smart-pdm-email-change'}`)
        .digest('hex');
}

async function sendEmailChangeOtp(email, otp, displayName) {
    if (process.env.SKIP_EMAIL === 'true') {
        console.log('DEV EMAIL CHANGE OTP:', {
            email,
            otp,
            displayName,
            createdAt: new Date().toISOString(),
        });
        return;
    }

    await transporter.sendMail({
        from: mailFrom,
        to: email,
        subject: 'SMaRT-PDM Email Change Verification Code',
        text: `Your SMaRT-PDM email change code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Email change verification</h2>
              <p>Hello ${displayName || 'SMaRT-PDM user'},</p>
              <p>Your 6-digit verification code is:</p>
              <h1 style="letter-spacing: 5px; color: #7C4A2E;">${otp}</h1>
              <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
              <p>If you did not request this change, ignore this email. Your current email will remain unchanged.</p>
            </div>
        `,
    });
}

async function getUser(userId, client = db) {
    const result = await client.query(
        `
        SELECT
          u.user_id,
          u.email,
          u.username,
          st.first_name,
          st.last_name
        FROM users u
        LEFT JOIN students st ON st.user_id = u.user_id
        WHERE u.user_id = $1
        LIMIT 1;
        `,
        [userId]
    );

    return result.rows[0] || null;
}

async function requestEmailChange(userId, body = {}) {
    const newEmail = normalizeEmail(body.newEmail || body.new_email || body.email);

    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const emailValidation = validateEmail(newEmail);
    if (!emailValidation.valid) {
        throw createHttpError(400, emailValidation.error);
    }

    const user = await getUser(userId);
    if (!user) {
        throw createHttpError(404, 'Account not found.');
    }

    if (normalizeEmail(user.email) === newEmail) {
        throw createHttpError(409, 'The new email is the same as your current email.');
    }

    const duplicate = await db.query(
        `SELECT 1 FROM users WHERE LOWER(email) = $1 AND user_id <> $2 LIMIT 1;`,
        [newEmail, userId]
    );

    if (duplicate.rows.length > 0) {
        throw createHttpError(409, 'That email address is already registered to another account.');
    }

    const latest = await db.query(
        `
        SELECT created_at
        FROM email_change_otps
        WHERE user_id = $1
          AND new_email = $2
        ORDER BY created_at DESC
        LIMIT 1;
        `,
        [userId, newEmail]
    );

    if (latest.rows.length > 0) {
        const elapsedSeconds = Math.floor(
            (Date.now() - new Date(latest.rows[0].created_at).getTime()) / 1000
        );
        if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
            throw createHttpError(
                429,
                `Wait ${RESEND_COOLDOWN_SECONDS - elapsedSeconds} second(s) before requesting another code.`
            );
        }
    }

    const requestId = crypto.randomUUID();
    const otp = generateOtp();
    const otpHash = hashOtp(requestId, otp);

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `
            UPDATE email_change_otps
            SET consumed_at = NOW()
            WHERE user_id = $1
              AND consumed_at IS NULL;
            `,
            [userId]
        );

        await client.query(
            `
            INSERT INTO email_change_otps (
              request_id,
              user_id,
              new_email,
              otp_hash,
              expires_at
            )
            VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${OTP_EXPIRY_MINUTES} minutes');
            `,
            [requestId, userId, newEmail, otpHash]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ');

    try {
        await sendEmailChangeOtp(newEmail, otp, displayName);
    } catch (error) {
        await db.query(
            `UPDATE email_change_otps SET consumed_at = NOW() WHERE request_id = $1;`,
            [requestId]
        );
        console.error('EMAIL CHANGE MAIL ERROR:', error);
        throw createHttpError(502, 'The verification email could not be sent. Try again later.');
    }

    return {
        message: 'A verification code was sent to the new email address.',
        requestId,
        newEmail,
        expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
        resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
    };
}

async function verifyEmailChange(userId, body = {}) {
    const requestId = String(body.requestId || body.request_id || '').trim();
    const otp = String(body.otp || '').trim();

    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    if (!requestId) {
        throw createHttpError(400, 'Email change request is required.');
    }

    if (!/^\d{6}$/.test(otp)) {
        throw createHttpError(400, 'Enter the complete 6-digit verification code.');
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const requestResult = await client.query(
            `
            SELECT request_id, user_id, new_email, otp_hash, attempts, expires_at, consumed_at
            FROM email_change_otps
            WHERE request_id = $1
              AND user_id = $2
            FOR UPDATE;
            `,
            [requestId, userId]
        );

        const request = requestResult.rows[0];
        if (!request || request.consumed_at) {
            await client.query('ROLLBACK');
            throw createHttpError(400, 'This verification request is no longer valid.');
        }

        if (new Date(request.expires_at).getTime() <= Date.now()) {
            await client.query(
                `UPDATE email_change_otps SET consumed_at = NOW() WHERE request_id = $1;`,
                [requestId]
            );
            await client.query('COMMIT');
            throw createHttpError(410, 'The verification code has expired. Request a new code.');
        }

        if (Number(request.attempts || 0) >= MAX_ATTEMPTS) {
            await client.query('ROLLBACK');
            throw createHttpError(429, 'Too many incorrect attempts. Request a new code.');
        }

        if (hashOtp(requestId, otp) !== request.otp_hash) {
            const attemptsResult = await client.query(
                `
                UPDATE email_change_otps
                SET attempts = attempts + 1
                WHERE request_id = $1
                RETURNING attempts;
                `,
                [requestId]
            );
            const attempts = Number(attemptsResult.rows[0]?.attempts || 0);
            await client.query('COMMIT');

            if (attempts >= MAX_ATTEMPTS) {
                throw createHttpError(429, 'Too many incorrect attempts. Request a new code.');
            }
            throw createHttpError(400, 'Incorrect verification code.');
        }

        const duplicate = await client.query(
            `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND user_id <> $2 LIMIT 1;`,
            [request.new_email, userId]
        );

        if (duplicate.rows.length > 0) {
            await client.query('ROLLBACK');
            throw createHttpError(409, 'That email address is already registered to another account.');
        }

        await client.query(
            `UPDATE users SET email = $2 WHERE user_id = $1;`,
            [userId, request.new_email]
        );

        await client.query(
            `UPDATE students SET email_address = $2, updated_at = NOW() WHERE user_id = $1;`,
            [userId, request.new_email]
        );

        await client.query(
            `UPDATE email_change_otps SET consumed_at = NOW(), verified_at = NOW() WHERE request_id = $1;`,
            [requestId]
        );

        await client.query('COMMIT');

        return {
            message: 'Your email address was changed successfully.',
            email: request.new_email,
        };
    } catch (error) {
        if (!['400', '410', '429'].includes(String(error.statusCode || ''))) {
            try {
                await client.query('ROLLBACK');
            } catch (_) {
                // Transaction may already be completed.
            }
        }
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    requestEmailChange,
    verifyEmailChange,
};
