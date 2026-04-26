const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { RecaptchaEnterpriseServiceClient } = require('@google-cloud/recaptcha-enterprise');
const twilio = require('twilio');

const RECOVERY_TABLE = 'account_recovery_sessions';
const RECOVERY_CODE_LENGTH = 6;
const RECOVERY_CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_VERIFY_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRY = '10m';
const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;
const RECOVERY_ACTION = 'password_reset';
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
}) {
  if (!supabase) {
    throw new Error('Account recovery service requires a Supabase client.');
  }

  if (!resolveStudentByUserId || !resolveAvatarUrl || !createHttpError || !transporter) {
    throw new Error('Account recovery service is missing required dependencies.');
  }

  const twilioClient =
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
      ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      : null;
  const recaptchaClient =
    process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.RECAPTCHA_ANDROID_SITE_KEY
      ? new RecaptchaEnterpriseServiceClient()
      : null;

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

  function toE164(value = '') {
    const normalized = normalizePhilippineMobile(value);
    if (!isValidPhilippineMobile(normalized)) {
      return '';
    }

    return `+63${normalized.slice(1)}`;
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

  function maskPhone(phoneNumber = '') {
    const normalized = normalizePhilippineMobile(phoneNumber);
    if (!isValidPhilippineMobile(normalized)) {
      return null;
    }

    const e164 = toE164(normalized);
    const visiblePrefix = e164.slice(0, 5);
    const visibleSuffix = e164.slice(-2);
    return `${visiblePrefix}${'*'.repeat(Math.max(e164.length - 7, 4))}${visibleSuffix}`;
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
      masked_phone: maskPhone(user.phone_number),
      has_email: isValidEmail(user.email),
      has_phone: isValidPhilippineMobile(user.phone_number),
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
    const maskedDestination =
      row.channel === 'sms' ? snapshot.masked_phone || null : snapshot.masked_email || null;

    return {
      session_id: row.recovery_session_id,
      channel: row.channel,
      masked_destination: maskedDestination,
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

  async function verifyRecoveryCaptcha({ token, userAgent, userIpAddress }) {
    if (!token) {
      throw createHttpError(400, 'captcha_token is required.');
    }

    if (!recaptchaClient) {
      throw createHttpError(
        500,
        'reCAPTCHA Enterprise is not configured on the backend.'
      );
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const siteKey = process.env.RECAPTCHA_ANDROID_SITE_KEY;
    const minimumScore = Number(process.env.RECAPTCHA_MIN_SCORE || DEFAULT_RECAPTCHA_MIN_SCORE);

    const request = {
      assessment: {
        event: {
          token,
          siteKey,
          userAgent: userAgent || '',
          userIpAddress: userIpAddress || '',
        },
      },
      parent: recaptchaClient.projectPath(projectId),
    };

    let response;
    try {
      [response] = await recaptchaClient.createAssessment(request);
    } catch (error) {
      throw createHttpError(502, 'Unable to verify the reCAPTCHA challenge.');
    }

    if (!response?.tokenProperties?.valid) {
      throw createHttpError(400, 'The reCAPTCHA challenge was not valid.');
    }

    if (response.tokenProperties.action !== RECOVERY_ACTION) {
      throw createHttpError(400, 'The reCAPTCHA challenge action did not match the recovery flow.');
    }

    const score = Number(response.riskAnalysis?.score ?? 0);
    if (score < minimumScore) {
      throw createHttpError(403, 'We could not verify this recovery attempt.');
    }

    return {
      assessmentName: response.name || null,
      score,
      reasons: Array.isArray(response.riskAnalysis?.reasons)
        ? response.riskAnalysis.reasons.map((reason) => String(reason))
        : [],
      action: response.tokenProperties.action || RECOVERY_ACTION,
    };
  }

  async function sendRecoveryEmail(email, code, displayName) {
    const mailOptions = {
      from: '"SMaRT-PDM Admin" <pelimavenice.pdm@gmail.com>',
      to: email,
      subject: 'Your SMaRT-PDM Password Recovery Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password recovery for ${displayName || 'your SMaRT-PDM account'}</h2>
          <p>Your 6-digit recovery code is:</p>
          <h1 style="letter-spacing: 5px; color: #7C4A2E;">${code}</h1>
          <p>Enter this code in the SMaRT-PDM app to continue resetting your password. The code expires in ${RECOVERY_CODE_EXPIRY_MINUTES} minutes.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return null;
  }

  async function sendRecoverySms(phoneNumber, code) {
    if (!twilioClient || !process.env.TWILIO_FROM_PHONE) {
      throw createHttpError(500, 'Twilio SMS delivery is not configured on the backend.');
    }

    const message = await twilioClient.messages.create({
      body: `Your SMaRT-PDM recovery code is ${code}. It expires in ${RECOVERY_CODE_EXPIRY_MINUTES} minutes.`,
      from: process.env.TWILIO_FROM_PHONE,
      to: toE164(phoneNumber),
    });

    return message.sid || null;
  }

  async function deliverRecoveryCode({ channel, destination, code, displayName }) {
    if (channel === 'email') {
      return sendRecoveryEmail(destination, code, displayName);
    }

    if (channel === 'sms') {
      return sendRecoverySms(destination, code);
    }

    throw createHttpError(400, 'Unsupported recovery channel.');
  }

  async function createRecoverySession({
    user,
    student,
    channel,
    captchaAssessment,
  }) {
    const normalizedEmail = normalizeEmail(user.email);
    const normalizedPhone = normalizePhilippineMobile(user.phone_number);
    const destination =
      channel === 'email' ? normalizedEmail : normalizedPhone;

    if (channel === 'email' && !isValidEmail(destination)) {
      throw createHttpError(400, 'This account does not have a valid recovery email.');
    }

    if (channel === 'sms' && !isValidPhilippineMobile(destination)) {
      throw createHttpError(400, 'This account does not have a valid recovery mobile number.');
    }

    await invalidateOpenSessionsForUser(user.user_id);

    const sessionId = crypto.randomUUID();
    const code = generateRecoveryCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RECOVERY_CODE_EXPIRY_MINUTES * 60 * 1000);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);
    const destinationSnapshot = {
      email: isValidEmail(normalizedEmail) ? normalizedEmail : null,
      phone_number: isValidPhilippineMobile(normalizedPhone) ? normalizedPhone : null,
      masked_email: maskEmail(normalizedEmail),
      masked_phone: maskPhone(normalizedPhone),
      display_name: buildDisplayName(user, student),
    };

    const insertPayload = {
      recovery_session_id: sessionId,
      user_id: user.user_id,
      channel,
      destination_snapshot: destinationSnapshot,
      code_hash: hashRecoveryCode(sessionId, code),
      attempt_count: 0,
      max_attempts: MAX_VERIFY_ATTEMPTS,
      resend_count: 0,
      captcha_assessment_name: captchaAssessment.assessmentName,
      captcha_score: captchaAssessment.score,
      captcha_reasons: captchaAssessment.reasons,
      captcha_action: captchaAssessment.action,
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
        channel,
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
      .filter((account) => account.has_email || account.has_phone)
      .sort((left, right) => left.display_name.localeCompare(right.display_name));
  }

  async function startRecovery({
    userId,
    channel,
    captchaToken,
    userAgent,
    userIpAddress,
  }) {
    const safeChannel = String(channel || '').trim().toLowerCase();
    if (!['email', 'sms'].includes(safeChannel)) {
      throw createHttpError(400, 'channel must be either email or sms.');
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, username, email, phone_number')
      .eq('user_id', userId)
      .maybeSingle();

    if (userError) {
      throw createHttpError(500, userError.message);
    }

    if (!user) {
      throw createHttpError(404, 'Account not found.');
    }

    const student = await resolveStudentByUserId(user.user_id);
    const captchaAssessment = await verifyRecoveryCaptcha({
      token: captchaToken,
      userAgent,
      userIpAddress,
    });

    return createRecoverySession({
      user,
      student,
      channel: safeChannel,
      captchaAssessment,
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
    const destination =
      session.channel === 'sms' ? snapshot.phone_number : snapshot.email;
    const displayName = snapshot.display_name || 'your SMaRT-PDM account';

    if (!destination) {
      throw createHttpError(400, 'This recovery session has no delivery destination.');
    }

    const code = generateRecoveryCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RECOVERY_CODE_EXPIRY_MINUTES * 60 * 1000);
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
        channel: session.channel,
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
