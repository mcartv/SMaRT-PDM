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
        value.length >= 8 &&
        /[a-z]/.test(value) &&
        /\d/.test(value);

    if (!hasLongLength && !hasStrongMixedRule) {
        throw createHttpError(
            400,
            'Password should be at least 15 characters OR at least 8 characters including a number and a lowercase letter.'
        );
    }
}

// async function sendOTPEmail(email, otp) {
//     await transporter.sendMail({
//         from: process.env.GMAIL_USER || 'pelimavenice.pdm@gmail.com',
//         to: email,
//         subject: 'SMaRT-PDM Account Verification OTP',
//         html: `
//       <div style="font-family: Arial, sans-serif;">
//         <h2>SMaRT-PDM Verification</h2>
//         <p>Your OTP code is:</p>
//         <h1 style="letter-spacing: 4px;">${otp}</h1>
//         <p>This code will expire in 10 minutes.</p>
//       </div>
//     `,
//     });
// }

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
        .from('student_registry')
        .select('*')
        .eq('student_number', normalizedStudentNumber)
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
      profile_photo_url
    `)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;

    return data || null;
}

async function buildAuthUser(user, studentProfile = null) {
    return {
        id: user.user_id,
        user_id: user.user_id,
        userId: user.user_id,
        email: user.email,
        student_id: user.username,
        pdm_id: studentProfile?.pdm_id ?? user.username ?? null,
        first_name: studentProfile?.first_name ?? null,
        last_name: studentProfile?.last_name ?? null,
        role: user.role ?? null,
        is_verified: !!user.is_otp_verified,
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

    email = (email || '').toString().trim().toLowerCase();
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
        throw createHttpError(403, 'Student ID is not registered in the registrar records.');
    }

    const { data: existingUserByStudentId, error: studentIdCheckError } = await supabase
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

    email = (email || '').toString().trim().toLowerCase();
    otp = (otp || '').toString().trim();

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

    const registrarStudent = await resolveRegistrarStudentByStudentNumber(
        pendingRegistration.student_id
    );

    if (!registrarStudent) {
        otpStore.delete(email);
        pendingRegistrationStore.delete(email);
        throw createHttpError(403, 'Student ID is not registered in the registrar records.');
    }

    const { data: existingUserByStudentId, error: studentIdCheckError } = await supabase
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
        throw createHttpError(500, 'Failed to complete registration');
    }

    const registrarStudentData = pendingRegistration.registrar_student;

    if (registrarStudentData && insertedUser.user_id) {
        const firstName =
            registrarStudentData.first_name ||
            registrarStudentData.given_name ||
            registrarStudentData.firstname ||
            '';

        const lastName =
            registrarStudentData.last_name ||
            registrarStudentData.lastname ||
            '';

        if (!firstName || !lastName) {
            throw createHttpError(
                500,
                'Registrar record is missing first name or last name.'
            );
        }

        const studentPayload = {
            user_id: insertedUser.user_id,
            master_student_id: registrarStudentData.master_student_id || null,
            pdm_id:
                registrarStudentData.pdm_id ||
                registrarStudentData.student_number ||
                pendingRegistration.student_id,
            registrar_student_number:
                registrarStudentData.student_number ||
                pendingRegistration.student_id,
            learners_reference_number:
                registrarStudentData.learners_reference_number || null,
            first_name: firstName,
            middle_name: registrarStudentData.middle_name || null,
            last_name: lastName,
            course_id: registrarStudentData.course_id || null,
            year_level: registrarStudentData.year_level || null,
            sex_at_birth: registrarStudentData.sex_at_birth || null,
            email_address: registrarStudentData.email_address || pendingRegistration.email,
            phone_number: registrarStudentData.phone_number || null,
            sequence_number: registrarStudentData.sequence_number || null,
            account_status: 'Verified',
            is_profile_complete: false,
        };

        const { error: studentInsertError } = await supabase
            .from('students')
            .insert([studentPayload]);

        if (studentInsertError) {
            console.error('Failed to create student record during registration:', studentInsertError);
        } else {
            const { error: registryUpdateError } = await supabase
                .from('student_registry')
                .update({ user_id: insertedUser.user_id })
                .eq('registry_id', registrarStudentData.registry_id);

            if (registryUpdateError) {
                console.warn('Failed to link user to student registry:', registryUpdateError);
            }
        }
    }

    otpStore.delete(email);
    pendingRegistrationStore.delete(email);

    return {
        ...(await buildAuthResponse(insertedUser)),
        message: 'Email verified successfully',
    };
}

async function login(body = {}) {
    const studentId = normalizeStudentNumber(body.student_id);
    const password = String(body.password || '');

    if (!studentId || !password) {
        throw createHttpError(400, 'Student ID and password are required');
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', studentId)
        .maybeSingle();

    if (error || !user) {
        throw createHttpError(401, 'Invalid Student ID or password');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
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