const supabase = require('../config/supabase');

const SUPPORT_TICKET_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function isSupportAdmin(authUser = {}) {
    return !!(
        authUser.adminId ||
        authUser.admin_id ||
        ['admin', 'sdo'].includes(String(authUser.role || '').toLowerCase())
    );
}

async function resolveStudentByUserId(userId) {
    const { data, error } = await supabase
        .from('students')
        .select('student_id, user_id, pdm_id, first_name, last_name')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

async function resolveAdminId(authUser = {}) {
    if (authUser.adminId || authUser.admin_id) {
        return authUser.adminId || authUser.admin_id;
    }

    const userId = authUser.user_id || authUser.userId || authUser.id || null;

    if (!userId) return null;

    const { data, error } = await supabase
        .from('admin_profiles')
        .select('admin_id')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;

    return data?.admin_id || null;
}

function mapSupportTicketRow(row = {}) {
    const studentProfile = row.students || {};
    const handlerProfile = row.admin_profiles || {};

    const studentName = [
        studentProfile.first_name,
        studentProfile.last_name,
    ].filter(Boolean).join(' ').trim();

    const handlerName = [
        handlerProfile.first_name,
        handlerProfile.last_name,
    ].filter(Boolean).join(' ').trim();

    return {
        ticket_id: row.ticket_id,
        student_id: row.student_id,
        issue_category: row.issue_category || '',
        description: row.description || '',
        status: row.status || 'Open',
        handled_by: row.handled_by || null,
        created_at: row.created_at || null,
        resolved_at: row.resolved_at || null,
        student_number: studentProfile.pdm_id || row.student_number || null,
        student_name: studentName || row.student_name || null,
        handler_name: handlerName || row.handler_name || null,
    };
}

async function getMyTickets(userId) {
    const student = await resolveStudentByUserId(userId);

    if (!student?.student_id) {
        throw createHttpError(404, 'No student profile is linked to this account.');
    }

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
        .eq('student_id', student.student_id)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return {
        items: (data || []).map(mapSupportTicketRow),
    };
}

async function createTicket(userId, body = {}) {
    const student = await resolveStudentByUserId(userId);

    if (!student?.student_id) {
        throw createHttpError(404, 'No student profile is linked to this account.');
    }

    const issueCategory = safeText(body.issue_category || body.issueCategory);
    const description = safeText(body.description);

    if (!issueCategory) {
        throw createHttpError(400, 'issue_category is required.');
    }

    if (issueCategory.length > 50) {
        throw createHttpError(400, 'issue_category must be 50 characters or fewer.');
    }

    if (!description) {
        throw createHttpError(400, 'description is required.');
    }

    const { data, error } = await supabase
        .from('support_tickets')
        .insert({
            student_id: student.student_id,
            issue_category: issueCategory,
            description,
            status: 'Open',
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

    return {
        message: 'Support ticket created successfully.',
        data: mapSupportTicketRow(data),
    };
}

async function getAllTickets(authUser = {}) {
    if (!isSupportAdmin(authUser)) {
        throw createHttpError(403, 'Only staff accounts can access support tickets.');
    }

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
      resolved_at,
      students!support_tickets_student_id_fkey (
        student_id,
        first_name,
        last_name,
        pdm_id
      ),
      admin_profiles!support_tickets_handled_by_fkey (
        admin_id,
        first_name,
        last_name
      )
    `)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return {
        items: (data || []).map(mapSupportTicketRow),
    };
}

async function updateTicket({ authUser = {}, ticketId, body = {} }) {
    if (!isSupportAdmin(authUser)) {
        throw createHttpError(403, 'Only staff accounts can update support tickets.');
    }

    if (!ticketId) {
        throw createHttpError(400, 'ticketId is required.');
    }

    const nextStatusRaw = body.status;
    const nextStatus =
        nextStatusRaw === null || nextStatusRaw === undefined
            ? null
            : safeText(nextStatusRaw);

    const assignToSelf = body.assignToSelf === true;
    const adminId = await resolveAdminId(authUser);

    if (!adminId && assignToSelf) {
        throw createHttpError(400, 'Your account is missing an admin profile link.');
    }

    if (!nextStatus && !assignToSelf) {
        throw createHttpError(400, 'Provide a status or set assignToSelf to true.');
    }

    if (nextStatus && !SUPPORT_TICKET_STATUSES.includes(nextStatus)) {
        throw createHttpError(
            400,
            `status must be one of: ${SUPPORT_TICKET_STATUSES.join(', ')}.`
        );
    }

    const updatePayload = {};

    if (nextStatus) {
        updatePayload.status = nextStatus;

        if (nextStatus === 'Resolved' || nextStatus === 'Closed') {
            updatePayload.resolved_at = new Date().toISOString();
        }

        if ((nextStatus === 'Open' || nextStatus === 'In Progress') && !assignToSelf) {
            updatePayload.resolved_at = null;
        }

        if (nextStatus !== 'Open' && adminId) {
            updatePayload.handled_by = adminId;
        }
    }

    if (assignToSelf) {
        updatePayload.handled_by = adminId;

        if (!nextStatus) {
            updatePayload.resolved_at = null;
        }
    }

    const { data, error } = await supabase
        .from('support_tickets')
        .update(updatePayload)
        .eq('ticket_id', ticketId)
        .select(`
      ticket_id,
      student_id,
      issue_category,
      description,
      status,
      handled_by,
      created_at,
      resolved_at,
      students!support_tickets_student_id_fkey (
        student_id,
        first_name,
        last_name,
        pdm_id
      ),
      admin_profiles!support_tickets_handled_by_fkey (
        admin_id,
        first_name,
        last_name
      )
    `)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw createHttpError(404, 'Support ticket not found.');
    }

    return {
        message: 'Support ticket updated successfully.',
        data: mapSupportTicketRow(data),
    };
}

module.exports = {
    getMyTickets,
    createTicket,
    getAllTickets,
    updateTicket,
};