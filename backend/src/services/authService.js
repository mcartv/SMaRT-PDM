const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { buildAuthToken } = require('../middleware/authMiddleware');

const otpStore = new Map();
const pendingRegistrationStore = new Map();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'pelimavenice.pdm@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function normalizeStudentNumber(value = '') {
    return String(value || '').trim().toUpperCase();
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function ensurePasswordPolicy(password) {
    const value = String(password || '');

    if (!value) {
        throw createHttpError(400, 'Password is required');
    }

    const hasLongLength = value.length >= 15;
    const hasStrongMixedRule =
        value.length >= 8 && /[a-z]/.test(value) && /\d/.test(value);

    if (!hasLongLength && !hasStrongMixedRule) {
        throw createHttpError(
            400,
            'Password should be at least 15 characters OR at least 8 characters including a number and a lowercase letter.'
        );
    }
}

async function sendOTPEmail(email, otp) {
    console.log('DEV OTP:', { email, otp });

    if (process.env.SKIP_EMAIL === 'true') {
        return;
    }

    await transporter.sendMail({
        from: process.env.GMAIL_USER || 'pelimavenice.pdm@gmail.com',
        to: email,
        subject: 'SMaRT-PDM Account Verification OTP',
        html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>SMaRT-PDM Verification</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `,
    });
}

async function resolveRegistrarStudentByStudentNumber(studentNumber) {
    const normalizedStudentNumber = normalizeStudentNumber(studentNumber);

    const { data, error } = await supabase
        .from('student_master_records')
        .select(`
      master_student_id,
      student_number,
      pdm_id,
      learners_reference_number,
      first_name,
      middle_name,
      last_name,
      sex_at_birth,
      email_address,
      phone_number,
      course_id,
      year_level,
      sequence_number,
      source_registry,
      is_active,
      is_archived
    `)
        .or(`student_number.eq.${normalizedStudentNumber},pdm_id.eq.${normalizedStudentNumber}`)
        .eq('is_archived', false)
        .maybeSingle();

    if (error) throw error;

    return data || null;
}

async function resolveStudentByUserId(userId) {
    const { data, error } = await supabase
        .from('students')
        .select(`
      student_id,
      user_id,
      pdm_id,
      first_name,
      middle_name,
      last_name,
      year_level,
      course_id,
      profile_photo_url,
      is_profile_complete,
      is_active_scholar,
      scholarship_status
    `)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;

    return data || null;
}

async function ensureStudentFromMasterRecord({
    userId,
    studentNumber,
    masterStudent,
    email,
}) {
    if (!userId) {
        throw createHttpError(401, 'User ID is required.');
    }

    if (!masterStudent) {
        throw createHttpError(404, 'Registry student record not found.');
    }

    const firstName = safeText(masterStudent.first_name);
    const lastName = safeText(masterStudent.last_name);

    if (!firstName || !lastName) {
        throw createHttpError(
            500,
            'Registry record is missing first name or last name.'
        );
    }

    const normalizedStudentNumber = normalizeStudentNumber(studentNumber);

    const studentPayload = {
        master_student_id: masterStudent.master_student_id || null,
        user_id: userId,
        pdm_id:
            safeText(masterStudent.pdm_id) ||
            safeText(masterStudent.student_number) ||
            normalizedStudentNumber,
        registrar_student_number:
            safeText(masterStudent.student_number) || normalizedStudentNumber,
        learners_reference_number:
            safeText(masterStudent.learners_reference_number) || null,
        course_id: masterStudent.course_id || null,
        first_name: firstName,
        middle_name: safeText(masterStudent.middle_name) || null,
        last_name: lastName,
        year_level: masterStudent.year_level || null,
        sex_at_birth: safeText(masterStudent.sex_at_birth) || null,
        email_address: safeText(masterStudent.email_address) || email || null,
        phone_number: safeText(masterStudent.phone_number) || null,
        sequence_number: masterStudent.sequence_number || null,
        account_status: 'Verified',
        is_profile_complete: false,
        is_archived: false,
    };

    const existingFilters = [
        `user_id.eq.${userId}`,
        `pdm_id.eq.${studentPayload.pdm_id}`,
    ];

    if (studentPayload.registrar_student_number) {
        existingFilters.push(
            `registrar_student_number.eq.${studentPayload.registrar_student_number}`
        );
    }

    if (studentPayload.master_student_id) {
        existingFilters.push(`master_student_id.eq.${studentPayload.master_student_id}`);
    }

    const { data: existingStudent, error: existingError } = await supabase
        .from('students')
        .select('student_id')
        .or(existingFilters.join(','))
        .maybeSingle();

    if (existingError) throw existingError;

    if (existingStudent?.student_id) {
        const { data, error } = await supabase
            .from('students')
            .update(studentPayload)
            .eq('student_id', existingStudent.student_id)
            .select('student_id')
            .single();

        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase
        .from('students')
        .insert([studentPayload])
        .select('student_id')
        .single();

    if (error) throw error;

    return data;
}

async function buildAuthUser(user, studentProfile = null) {
    const hasScholarAccess =
        studentProfile?.is_active_scholar === true ||
        String(studentProfile?.scholarship_status || '').toLowerCase() === 'active';

    return {
        id: user.user_id,
        user_id: user.user_id,
        userId: user.user_id,
        email: user.email,
        student_id: user.username,
        pdm_id: studentProfile?.pdm_id ?? user.username ?? null,
        first_name: studentProfile?.first_name ?? '',
        last_name: studentProfile?.last_name ?? '',
        role: user.role ?? null,
        is_verified: !!user.is_otp_verified,
        is_profile_complete: studentProfile?.is_profile_complete === true,
        has_scholar_access: hasScholarAccess,
    };
}

async function buildAuthResponse(user) {
    const studentProfile = user?.user_id
        ? await resolveStudentByUserId(user.user_id)
        : null;

    return {
        message: 'Login successful',
        token: buildAuthToken(user),
        user: await buildAuthUser(user, studentProfile),
        needs_profile_completion: studentProfile
            ? studentProfile.is_profile_complete !== true
            : true,
    };
}

async function checkStudentId(body = {}) {
    const student_id = normalizeStudentNumber(body.student_id);

    if (!student_id) {
        throw createHttpError(400, 'Student ID is required');
    }

    const registryStudent = await resolveRegistrarStudentByStudentNumber(student_id);

    if (!registryStudent) {
        return {
            exists: false,
            hasAccount: false,
            student: null,
        };
    }

    const { data: existingUser, error } = await supabase
        .from('users')
        .select('user_id')
        .eq('username', student_id)
        .maybeSingle();

    if (error) throw error;

    return {
        exists: true,
        hasAccount: !!existingUser,
        student: registryStudent,
    };
}

async function register(body = {}) {
    let { email, password, student_id } = body;

    email = safeText(email).toLowerCase();
    student_id = normalizeStudentNumber(student_id);

    if (!email || !password || !student_id) {
        throw createHttpError(400, 'Email, password, and Student ID are required');
    }

    ensurePasswordPolicy(password);

    const studentIdRegex = /^PDM-\d{4}-\d{6}$/;
    if (!studentIdRegex.test(student_id)) {
        throw createHttpError(
            400,
            'Student ID must be in the format PDM-YYYY-NNNNNN (e.g. PDM-2023-000001)'
        );
    }

    const registrarStudent = await resolveRegistrarStudentByStudentNumber(student_id);

    if (!registrarStudent) {
        throw createHttpError(
            403,
            'Student ID is not registered in the registrar records.'
        );
    }

    const { data: existingUserByStudentId, error: studentIdCheckError } =
        await supabase
            .from('users')
            .select('username')
            .eq('username', student_id)
            .maybeSingle();

    if (studentIdCheckError) {
        throw createHttpError(500, 'Database error during student ID check');
    }

    if (existingUserByStudentId) {
        throw createHttpError(409, 'Student ID already registered');
    }

    const { data: existingUserByEmail, error: emailCheckError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .maybeSingle();

    if (emailCheckError) {
        throw createHttpError(500, 'Database error during email check');
    }

    if (existingUserByEmail) {
        throw createHttpError(409, 'Email already registered');
    }

    for (const [storedEmail, pending] of pendingRegistrationStore.entries()) {
        if (Date.now() > pending.expiresAt) {
            pendingRegistrationStore.delete(storedEmail);
            otpStore.delete(storedEmail);
            continue;
        }

        if (storedEmail === email || pending.student_id === student_id) {
            pendingRegistrationStore.delete(storedEmail);
            otpStore.delete(storedEmail);
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    pendingRegistrationStore.set(email, {
        email,
        student_id,
        registrar_student: registrarStudent,
        password_hash: hashedPassword,
        role: 'Student',
        expiresAt,
    });

    otpStore.set(email, { otp, expiresAt });

    await sendOTPEmail(email, otp);

    return {
        message: 'OTP sent. Complete verification to finish registration.',
        user: {
            user_id: null,
            email,
            student_id,
            role: 'Student',
            is_verified: false,
        },
    };
}

async function verifyOtp(body = {}) {
    let { email, otp } = body;

    email = safeText(email).toLowerCase();
    otp = safeText(otp);

    const record = otpStore.get(email);
    const pendingRegistration = pendingRegistrationStore.get(email);

    if (!record || !pendingRegistration) {
        throw createHttpError(400, 'No pending registration found or OTP already used');
    }

    if (Date.now() > record.expiresAt || Date.now() > pendingRegistration.expiresAt) {
        otpStore.delete(email);
        pendingRegistrationStore.delete(email);
        throw createHttpError(400, 'OTP has expired. Please register again.');
    }

    if (record.otp !== otp) {
        throw createHttpError(400, 'Invalid OTP');
    }

    const masterStudent = await resolveRegistrarStudentByStudentNumber(
        pendingRegistration.student_id
    );

    if (!masterStudent) {
        otpStore.delete(email);
        pendingRegistrationStore.delete(email);
        throw createHttpError(
            403,
            'Student ID is not registered in the registrar records.'
        );
    }

    const { data: existingUserByStudentId, error: studentIdCheckError } =
        await supabase
            .from('users')
            .select('username')
            .eq('username', pendingRegistration.student_id)
            .maybeSingle();

    if (studentIdCheckError) {
        throw createHttpError(500, 'Database error during final student ID validation');
    }

    if (existingUserByStudentId) {
        otpStore.delete(email);
        pendingRegistrationStore.delete(email);
        throw createHttpError(409, 'Student ID already registered');
    }

    const { data: existingUserByEmail, error: emailCheckError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .maybeSingle();

    if (emailCheckError) {
        throw createHttpError(500, 'Database error during final email validation');
    }

    if (existingUserByEmail) {
        otpStore.delete(email);
        pendingRegistrationStore.delete(email);
        throw createHttpError(409, 'Email already registered');
    }

    const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .insert([
            {
                email: pendingRegistration.email,
                username: pendingRegistration.student_id,
                password_hash: pendingRegistration.password_hash,
                is_otp_verified: true,
                role: pendingRegistration.role || 'Student',
            },
        ])
        .select()
        .single();

    if (insertError) {
        console.error('USER INSERT ERROR:', insertError);
        throw createHttpError(500, insertError.message || 'Failed to complete registration');
    }

    try {
        await ensureStudentFromMasterRecord({
            userId: insertedUser.user_id,
            studentNumber: pendingRegistration.student_id,
            masterStudent,
            email: pendingRegistration.email,
        });
    } catch (studentError) {
        console.error('STUDENT MIGRATION ERROR:', studentError);

        await supabase.from('users').delete().eq('user_id', insertedUser.user_id);

        throw createHttpError(
            studentError.statusCode || 500,
            studentError.message || 'Failed to migrate registry data to student record.'
        );
    }

    otpStore.delete(email);
    pendingRegistrationStore.delete(email);

    return {
        ...(await buildAuthResponse(insertedUser)),
        message: 'Email verified successfully',
        needs_profile_completion: true,
    };
}

async function login(body = {}) {
    const rawStudentId =
        body.student_id || body.studentId || body.username || body.pdm_id || '';

    const studentId = normalizeStudentNumber(rawStudentId);
    const password = String(body.password || '');

    if (!studentId || !password) {
        throw createHttpError(400, 'Student ID and password are required');
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', studentId)
        .maybeSingle();

    if (error) {
        console.error('LOGIN USER LOOKUP ERROR:', error);
        throw createHttpError(500, 'Database error during login');
    }

    if (!user) {
        console.error('LOGIN FAILED: USERNAME NOT FOUND:', studentId);
        throw createHttpError(401, 'Invalid Student ID or password');
    }

    if (!user.password_hash) {
        console.error('LOGIN FAILED: USER HAS NO PASSWORD HASH:', studentId);
        throw createHttpError(401, 'Invalid Student ID or password');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
        console.error('LOGIN FAILED: PASSWORD MISMATCH FOR:', studentId);
        throw createHttpError(401, 'Invalid Student ID or password');
    }

    if (!user.is_otp_verified) {
        throw createHttpError(403, 'Please verify your email first');
    }

    return buildAuthResponse(user);
}

module.exports = {
    checkStudentId,
    register,
    verifyOtp,
    login,
    otpStore,
    pendingRegistrationStore,
};