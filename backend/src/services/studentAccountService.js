const supabase = require('../config/supabase');

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

async function resolveStudentByUserId(userId) {
    if (!userId) {
        throw createHttpError(401, 'User ID is required.');
    }

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

async function ensureStudentForUser(userId) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const existingStudent = await resolveStudentByUserId(userId);
    if (existingStudent?.student_id) {
        return existingStudent;
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('user_id, username, email')
        .eq('user_id', userId)
        .maybeSingle();

    if (userError) throw userError;

    if (!user) {
        throw createHttpError(404, 'User account not found.');
    }

    const studentNumber = normalizeStudentNumber(user.username);
    if (!studentNumber) {
        throw createHttpError(
            400,
            'This account is not linked to a student number.'
        );
    }

    const masterStudent = await resolveRegistrarStudentByStudentNumber(studentNumber);
    if (!masterStudent) {
        throw createHttpError(
            404,
            'No registrar student record matches this account.'
        );
    }

    await ensureStudentFromMasterRecord({
        userId,
        studentNumber,
        masterStudent,
        email: user.email,
    });

    const repairedStudent = await resolveStudentByUserId(userId);
    if (!repairedStudent?.student_id) {
        throw createHttpError(
            500,
            'Failed to link this account to a student profile.'
        );
    }

    return repairedStudent;
}

module.exports = {
    normalizeStudentNumber,
    resolveStudentByUserId,
    resolveRegistrarStudentByStudentNumber,
    ensureStudentFromMasterRecord,
    ensureStudentForUser,
};
