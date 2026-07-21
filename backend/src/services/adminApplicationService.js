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
      requirements_completed_at,
      requirements_verified_at,
      selection_status,
      queue_position,
      waitlist_position,
      can_reapply,
      reapplication_reason,
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
      verification_status,
      requirements_completed_at,
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
    if (!application) throw createHttpError(404, 'Application not found.');

    if (safeText(application.verification_status).toLowerCase() !== 'verified') {
        throw createHttpError(
            409,
            'Complete document verification before marking this applicant qualified.'
        );
    }

    const now = new Date().toISOString();
    const { data: updatedApplication, error: updateAppError } = await supabase
        .from('applications')
        .update({
            selection_status: 'Qualified',
            requirements_verified_at: now,
            evaluator_id: adminId,
            remarks: safeText(remarks) || 'Qualified for final selection',
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
                    title: 'Application Qualified',
                    message:
                        'Your application is qualified for the final applicant list. Qualification does not activate scholar access until OSFA finalizes the selected list.',
                    reference_id: application.application_id,
                    reference_type: 'application',
                    is_read: false,
                    push_sent: false,
                },
            ]);

        if (notificationError) {
            console.warn('QUALIFICATION NOTIFICATION INSERT WARNING:', notificationError);
        }
    }

    return {
        message: 'Applicant marked as qualified for final selection.',
        application: updatedApplication,
        student: null,
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