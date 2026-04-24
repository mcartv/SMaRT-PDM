// Extracted support ticket routes
app.get('/api/support-tickets/me', protect, async (req, res) => {
  try {
    const studentRecord = await resolveStudentByUserId(getRequestUserId(req));

    if (!studentRecord?.student_id) {
      return res.status(404).json({
        error: 'No student profile is linked to this account.',
      });
    }

    const items = await listSupportTicketsForStudent(studentRecord.student_id);
    res.status(200).json({ items });
  } catch (error) {
    console.error('SUPPORT TICKETS ME ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load your support tickets.',
    });
  }
});

app.post('/api/support-tickets', protect, async (req, res) => {
  try {
    const studentRecord = await resolveStudentByUserId(getRequestUserId(req));

    if (!studentRecord?.student_id) {
      return res.status(404).json({
        error: 'No student profile is linked to this account.',
      });
    }

    const issueCategory = (req.body?.issue_category || '').toString().trim();
    const description = (req.body?.description || '').toString().trim();

    if (!issueCategory) {
      return res.status(400).json({ error: 'issue_category is required.' });
    }

    if (issueCategory.length > 50) {
      return res.status(400).json({
        error: 'issue_category must be 50 characters or fewer.',
      });
    }

    if (!description) {
      return res.status(400).json({ error: 'description is required.' });
    }

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

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Support ticket created successfully.',
      data: mapSupportTicketRow(data),
    });
  } catch (error) {
    console.error('SUPPORT TICKET CREATE ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to create support ticket.',
    });
  }
});

app.get('/api/support-tickets', protect, async (req, res) => {
  try {
    if (!isSupportAdmin(req)) {
      return res.status(403).json({
        error: 'Only staff accounts can access support tickets.',
      });
    }

    const items = await listSupportTicketsForAdmin();
    res.status(200).json({ items });
  } catch (error) {
    console.error('SUPPORT TICKET LIST ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load support tickets.',
    });
  }
});

app.patch('/api/support-tickets/:ticketId', protect, async (req, res) => {
  try {
    if (!isSupportAdmin(req)) {
      return res.status(403).json({
        error: 'Only staff accounts can update support tickets.',
      });
    }

    const nextStatusRaw = req.body?.status;
    const nextStatus = nextStatusRaw == null ? null : nextStatusRaw.toString().trim();
    const assignToSelf = req.body?.assignToSelf === true;
    const adminId = req.user?.adminId || req.user?.admin_id || null;

    if (!adminId && assignToSelf) {
      return res.status(400).json({
        error: 'Your account is missing an admin profile link.',
      });
    }

    if (!nextStatus && !assignToSelf) {
      return res.status(400).json({
        error: 'Provide a status or set assignToSelf to true.',
      });
    }

    if (nextStatus && !SUPPORT_TICKET_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        error: `status must be one of: ${SUPPORT_TICKET_STATUSES.join(', ')}.`,
      });
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
      .eq('ticket_id', req.params.ticketId)
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

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Support ticket not found.' });
    }

    res.status(200).json({
      message: 'Support ticket updated successfully.',
      data: mapSupportTicketRow(data),
    });
  } catch (error) {
    console.error('SUPPORT TICKET UPDATE ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to update support ticket.',
    });
  }
});

