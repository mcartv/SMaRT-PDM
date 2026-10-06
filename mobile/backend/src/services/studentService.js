// SMaRT-PDM: student Service — student Service (mobile backend service); contains mobile-facing business logic and data operations.
const supabase = require('../config/supabase');

// createHttpError: creates create http error for the student Service flow.
function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// getMyStatus: reads and returns get my status for the student Service flow.
async function getMyStatus(userId) {
    const { data: student, error } = await supabase
        .from('students')
        .select(`
      student_id,
      user_id,
      pdm_id,
      first_name,
      middle_name,
      last_name,
      is_active_scholar,
      scholarship_status,
      current_program_id,
      current_application_id,
      current_program:scholarship_program!students_current_program_id_fkey (
        program_id,
        program_name
      )
    `)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;

    if (!student) {
        throw createHttpError(404, 'Student profile not found.');
    }

    const isApprovedScholar =
        student.is_active_scholar === true ||
        student.scholarship_status === 'Active';

    return {
        studentId: student.student_id,
        pdmId: student.pdm_id,
        fullName: [student.first_name, student.middle_name, student.last_name]
            .filter(Boolean)
            .join(' '),
        isApprovedScholar,
        scholarAccess: isApprovedScholar,
        scholarshipStatus: student.scholarship_status,
        currentProgramId: student.current_program_id,
        currentApplicationId: student.current_application_id,
        currentProgram: student.current_program || null,
    };
}

module.exports = {
    getMyStatus,
};