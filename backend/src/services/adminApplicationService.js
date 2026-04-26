const supabase = require('../config/supabase');

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

async function getAdminProfileId(adminUserId) {
    if (!adminUserId) return null;

    const { data, error } = await supabase
        .from('admin_profiles')
        .select('admin_id')
        .eq('user_id', adminUserId)
        .maybeSingle();

    if (error) throw error;
    return data?.admin_id || null;
}

async function getApplications(query = {}) {
    const status = safeText(query.status);
    const openingId = safeText(query.opening_id || query.openingId);

    let request = supabase
        .from('applications')
        .select(`
      application_id,
      student_id,
      opening_id,
      program_id,
      application_status,
      document_status,
      verification_status,
      deficiency_status,
      rejection_reason,
      remarks,
      submission_date,
      created_at,
      updated_at,
      students (
        student_id,
        pdm_id,
        first_name,
        middle_name,
        last_name,
        year_level,
        email_address,
        phone_number,
        scholarship_status,
        is_active_scholar,
        academic_course (
          course_code,
          course_name
        )
      ),
      program_openings (
        opening_id,
        opening_title
      ),
      scholarship_program (
        program_id,
        program_name
      )
    `)
        .eq('is_archived', false)
        .order('submission_date', { ascending: false });

    if (status) {
        request = request.eq('application_status', status);
    }

    if (openingId) {
        request = request.eq('opening_id', openingId);
    }

    const { data, error } = await request;
    if (error) throw error;

    return {
        items: data || [],
    };
}

async function getApplicationById(applicationId) {
    if (!applicationId) {
        throw createHttpError(400, 'Application ID is required.');
    }

    const { data: application, error } = await supabase
        .from('applications')
        .select(`
      *,
      students (
        *,
        academic_course (
          course_code,
          course_name
        ),
        student_profiles (*),
        student_family (*),
        student_education (*)
      ),
      program_openings (
        opening_id,
        opening_title,
        program_id,
        posting_status
      ),
      scholarship_program (
        program_id,
        program_name
      ),
      application_documents (*)
    `)
        .eq('application_id', applicationId)
        .maybeSingle();

    if (error) throw error;

    if (!application) {
        throw createHttpError(404, 'Application not found.');
    }

    return {
        application,
    };
}

async function approveApplication({ applicationId, adminUserId, remarks }) {
    if (!applicationId) {
        throw createHttpError(400, 'Application ID is required.');
    }

    const adminId = await getAdminProfileId(adminUserId);

    const { data: application, error: appError } = await supabase
        .from('applications')
        .select(`
      application_id,
      student_id,
      opening_id,
      program_id,
      application_status,
      students (
        student_id,
        user_id,
        first_name,
        last_name
      )
    `)
        .eq('application_id', applicationId)
        .maybeSingle();

    if (appError) throw appError;

    if (!application) {
        throw createHttpError(404, 'Application not found.');
    }

    const now = new Date().toISOString();

    const { data: updatedApplication, error: updateAppError } = await supabase
        .from('applications')
        .update({
            application_status: 'Approved',
            verification_status: 'verified',
            document_status: 'Documents Ready',
            evaluator_id: adminId,
            remarks: safeText(remarks) || 'Approved',
            updated_at: now,
        })
        .eq('application_id', application.application_id)
        .select('*')
        .single();

    if (updateAppError) throw updateAppError;

    const { data: updatedStudent, error: updateStudentError } = await supabase
        .from('students')
        .update({
            is_active_scholar: true,
            scholarship_status: 'Active',
            current_program_id: application.program_id,
            current_application_id: application.application_id,
            date_awarded: now.slice(0, 10),
            updated_at: now,
        })
        .eq('student_id', application.student_id)
        .select('*')
        .single();

    if (updateStudentError) throw updateStudentError;

    if (application.students?.user_id) {
        const { error: notificationError } = await supabase
            .from('notifications')
            .insert([
                {
                    user_id: application.students.user_id,
                    type: 'Application',
                    title: 'Scholarship Application Approved',
                    message:
                        'Congratulations! Your scholarship application has been approved. Scholar features are now available in your account.',
                    reference_id: application.application_id,
                    reference_type: 'application',
                    is_read: false,
                    push_sent: false,
                },
            ]);

        if (notificationError) {
            console.warn('APPROVAL NOTIFICATION INSERT WARNING:', notificationError);
        }
    }

    return {
        message: 'Application approved successfully.',
        application: updatedApplication,
        student: updatedStudent,
    };
}

async function rejectApplication({
    applicationId,
    adminUserId,
    rejectionReason,
    remarks,
}) {
    if (!applicationId) {
        throw createHttpError(400, 'Application ID is required.');
    }

    const reason = safeText(rejectionReason);

    if (!reason) {
        throw createHttpError(400, 'Rejection reason is required.');
    }

    const adminId = await getAdminProfileId(adminUserId);

    const { data: application, error: appError } = await supabase
        .from('applications')
        .select(`
      application_id,
      student_id,
      program_id,
      students (
        student_id,
        user_id
      )
    `)
        .eq('application_id', applicationId)
        .maybeSingle();

    if (appError) throw appError;

    if (!application) {
        throw createHttpError(404, 'Application not found.');
    }

    const now = new Date().toISOString();

    const { data: updatedApplication, error: updateAppError } = await supabase
        .from('applications')
        .update({
            application_status: 'Rejected',
            verification_status: 'rejected',
            rejection_reason: reason,
            evaluator_id: adminId,
            remarks: safeText(remarks) || reason,
            updated_at: now,
        })
        .eq('application_id', application.application_id)
        .select('*')
        .single();

    if (updateAppError) throw updateAppError;

    if (application.students?.user_id) {
        const { error: notificationError } = await supabase
            .from('notifications')
            .insert([
                {
                    user_id: application.students.user_id,
                    type: 'Application',
                    title: 'Scholarship Application Rejected',
                    message: `Your scholarship application was not approved. Reason: ${reason}`,
                    reference_id: application.application_id,
                    reference_type: 'application',
                    is_read: false,
                    push_sent: false,
                },
            ]);

        if (notificationError) {
            console.warn('REJECTION NOTIFICATION INSERT WARNING:', notificationError);
        }
    }

    return {
        message: 'Application rejected successfully.',
        application: updatedApplication,
    };
}

module.exports = {
    getApplications,
    getApplicationById,
    approveApplication,
    rejectApplication,
};