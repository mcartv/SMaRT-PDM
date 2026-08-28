const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const RECOVERY_TABLE = 'account_recovery_sessions';
const RECOVERY_CODE_LENGTH = 6;
const RECOVERY_CODE_EXPIRY_SECONDS = 60;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_VERIFY_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRY = '10m';
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

function createAccountRecoveryService({
  supabase,
  resolveStudentByUserId,
  resolveAvatarUrl,
  createHttpError,
  transporter,
  mailFrom = '"SMaRT-PDM Admin" <pelimavenice.pdm@gmail.com>',
}) {
  if (!supabase) {
    throw new Error('Account recovery service requires a Supabase client.');
  }

  if (!resolveStudentByUserId || !resolveAvatarUrl || !createHttpError || !transporter) {
    throw new Error('Account recovery service is missing required dependencies.');
  }

  function normalizeEmail(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function normalizePhilippineMobile(value = '') {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    const cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+63') && cleaned.length === 13) {
      return `0${cleaned.slice(3)}`;
    }
    if (cleaned.startsWith('63') && cleaned.length === 12) {
      return `0${cleaned.slice(2)}`;
    }
    if (cleaned.startsWith('9') && cleaned.length === 10) {
      return `0${cleaned}`;
    }

    return cleaned;
  }

  function isValidEmail(value = '') {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeEmail(value));
  }

  function isValidPhilippineMobile(value = '') {
    return /^09\d{9}$/.test(normalizePhilippineMobile(value));
  }

  function detectIdentifier(identifier = '') {
    const normalizedEmail = normalizeEmail(identifier);
    if (isValidEmail(normalizedEmail)) {
      return {
        kind: 'email',
        normalizedValue: normalizedEmail,
      };
    }

    const normalizedPhone = normalizePhilippineMobile(identifier);
    if (isValidPhilippineMobile(normalizedPhone)) {
      return {
        kind: 'phone',
        normalizedValue: normalizedPhone,
      };
    }

    throw createHttpError(400, 'Enter a valid mobile number or email address.');
  }

  function maskEmail(email = '') {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      return null;
    }

    const [localPart, domainPart] = normalized.split('@');
    const localPrefix = localPart.slice(0, 1);
    const maskedLocal = `${localPrefix}${'*'.repeat(Math.max(localPart.length - 1, 3))}`;
    const maskedDomain = '*'.repeat(Math.max(domainPart.length, 7));

    return `${maskedLocal}@${maskedDomain}`;
  }

  function buildDisplayName(user = {}, student = null) {
    const candidate = [student?.first_name, student?.last_name]
      .filter((value) => String(value || '').trim().length > 0)
      .join(' ')
      .trim();

    if (candidate) {
      return candidate;
    }

    return (
      String(student?.pdm_id || user.username || user.email || 'SMaRT-PDM User').trim()
    );
  }

  function buildRecoveryAccount(user = {}, student = null, avatarUrl = null) {
    return {
      user_id: user.user_id,
      display_name: buildDisplayName(user, student),
      student_id: String(student?.pdm_id || user.username || '').trim(),
      avatar_url: avatarUrl,
      masked_email: maskEmail(user.email),
      has_email: isValidEmail(user.email),
    };
  }

  function ensurePasswordPolicy(password = '') {
    const safePassword = String(password || '');
    if (!safePassword) {
      throw createHttpError(400, 'Password is required.');
    }

    const hasLongLength = safePassword.length >= 15;
    const hasStrongMixedRule =
      safePassword.length >= 8 &&
      /[a-z]/.test(safePassword) &&
      /\d/.test(safePassword);

    if (!hasLongLength && !hasStrongMixedRule) {
      throw createHttpError(
        400,
        'Password should be at least 15 characters OR at least 8 characters including a number and a lowercase letter.'
      );
    }

    if (COMMON_PASSWORDS.has(safePassword.toLowerCase())) {
      throw createHttpError(
        400,
        'Password may be compromised. Password is in a list of passwords commonly used on other websites.'
      );
    }
  }

  function generateRecoveryCode() {
    let code = '';
    for (let index = 0; index < RECOVERY_CODE_LENGTH; index += 1) {
      code += crypto.randomInt(0, 10).toString();
    }
    return code;
  }

  function hashRecoveryCode(sessionId, code) {
    return crypto
      .createHash('sha256')
      .update(`${sessionId}:${code}:${process.env.JWT_SECRET || 'smart-pdm-recovery'}`)
      .digest('hex');
  }

  function buildRecoverySessionResponse(row = {}) {
    const snapshot = row.destination_snapshot || {};

    return {
      session_id: row.recovery_session_id,
      channel: 'email',
      masked_destination: snapshot.masked_email || null,
      expires_at: row.expires_at || null,
      resend_available_at: row.resend_available_at || null,
    };
  }

  async function fetchUsersByPhone(normalizedPhone) {
    const candidates = new Map();
    const internationalDigits = `63${normalizedPhone.slice(1)}`;
    const internationalWithPlus = `+${internationalDigits}`;
    const exactFilters = [normalizedPhone, internationalDigits, internationalWithPlus];

    const { data: exactData, error: exactError } = await supabase
      .from('users')
      .select('user_id, username, email, phone_number')
      .or(exactFilters.map((value) => `phone_number.eq.${value}`).join(','));

    if (exactError) {
      throw createHttpError(500, exactError.message);
    }

    for (const row of exactData || []) {
      candidates.set(row.user_id, row);
    }

    const suffix = normalizedPhone.slice(-10);
    if (!candidates.size) {
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .from('users')
        .select('user_id, username, email, phone_number')
        .ilike('phone_number', `%${suffix}`);

      if (fuzzyError) {
        throw createHttpError(500, fuzzyError.message);
      }

      for (const row of fuzzyData || []) {
        if (normalizePhilippineMobile(row.phone_number) === normalizedPhone) {
          candidates.set(row.user_id, row);
        }
      }
    }

    return Array.from(candidates.values());
  }

  async function fetchLookupRows(identifier = '') {
    const detected = detectIdentifier(identifier);

    if (detected.kind === 'email') {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, username, email, phone_number')
        .ilike('email', detected.normalizedValue);

      if (error) {
        throw createHttpError(500, error.message);
      }

      return data || [];
    }

    return fetchUsersByPhone(detected.normalizedValue);
  }

  async function fetchRecoverySession(sessionId, { includeConsumed = false } = {}) {
    if (!sessionId) {
      throw createHttpError(400, 'session_id is required.');
    }

    let query = supabase
      .from(RECOVERY_TABLE)
      .select('*')
      .eq('recovery_session_id', sessionId);

    if (!includeConsumed) {
      query = query.is('consumed_at', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw createHttpError(500, error.message);
    }

    if (!data) {
      throw createHttpError(404, 'Recovery session not found.');
    }

    if (data.channel !== 'email') {
      throw createHttpError(410, 'This recovery session is no longer supported. Start again.');
    }

    return data;
  }

  async function markSessionConsumed(sessionId) {
    if (!sessionId) return;

    await supabase
      .from(RECOVERY_TABLE)
      .update({ consumed_at: new Date().toISOString() })
      .eq('recovery_session_id', sessionId)
      .is('consumed_at', null);
  }

  async function invalidateOpenSessionsForUser(userId) {
    if (!userId) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from(RECOVERY_TABLE)
      .update({ consumed_at: now })
      .eq('user_id', userId)
      .is('consumed_at', null);

    if (error) {
      throw createHttpError(500, error.message);
    }
  }

  async function sendRecoveryEmail(email, code, displayName) {
    const mailOptions = {
      from: mailFrom,
      to: email,
      subject: 'Your SMaRT-PDM Password Recovery Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password recovery for ${displayName || 'your SMaRT-PDM account'}</h2>
          <p>Your 6-digit recovery code is:</p>
          <h1 style="letter-spacing: 5px; color: #7C4A2E;">${code}</h1>
          <p>Enter this code in the SMaRT-PDM app to continue resetting your password. The code expires in ${RECOVERY_CODE_EXPIRY_SECONDS} seconds.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return null;
  }

  async function deliverRecoveryCode({ destination, code, displayName }) {
    return sendRecoveryEmail(destination, code, displayName);
  }

  async function createRecoverySession({
    user,
    student,
  }) {
    const normalizedEmail = normalizeEmail(user.email);
    const destination = normalizedEmail;

    if (!isValidEmail(destination)) {
      throw createHttpError(400, 'This account does not have a valid recovery email.');
    }

    await invalidateOpenSessionsForUser(user.user_id);

    const sessionId = crypto.randomUUID();
    const code = generateRecoveryCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RECOVERY_CODE_EXPIRY_SECONDS * 1000);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);
    const destinationSnapshot = {
      email: normalizedEmail,
      masked_email: maskEmail(normalizedEmail),
      display_name: buildDisplayName(user, student),
    };

    const insertPayload = {
      recovery_session_id: sessionId,
      user_id: user.user_id,
      channel: 'email',
      destination_snapshot: destinationSnapshot,
      code_hash: hashRecoveryCode(sessionId, code),
      attempt_count: 0,
      max_attempts: MAX_VERIFY_ATTEMPTS,
      resend_count: 0,
      last_sent_at: now.toISOString(),
      resend_available_at: resendAvailableAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    const { data, error } = await supabase
      .from(RECOVERY_TABLE)
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw createHttpError(500, error.message);
    }

    try {
      const deliveryReference = await deliverRecoveryCode({
        destination,
        code,
        displayName: destinationSnapshot.display_name,
      });

      await supabase
        .from(RECOVERY_TABLE)
        .update({ delivery_reference: deliveryReference })
        .eq('recovery_session_id', sessionId);

      return buildRecoverySessionResponse({
        ...data,
        delivery_reference: deliveryReference,
      });
    } catch (error) {
      await markSessionConsumed(sessionId);
      throw createHttpError(
        error.statusCode || 502,
        error.message || 'Failed to send the recovery code. Please try again.'
      );
    }
  }

  async function lookupAccounts(identifier = '') {
    const users = await fetchLookupRows(identifier);
    const uniqueUsers = new Map();

    for (const user of users) {
      uniqueUsers.set(user.user_id, user);
    }

    const accounts = await Promise.all(
      Array.from(uniqueUsers.values()).map(async (user) => {
        const student = await resolveStudentByUserId(user.user_id);
        const avatarUrl = await resolveAvatarUrl(student?.profile_photo_url ?? null);
        return buildRecoveryAccount(user, student, avatarUrl);
      })
    );

    return accounts
      .filter((account) => account.has_email)
      .sort((left, right) => left.display_name.localeCompare(right.display_name));
  }

  async function startRecovery({ userId }) {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, username, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (userError) {
      throw createHttpError(500, userError.message);
    }

    if (!user) {
      throw createHttpError(404, 'Account not found.');
    }

    const student = await resolveStudentByUserId(user.user_id);

    return createRecoverySession({
      user,
      student,
    });
  }

  async function resendRecoveryCode(sessionId) {
    const session = await fetchRecoverySession(sessionId);

    if (session.verified_at) {
      throw createHttpError(409, 'This recovery session has already been verified.');
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await markSessionConsumed(session.recovery_session_id);
      throw createHttpError(410, 'This recovery code has expired. Start again.');
    }

    if (new Date(session.resend_available_at).getTime() > Date.now()) {
      throw createHttpError(429, 'Please wait before requesting another code.');
    }

    const snapshot = session.destination_snapshot || {};
    const destination = snapshot.email;
    const displayName = snapshot.display_name || 'your SMaRT-PDM account';

    if (!destination) {
      throw createHttpError(400, 'This recovery session has no delivery destination.');
    }

    const code = generateRecoveryCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RECOVERY_CODE_EXPIRY_SECONDS * 1000);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);

    const { data: updatedSession, error: updateError } = await supabase
      .from(RECOVERY_TABLE)
      .update({
        code_hash: hashRecoveryCode(session.recovery_session_id, code),
        attempt_count: 0,
        resend_count: (session.resend_count || 0) + 1,
        last_sent_at: now.toISOString(),
        resend_available_at: resendAvailableAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('recovery_session_id', session.recovery_session_id)
      .is('consumed_at', null)
      .select('*')
      .single();

    if (updateError) {
      throw createHttpError(500, updateError.message);
    }

    try {
      const deliveryReference = await deliverRecoveryCode({
        destination,
        code,
        displayName,
      });

      await supabase
        .from(RECOVERY_TABLE)
        .update({ delivery_reference: deliveryReference })
        .eq('recovery_session_id', session.recovery_session_id);

      return buildRecoverySessionResponse({
        ...updatedSession,
        delivery_reference: deliveryReference,
      });
    } catch (error) {
      await markSessionConsumed(session.recovery_session_id);
      throw createHttpError(
        error.statusCode || 502,
        error.message || 'Failed to resend the recovery code. Start again.'
      );
    }
  }

  async function verifyRecoveryCode({ sessionId, code }) {
    const safeCode = String(code || '').trim();
    if (!/^\d{6}$/.test(safeCode)) {
      throw createHttpError(400, 'Enter the 6-digit recovery code.');
    }

    const session = await fetchRecoverySession(sessionId);

    if (session.verified_at) {
      throw createHttpError(409, 'This recovery session has already been verified.');
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await markSessionConsumed(session.recovery_session_id);
      throw createHttpError(410, 'This recovery code has expired. Start again.');
    }

    if ((session.attempt_count || 0) >= (session.max_attempts || MAX_VERIFY_ATTEMPTS)) {
      await markSessionConsumed(session.recovery_session_id);
      throw createHttpError(429, 'Too many incorrect attempts. Start again.');
    }

    const isMatch =
      hashRecoveryCode(session.recovery_session_id, safeCode) === session.code_hash;

    if (!isMatch) {
      const nextAttemptCount = (session.attempt_count || 0) + 1;
      const nextUpdate = { attempt_count: nextAttemptCount };
      if (nextAttemptCount >= (session.max_attempts || MAX_VERIFY_ATTEMPTS)) {
        nextUpdate.consumed_at = new Date().toISOString();
      }

      await supabase
        .from(RECOVERY_TABLE)
        .update(nextUpdate)
        .eq('recovery_session_id', session.recovery_session_id);

      throw createHttpError(400, 'The recovery code is incorrect.');
    }

    const verifiedAt = new Date().toISOString();
    const { error: verifyError } = await supabase
      .from(RECOVERY_TABLE)
      .update({ verified_at: verifiedAt })
      .eq('recovery_session_id', session.recovery_session_id);

    if (verifyError) {
      throw createHttpError(500, verifyError.message);
    }

    const resetToken = jwt.sign(
      {
        type: 'account_recovery_reset',
        recovery_session_id: session.recovery_session_id,
        user_id: session.user_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: RESET_TOKEN_EXPIRY }
    );

    return {
      reset_token: resetToken,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async function resetPassword({ resetToken, newPassword }) {
    if (!resetToken) {
      throw createHttpError(400, 'reset_token is required.');
    }

    ensurePasswordPolicy(newPassword);

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (_) {
      throw createHttpError(401, 'This password reset token is invalid or expired.');
    }

    if (decoded?.type !== 'account_recovery_reset' || !decoded.recovery_session_id || !decoded.user_id) {
      throw createHttpError(401, 'This password reset token is invalid.');
    }

    const session = await fetchRecoverySession(decoded.recovery_session_id, {
      includeConsumed: true,
    });

    if (session.user_id !== decoded.user_id) {
      throw createHttpError(401, 'This password reset token is invalid.');
    }

    if (!session.verified_at) {
      throw createHttpError(409, 'Verify the recovery code before resetting the password.');
    }

    if (session.consumed_at) {
      throw createHttpError(409, 'This password reset request has already been used.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('user_id', session.user_id);

    if (updateError) {
      throw createHttpError(500, updateError.message);
    }

    const now = new Date().toISOString();
    const { error: consumeError } = await supabase
      .from(RECOVERY_TABLE)
      .update({ consumed_at: now })
      .eq('user_id', session.user_id)
      .is('consumed_at', null);

    if (consumeError) {
      throw createHttpError(500, consumeError.message);
    }

    return {
      message: 'Password reset successful.',
    };
  }

  return {
    ensurePasswordPolicy,
    lookupAccounts,
    startRecovery,
    resendRecoveryCode,
    verifyRecoveryCode,
    resetPassword,
  };
}

module.exports = {
  createAccountRecoveryService,
};
