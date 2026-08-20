const supabase = require('../config/supabase');

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

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