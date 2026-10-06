// SMaRT-PDM: support Service — support Service (mobile backend service); contains mobile-facing business logic and data operations.
const supabase = require('../config/supabase');

// createHttpError: creates create http error for the support Service flow.
function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// mapSupportTicketRow: maps map support ticket row for the support Service flow.
function mapSupportTicketRow(row = {}) {
    return {
        ticket_id: row.ticket_id,
        student_id: row.student_id,
        issue_category: row.issue_category || '',
        description: row.description || '',
        status: row.status || 'Open',
        handled_by: row.handled_by || null,
        created_at: row.created_at || null,
        resolved_at: row.resolved_at || null,
    };
}

// resolveStudentByUserId: resolves resolve student by user id for the support Service flow.
async function resolveStudentByUserId(userId) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const { data, error } = await supabase
        .from('students')
        .select('student_id')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;

    if (!data?.student_id) {
        throw createHttpError(404, 'No student profile is linked to this account.');
    }

    return data;
}

// listSupportTicketsForAdmin: loads a list of list support tickets for admin for the support Service flow.
async function listSupportTicketsForAdmin() {
    const { data, error } = await supabase
        .from('support_tickets')
        .select(`
      ticket_id,
      student_id,
      issue_category,
      description,
      status,
      handled_by,
      created_at,
      resolved_at
    `)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(mapSupportTicketRow);
}

// createSupportTicket: creates create support ticket for the support Service flow.
async function createSupportTicket({ userId, issueCategory, description }) {
    const studentRecord = await resolveStudentByUserId(userId);

    const { data, error } = await supabase
        .from('support_tickets')
        .insert({
            student_id: studentRecord.student_id,
            issue_category: issueCategory,
            description,
        })
        .select(`
      ticket_id,
      student_id,
      issue_category,
      description,
      status,
      handled_by,
      created_at,
      resolved_at
    `)
        .single();

    if (error) throw error;

    return mapSupportTicketRow(data);
}

module.exports = {
    listSupportTicketsForAdmin,
    createSupportTicket,
};