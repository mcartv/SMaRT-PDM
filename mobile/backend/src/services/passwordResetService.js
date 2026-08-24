const crypto = require('crypto');
const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');
const { mailFrom, transporter } = require('../config/mailer');

const OTP_TABLE = 'password_reset_otps';
const ACTIVITY_TABLE = 'password_reset_activity_log';
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 60;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 3;
const GENERIC_SUCCESS_MESSAGE =
    'If an account exists, password reset instructions have been sent.';

const STUDENT_ID_REGEX = /^PDM-\d{4}-\d{6}$/;

const COMMON_PASSWORDS = new Set([
    '12345678',
    '123456789',
    '1234567890',
    'password',
    'password1',
    'password123',
    'qwerty123',
    'admin123',
    'welcome123',
    'iloveyou',
    'abc12345',
    'letmein123',
    'p@ssw0rd',
]);

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function normalizeStudentNumber(value = '') {
    return String(value || '').trim().toUpperCase();
}

function isValidStudentId(value = '') {
    return STUDENT_ID_REGEX.test(normalizeStudentNumber(value));
}

function isValidOtp(value = '') {
    return /^\d{6}$/.test(String(value || '').trim());
}

function generateOtp() {
    let code = '';
    for (let index = 0; index < OTP_LENGTH; index += 1) {
        code += crypto.randomInt(0, 10).toString();
    }
    return code;
}

function hashOtp(resetOtpId, otp) {
    return crypto
        .createHash('sha256')
        .update(`${resetOtpId}:${otp}:${process.env.JWT_SECRET || 'smart-pdm-recovery'}`)
        .digest('hex');
}

function extractRequestMeta(req = {}) {
    const forwarded = req.headers?.['x-forwarded-for'];
    const ipAddress = forwarded
        ? String(forwarded).split(',')[0].trim()
        : req.ip || req.connection?.remoteAddress || null;

    return {
        ipAddress: ipAddress || null,
        userAgent: req.headers?.['user-agent'] || null,
    };
}

async function logActivity({
    userId = null,
    studentId = null,
    eventType,
    ipAddress = null,
    userAgent = null,
}) {
    const { error } = await supabase.from(ACTIVITY_TABLE).insert([
        {
            user_id: userId,
            student_id: studentId,
            event_type: eventType,
            ip_address: ipAddress,
            user_agent: userAgent,
        },
    ]);

    if (error) {
        console.error('PASSWORD RESET ACTIVITY LOG ERROR:', error.message);
    }
}

async function sendPasswordResetEmail(email, otp, displayName) {
    if (process.env.SKIP_EMAIL === 'true') {
        console.log('DEV PASSWORD RESET OTP:', {
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
        subject: 'SMaRT-PDM Password Reset Code',
        text: `Your SMaRT-PDM password reset code is ${otp}. It expires in ${OTP_EXPIRY_SECONDS} seconds. If you did not request this, ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Password reset for ${displayName || 'your SMaRT-PDM account'}</h2>
              <p>Your 6-digit password reset code is:</p>
              <h1 style="letter-spacing: 5px; color: #7C4A2E;">${otp}</h1>
              <p>Enter this code in the SMaRT-PDM app to reset your password. The code expires in ${OTP_EXPIRY_SECONDS} seconds.</p>
              <p>If you did not request this, you can safely ignore this email.</p>
            </div>
        `,
    });
}

function ensureResetPasswordPolicy(password = '') {
    const safePassword = String(password || '');

    if (!safePassword) {
        throw createHttpError(400, 'Password is required.');
    }

    if (safePassword.length < 8) {
        throw createHttpError(400, 'Password must be at least 8 characters.');
    }

    if (!/[a-z]/.test(safePassword)) {
        throw createHttpError(400, 'Password must contain at least one lowercase letter.');
    }

    if (!/[A-Z]/.test(safePassword)) {
        throw createHttpError(400, 'Password must contain at least one uppercase letter.');
    }

    if (!/\d/.test(safePassword)) {
        throw createHttpError(400, 'Password must contain at least one number.');
    }

    if (COMMON_PASSWORDS.has(safePassword.toLowerCase())) {
        throw createHttpError(
            400,
            'Password may be compromised. Password is in a list of passwords commonly used on other websites.'
        );
    }
}

async function findVerifiedUserByStudentId(studentId) {
    const { data, error } = await supabase
        .from('users')
        .select('user_id, email, username, token_version')
        .eq('username', studentId)
        .eq('is_otp_verified', true)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, 'Database error during password reset lookup.');
    }

    return data || null;
}

async function resolveDisplayName(userId) {
    const { data, error } = await supabase
        .from('students')
        .select('first_name, last_name')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    const name = [data.first_name, data.last_name]
        .filter((value) => String(value || '').trim().length > 0)
        .join(' ')
        .trim();

    return name || null;
}

async function countRecentRequests(userId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count, error } = await supabase
        .from(OTP_TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneHourAgo);

    if (error) {
        throw createHttpError(500, 'Database error during rate limit check.');
    }

    return count || 0;
}

async function invalidateOpenOtps(userId) {
    const now = new Date().toISOString();

    const { error } = await supabase
        .from(OTP_TABLE)
        .update({ used_at: now })
        .eq('user_id', userId)
        .is('used_at', null);

    if (error) {
        throw createHttpError(500, 'Failed to invalidate existing reset codes.');
    }
}

async function fetchLatestOpenOtp(userId) {
    const { data, error } = await supabase
        .from(OTP_TABLE)
        .select('*')
        .eq('user_id', userId)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw createHttpError(500, 'Database error during OTP lookup.');
    }

    return data || null;
}

async function markOtpUsed(resetOtpId) {
    const now = new Date().toISOString();

    const { error } = await supabase
        .from(OTP_TABLE)
        .update({ used_at: now })
        .eq('reset_otp_id', resetOtpId);

    if (error) {
        throw createHttpError(500, 'Failed to finalize password reset.');
    }
}

async function forgotPassword(body = {}, req = {}) {
    const rawStudentId = body.studentId || body.student_id || '';
    const studentId = normalizeStudentNumber(rawStudentId);
    const { ipAddress, userAgent } = extractRequestMeta(req);

    if (!studentId) {
        throw createHttpError(400, 'Student ID is required.');
    }

    if (!isValidStudentId(studentId)) {
        throw createHttpError(
            400,
            'Please enter a valid Student ID (e.g., PDM-2024-000123)'
        );
    }

    const user = await findVerifiedUserByStudentId(studentId);

    if (!user) {
        await logActivity({
            studentId,
            eventType: 'request',
            ipAddress,
            userAgent,
        });

        return { message: GENERIC_SUCCESS_MESSAGE };
    }

    const latestOtp = await fetchLatestOpenOtp(user.user_id);
    if (
        latestOtp &&
        new Date(latestOtp.resend_available_at).getTime() > Date.now()
    ) {
        throw createHttpError(429, 'Please wait before requesting another code.');
    }

    const recentRequests = await countRecentRequests(user.user_id);
    if (recentRequests >= MAX_REQUESTS_PER_HOUR) {
        await logActivity({
            userId: user.user_id,
            studentId,
            eventType: 'rate_limited',
            ipAddress,
            userAgent,
        });

        return { message: GENERIC_SUCCESS_MESSAGE };
    }

    await invalidateOpenOtps(user.user_id);

    const resetOtpId = crypto.randomUUID();
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString();
    const resendAvailableAt = new Date(
        Date.now() + RESEND_COOLDOWN_SECONDS * 1000
    ).toISOString();

    const { error: insertError } = await supabase.from(OTP_TABLE).insert([
        {
            reset_otp_id: resetOtpId,
            user_id: user.user_id,
            otp_hash: hashOtp(resetOtpId, otp),
            expires_at: expiresAt,
            resend_available_at: resendAvailableAt,
        },
    ]);

    if (insertError) {
        throw createHttpError(500, 'Failed to create password reset code.');
    }

    const displayName = (await resolveDisplayName(user.user_id)) || studentId;

    try {
        await sendPasswordResetEmail(user.email, otp, displayName);
    } catch (emailError) {
        await markOtpUsed(resetOtpId);
        throw emailError;
    }

    await logActivity({
        userId: user.user_id,
        studentId,
        eventType: 'request',
        ipAddress,
        userAgent,
    });

    return { message: GENERIC_SUCCESS_MESSAGE };
}

async function verifyResetOtp(body = {}, req = {}) {
    const rawStudentId = body.studentId || body.student_id || '';
    const studentId = normalizeStudentNumber(rawStudentId);
    const otp = String(body.otp || '').trim();
    const { ipAddress, userAgent } = extractRequestMeta(req);

    if (!isValidStudentId(studentId)) {
        throw createHttpError(
            400,
            'Please enter a valid Student ID (e.g., PDM-2024-000123)'
        );
    }

    if (!isValidOtp(otp)) {
        throw createHttpError(400, 'OTP must be exactly 6 digits.');
    }

    const user = await findVerifiedUserByStudentId(studentId);
    const otpRecord = user ? await fetchLatestOpenOtp(user.user_id) : null;

    if (!user || !otpRecord) {
        throw createHttpError(400, 'Invalid or expired verification code.');
    }

    if (new Date(otpRecord.expires_at).getTime() <= Date.now()) {
        await markOtpUsed(otpRecord.reset_otp_id);
        await logActivity({
            userId: user.user_id,
            studentId,
            eventType: 'verify_fail',
            ipAddress,
            userAgent,
        });
        throw createHttpError(400, 'Invalid or expired verification code.');
    }

    if ((otpRecord.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
        await markOtpUsed(otpRecord.reset_otp_id);
        await logActivity({
            userId: user.user_id,
            studentId,
            eventType: 'locked',
            ipAddress,
            userAgent,
        });
        throw createHttpError(
            400,
            'Too many failed attempts. Please request a new code.'
        );
    }

    const isMatch = hashOtp(otpRecord.reset_otp_id, otp) === otpRecord.otp_hash;

    if (!isMatch) {
        const nextAttempts = (otpRecord.attempts || 0) + 1;

        if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
            await supabase
                .from(OTP_TABLE)
                .update({ attempts: nextAttempts, used_at: new Date().toISOString() })
                .eq('reset_otp_id', otpRecord.reset_otp_id);

            await logActivity({
                userId: user.user_id,
                studentId,
                eventType: 'locked',
                ipAddress,
                userAgent,
            });

            throw createHttpError(
                400,
                'Too many failed attempts. Please request a new code.'
            );
        }

        await supabase
            .from(OTP_TABLE)
            .update({ attempts: nextAttempts })
            .eq('reset_otp_id', otpRecord.reset_otp_id);

        await logActivity({
            userId: user.user_id,
            studentId,
            eventType: 'verify_fail',
            ipAddress,
            userAgent,
        });

        throw createHttpError(400, 'Invalid or expired verification code.');
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
        .from(OTP_TABLE)
        .update({ verified_at: now })
        .eq('reset_otp_id', otpRecord.reset_otp_id);

    if (updateError) {
        throw createHttpError(500, 'Failed to verify reset code.');
    }

    await logActivity({
        userId: user.user_id,
        studentId,
        eventType: 'verify_success',
        ipAddress,
        userAgent,
    });

    return { message: 'Verification successful.' };
}

async function resetPassword(body = {}, req = {}) {
    const rawStudentId = body.studentId || body.student_id || '';
    const studentId = normalizeStudentNumber(rawStudentId);
    const otp = String(body.otp || '').trim();
    const password = String(body.password || '');
    const confirmPassword = String(body.confirmPassword || body.confirm_password || '');
    const { ipAddress, userAgent } = extractRequestMeta(req);

    if (!isValidStudentId(studentId)) {
        throw createHttpError(
            400,
            'Please enter a valid Student ID (e.g., PDM-2024-000123)'
        );
    }

    if (!isValidOtp(otp)) {
        throw createHttpError(400, 'OTP must be exactly 6 digits.');
    }

    if (password !== confirmPassword) {
        throw createHttpError(400, 'Passwords do not match.');
    }

    ensureResetPasswordPolicy(password);

    const user = await findVerifiedUserByStudentId(studentId);
    const otpRecord = user ? await fetchLatestOpenOtp(user.user_id) : null;

    if (!user || !otpRecord || !otpRecord.verified_at) {
        await logActivity({
            userId: user?.user_id || null,
            studentId,
            eventType: 'reset_fail',
            ipAddress,
            userAgent,
        });
        throw createHttpError(400, 'Invalid or expired verification code.');
    }

    if (new Date(otpRecord.expires_at).getTime() <= Date.now()) {
        await markOtpUsed(otpRecord.reset_otp_id);
        throw createHttpError(400, 'Invalid or expired verification code.');
    }

    if ((otpRecord.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
        await markOtpUsed(otpRecord.reset_otp_id);
        throw createHttpError(
            400,
            'Too many failed attempts. Please request a new code.'
        );
    }

    const isMatch = hashOtp(otpRecord.reset_otp_id, otp) === otpRecord.otp_hash;

    if (!isMatch) {
        await logActivity({
            userId: user.user_id,
            studentId,
            eventType: 'reset_fail',
            ipAddress,
            userAgent,
        });
        throw createHttpError(400, 'Invalid or expired verification code.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const nextTokenVersion = (user.token_version || 1) + 1;

    const { error: updateUserError } = await supabase
        .from('users')
        .update({
            password_hash: passwordHash,
            token_version: nextTokenVersion,
        })
        .eq('user_id', user.user_id);

    if (updateUserError) {
        throw createHttpError(500, 'Failed to update password.');
    }

    await invalidateOpenOtps(user.user_id);

    await logActivity({
        userId: user.user_id,
        studentId,
        eventType: 'reset_success',
        ipAddress,
        userAgent,
    });

    return { message: 'Password reset successful.' };
}

module.exports = {
    forgotPassword,
    verifyResetOtp,
    resetPassword,
};
