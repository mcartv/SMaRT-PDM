// Extracted support ticket helpers
function isSupportAdmin(req) {
  return !!(
    req.user?.adminId ||
    req.user?.admin_id ||
    ['admin', 'sdo'].includes((req.user?.role || '').toString().toLowerCase())
  );
}

function mapSupportTicketRow(row = {}) {
  const studentProfile = row.students || {};
  const handlerProfile = row.admin_profiles || {};
  const studentFirstName = studentProfile.first_name || '';
  const studentLastName = studentProfile.last_name || '';
  const handlerFirstName = handlerProfile.first_name || '';
  const handlerLastName = handlerProfile.last_name || '';

  return {
    ticket_id: row.ticket_id,
    student_id: row.student_id,
    issue_category: row.issue_category || '',
    description: row.description || '',
    status: row.status || 'Open',
    handled_by: row.handled_by || null,
    created_at: row.created_at || null,
    resolved_at: row.resolved_at || null,
    student_number: studentProfile.pdm_id || null,
    student_name: [studentFirstName, studentLastName].filter(Boolean).join(' ').trim() || null,
    handler_name: [handlerFirstName, handlerLastName].filter(Boolean).join(' ').trim() || null,
  };
}

async function listSupportTicketsForStudent(studentId) {
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
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapSupportTicketRow);
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

  if (error) {
    throw error;
  }

  return (data || []).map(mapSupportTicketRow);
}

async function resolveScholarRecordForStudent(studentId) {
  if (!studentId) {
    return null;
  }

  const { data, error } = await supabase
    .from('scholars')
    .select('scholar_id, student_id, application_id, program_id, status, is_archived')
    .eq('student_id', studentId)
    .eq('status', 'Active')
    .eq('is_archived', false)
    .order('date_awarded', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function resolveHasScholarAccessForStudent(studentId) {
  const scholarRecord = await resolveScholarRecordForStudent(studentId);
  return !!scholarRecord;
}
