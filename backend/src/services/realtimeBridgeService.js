let bridgeStarted = false;
let bridgeChannel = null;

function normalizeValue(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeNotificationRow(row = {}) {
  return {
    notificationId: row.notification_id?.toString() || '',
    userId: row.user_id?.toString() || '',
    type: row.type?.toString() || 'Notification',
    title: row.title?.toString() || 'Notification',
    message: row.message?.toString() || '',
    referenceId: row.reference_id?.toString() || null,
    referenceType: row.reference_type?.toString() || null,
    isRead: row.is_read === true,
    pushSent: row.push_sent === true,
    createdAt: row.created_at?.toString() || new Date().toISOString(),
  };
}

function normalizeMessageRow(row = {}) {
  return {
    message_id: row.message_id?.toString() || '',
    sender_id: row.sender_id?.toString() || '',
    receiver_id: row.receiver_id?.toString() || '',
    room_id: row.room_id?.toString() || '',
    subject: row.subject?.toString() || null,
    message_body: row.message_body?.toString() || '',
    sent_at: row.sent_at?.toString() || row.created_at?.toString() || new Date().toISOString(),
    is_read: row.is_read === true,
    attachment_url: row.attachment_url?.toString() || null,
  };
}

function emitToUser(io, userId, eventName, payload) {
  const normalizedUserId = normalizeValue(userId);
  if (!io || !normalizedUserId) return;
  io.to(`user:${normalizedUserId}`).emit(eventName, payload);
}

function emitToUsers(io, userIds = [], eventName, payload) {
  const uniqueIds = [...new Set(userIds.map(normalizeValue).filter(Boolean))];
  uniqueIds.forEach((userId) => emitToUser(io, userId, eventName, payload));
}

function emitPublic(io, eventName, payload) {
  if (!io) return;
  io.emit(eventName, payload);
}

async function emitRoomMessage(io, supabase, message) {
  const roomId = normalizeValue(message.room_id);
  if (!roomId) return;

  const { data, error } = await supabase
    .from('chat_room_members')
    .select('user_id')
    .eq('room_id', roomId);

  if (error) {
    console.error('REALTIME ROOM MEMBER FETCH ERROR:', error);
    return;
  }

  const memberIds = (data || [])
    .map((row) => row.user_id?.toString() || '')
    .filter(Boolean);

  emitToUsers(io, memberIds, 'message:new', message);
}

async function emitRoomRead(io, supabase, payload) {
  const roomId = normalizeValue(payload.roomId);
  if (!roomId) return;

  const { data, error } = await supabase
    .from('chat_room_members')
    .select('user_id')
    .eq('room_id', roomId);

  if (error) {
    console.error('REALTIME ROOM READ MEMBER FETCH ERROR:', error);
    return;
  }

  const memberIds = (data || [])
    .map((row) => row.user_id?.toString() || '')
    .filter(Boolean);

  emitToUsers(io, memberIds, 'message:read', payload);
}

function buildOpeningPayload(row = {}) {
  return {
    opening_id: row.opening_id?.toString() || '',
    opening_title: row.opening_title?.toString() || '',
    posting_status: row.posting_status?.toString() || '',
    is_archived: row.is_archived === true,
    updated_at:
      row.updated_at?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

function buildAnnouncementPayload(row = {}) {
  return {
    announcement_id: row.announcement_id?.toString() || '',
    subject: row.subject?.toString() || '',
    status: row.status?.toString() || '',
    is_archived: row.is_archived === true,
    updated_at:
      row.updated_at?.toString() ||
      row.published_at?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

function buildPayoutPayload(row = {}) {
  return {
    payout_batch_id: row.payout_batch_id?.toString() || '',
    opening_id: row.opening_id?.toString() || '',
    payout_title: row.payout_title?.toString() || '',
    batch_status: row.batch_status?.toString() || '',
    is_archived: row.is_archived === true,
    updated_at:
      row.updated_at?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

function buildApplicationPayload(row = {}) {
  return {
    application_id: row.application_id?.toString() || '',
    student_id: row.student_id?.toString() || '',
    opening_id: row.opening_id?.toString() || '',
    program_id: row.program_id?.toString() || '',
    status: row.application_status?.toString() || row.status?.toString() || '',
    remarks: row.remarks?.toString() || null,
    updated_at:
      row.updated_at?.toString() ||
      row.reviewed_at?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

function buildApplicationDocumentPayload(row = {}) {
  return {
    document_id: row.document_id?.toString() || '',
    application_id: row.application_id?.toString() || '',
    document_type: row.document_type?.toString() || '',
    review_status: row.review_status?.toString() || row.status?.toString() || '',
    is_submitted: row.is_submitted === true,
    updated_at:
      row.updated_at?.toString() ||
      row.reviewed_at?.toString() ||
      row.uploaded_at?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

function buildEndorsementPayload(row = {}) {
  return {
    slip_id: row.slip_id?.toString() || '',
    application_id: row.application_id?.toString() || '',
    student_id: row.student_id?.toString() || '',
    current_stage: row.current_stage?.toString() || '',
    overall_status: row.overall_status?.toString() || '',
    updated_at:
      row.updated_at?.toString() ||
      row.completed_at?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

function buildRenewalPayload(row = {}) {
  return {
    renewal_id: row.renewal_id?.toString() || '',
    scholar_id: row.scholar_id?.toString() || row.student_id?.toString() || '',
    student_id: row.student_id?.toString() || row.scholar_id?.toString() || '',
    renewal_status: row.status?.toString() || row.renewal_status?.toString() || '',
    updated_at:
      row.updated_at?.toString() ||
      row.submitted_at?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

function buildTicketPayload(row = {}) {
  return {
    ticket_id: row.ticket_id?.toString() || '',
    student_id: row.student_id?.toString() || '',
    status: row.status?.toString() || '',
    issue_category: row.issue_category?.toString() || '',
    updated_at:
      row.updated_at?.toString() ||
      row.resolved_at?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

function buildRoPayload(row = {}) {
  return {
    ro_id: row.ro_id?.toString() || '',
    scholar_id: row.scholar_id?.toString() || row.student_id?.toString() || '',
    student_id: row.student_id?.toString() || row.scholar_id?.toString() || '',
    ro_status: row.ro_status?.toString() || '',
    required_hours: Number(row.required_hours || 0),
    rendered_hours: Number(row.rendered_hours || 0),
    department_assigned: row.department_assigned?.toString() || '',
    updated_at:
      row.updated_at?.toString() ||
      row.submitted_at?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

async function handleNotificationChange(io, payload) {
  const eventType = payload.eventType;

  if (eventType === 'INSERT') {
    const notification = normalizeNotificationRow(payload.new);
    emitToUser(io, notification.userId, 'notification:new', notification);
    return;
  }

  if (eventType === 'UPDATE') {
    const notification = normalizeNotificationRow(payload.new);
    emitToUser(io, notification.userId, 'notification:updated', notification);
    return;
  }

  if (eventType === 'DELETE') {
    const notification = normalizeNotificationRow(payload.old);
    emitToUser(io, notification.userId, 'notification:deleted', {
      notificationId: notification.notificationId,
    });
  }
}

async function handleMessageChange(io, supabase, payload) {
  const eventType = payload.eventType;

  if (eventType === 'INSERT') {
    const message = normalizeMessageRow(payload.new);

    if (normalizeValue(message.room_id)) {
      await emitRoomMessage(io, supabase, message);
      return;
    }

    emitToUsers(
      io,
      [message.sender_id, message.receiver_id],
      'message:new',
      message
    );
    return;
  }

  if (eventType !== 'UPDATE') {
    return;
  }

  const oldRow = payload.old || {};
  const newRow = payload.new || {};

  if (newRow.is_read !== true || oldRow.is_read === true) {
    return;
  }

  const readPayload = {
    readerId: newRow.receiver_id?.toString() || '',
    counterpartyId: newRow.sender_id?.toString() || '',
    roomId: newRow.room_id?.toString() || '',
    messageIds: [newRow.message_id?.toString() || ''].filter(Boolean),
  };

  if (normalizeValue(readPayload.roomId)) {
    await emitRoomRead(io, supabase, readPayload);
    return;
  }

  emitToUsers(
    io,
    [newRow.sender_id, newRow.receiver_id],
    'message:read',
    readPayload
  );
}

function handleOpeningChange(io, payload) {
  const eventType = payload.eventType;
  const nextRow = payload.new || {};
  const previousRow = payload.old || {};
  const opening = buildOpeningPayload(nextRow.opening_id ? nextRow : previousRow);

  if (eventType === 'INSERT') {
    emitPublic(io, 'opening:created', opening);
    return;
  }

  if (eventType !== 'UPDATE') {
    return;
  }

  emitPublic(io, 'opening:updated', opening);

  const movedToClosed =
    normalizeValue(previousRow.posting_status).toLowerCase() !== 'closed' &&
    normalizeValue(nextRow.posting_status).toLowerCase() === 'closed';
  const movedToArchived = previousRow.is_archived !== true && nextRow.is_archived === true;

  if (movedToClosed || movedToArchived) {
    emitPublic(io, 'opening:closed', opening);
  }
}

function handleAnnouncementChange(io, payload) {
  const eventType = payload.eventType;
  const nextRow = payload.new || {};
  const previousRow = payload.old || {};
  const announcement = buildAnnouncementPayload(
    nextRow.announcement_id ? nextRow : previousRow
  );

  const isPublished = (row) =>
    normalizeValue(row.status).toLowerCase() === 'published' &&
    row.is_archived !== true;

  if (eventType === 'INSERT') {
    if (isPublished(nextRow)) {
      emitPublic(io, 'announcement:created', announcement);
    }
    return;
  }

  if (eventType === 'DELETE') {
    emitPublic(io, 'announcement:deleted', announcement);
    return;
  }

  if (eventType !== 'UPDATE') {
    return;
  }

  if (nextRow.is_archived === true) {
    emitPublic(io, 'announcement:deleted', announcement);
    return;
  }

  if (!isPublished(previousRow) && isPublished(nextRow)) {
    emitPublic(io, 'announcement:created', announcement);
    return;
  }

  if (isPublished(nextRow)) {
    emitPublic(io, 'announcement:updated', announcement);
  }
}

function handlePayoutBatchChange(io, payload) {
  const eventType = payload.eventType;
  const nextRow = payload.new || {};
  const previousRow = payload.old || {};
  const payout = buildPayoutPayload(nextRow.payout_batch_id ? nextRow : previousRow);

  if (eventType === 'INSERT') {
    emitPublic(io, 'payout:created', payout);
    return;
  }

  if (eventType !== 'UPDATE') {
    return;
  }

  if (previousRow.is_archived !== true && nextRow.is_archived === true) {
    emitPublic(io, 'payout:deleted', payout);
    return;
  }

  emitPublic(io, 'payout:updated', payout);
}

function handlePayoutEntryChange(io, payload) {
  if (payload.eventType !== 'UPDATE') {
    return;
  }

  const previousStatus = normalizeValue(payload.old?.release_status);
  const nextStatus = normalizeValue(payload.new?.release_status);

  if (!nextStatus || previousStatus === nextStatus) {
    return;
  }

  emitPublic(io, 'payout:updated', {
    payout_batch_id: payload.new?.payout_batch_id?.toString() || '',
    payout_entry_id: payload.new?.payout_entry_id?.toString() || '',
    release_status: nextStatus,
    updated_at: payload.new?.updated_at?.toString() || new Date().toISOString(),
  });

  if (nextStatus.toLowerCase() === 'released') {
    emitPublic(io, 'scholar:released', {
      payout_batch_id: payload.new?.payout_batch_id?.toString() || '',
      payout_entry_id: payload.new?.payout_entry_id?.toString() || '',
      student_id: payload.new?.student_id?.toString() || '',
      release_status: nextStatus,
    });
  }
}

function handleApplicationChange(io, payload) {
  const eventType = payload.eventType;
  const nextRow = payload.new || {};
  const previousRow = payload.old || {};
  const application = buildApplicationPayload(
    nextRow.application_id ? nextRow : previousRow
  );

  if (eventType === 'INSERT') {
    emitPublic(io, 'application:updated', application);
    return;
  }

  if (eventType !== 'UPDATE') {
    return;
  }

  emitPublic(io, 'application:updated', application);

  const previousStatus = normalizeValue(previousRow.application_status).toLowerCase();
  const nextStatus = normalizeValue(nextRow.application_status).toLowerCase();

  if (nextStatus === 'approved' && previousStatus !== nextStatus) {
    emitPublic(io, 'application:approved', application);
    return;
  }

  if (
    ['rejected', 'disqualified', 'declined'].includes(nextStatus) &&
    previousStatus !== nextStatus
  ) {
    emitPublic(io, 'application:rejected', application);
  }
}

function handleApplicationDocumentChange(io, payload) {
  const eventType = payload.eventType;
  const nextRow = payload.new || {};
  const previousRow = payload.old || {};
  const document = buildApplicationDocumentPayload(
    nextRow.document_id ? nextRow : previousRow
  );

  if (!document.application_id) {
    return;
  }

  emitPublic(io, 'application:updated', {
    application_id: document.application_id,
    updated_at: document.updated_at,
    source: 'application_document',
    document_type: document.document_type,
    review_status: document.review_status,
    is_submitted: document.is_submitted,
    event_type: eventType,
  });
}

function handleEndorsementSlipChange(io, payload) {
  const eventType = payload.eventType;
  const nextRow = payload.new || {};
  const previousRow = payload.old || {};
  const endorsement = buildEndorsementPayload(
    nextRow.slip_id ? nextRow : previousRow
  );

  if (!endorsement.application_id) {
    return;
  }

  emitPublic(io, 'endorsement:updated', {
    ...endorsement,
    event_type: eventType,
  });

  emitPublic(io, 'application:updated', {
    application_id: endorsement.application_id,
    updated_at: endorsement.updated_at,
    source: 'endorsement',
    current_stage: endorsement.current_stage,
    overall_status: endorsement.overall_status,
    event_type: eventType,
  });
}

function handleRenewalChange(io, payload) {
  const eventType = payload.eventType;
  const nextRow = payload.new || {};
  const previousRow = payload.old || {};
  const renewal = buildRenewalPayload(nextRow.renewal_id ? nextRow : previousRow);

  if (eventType === 'INSERT') {
    emitPublic(io, 'renewal:updated', renewal);
    return;
  }

  if (eventType !== 'UPDATE') {
    return;
  }

  emitPublic(io, 'renewal:updated', renewal);

  const previousStatus = normalizeValue(previousRow.status || previousRow.renewal_status).toLowerCase();
  const nextStatus = normalizeValue(nextRow.status || nextRow.renewal_status).toLowerCase();

  if (nextStatus === 'approved' && previousStatus !== nextStatus) {
    emitPublic(io, 'renewal:approved', renewal);
  }
}

function handleSupportTicketChange(io, payload) {
  const eventType = payload.eventType;
  const nextRow = payload.new || {};
  const previousRow = payload.old || {};
  const ticket = buildTicketPayload(nextRow.ticket_id ? nextRow : previousRow);

  if (eventType === 'INSERT') {
    emitPublic(io, 'ticket:created', ticket);
    return;
  }

  if (eventType !== 'UPDATE') {
    return;
  }

  emitPublic(io, 'ticket:updated', ticket);

  const previousStatus = normalizeValue(previousRow.status).toLowerCase();
  const nextStatus = normalizeValue(nextRow.status).toLowerCase();

  if (
    ['resolved', 'closed'].includes(nextStatus) &&
    previousStatus !== nextStatus
  ) {
    emitPublic(io, 'ticket:resolved', ticket);
  }
}

function handleRoChange(io, payload) {
  const eventType = payload.eventType;
  const nextRow = payload.new || {};
  const previousRow = payload.old || {};
  const ro = buildRoPayload(nextRow.ro_id ? nextRow : previousRow);

  if (eventType === 'INSERT') {
    emitPublic(io, 'ro:updated', { ...ro, action: 'create' });
    return;
  }

  if (eventType === 'UPDATE') {
    emitPublic(io, 'ro:updated', { ...ro, action: 'update' });
  }
}

function handleRoSettingChange(io, payload) {
  const eventType = payload.eventType;
  if (eventType !== 'INSERT' && eventType !== 'UPDATE') {
    return;
  }

  emitPublic(io, 'ro:updated', {
    action: 'setting_update',
    updated_at:
      payload.new?.updated_at?.toString() ||
      payload.new?.created_at?.toString() ||
      new Date().toISOString(),
  });
}

function configureRealtimeBridge({ io, supabase }) {
  if (bridgeStarted || !io || !supabase) {
    return bridgeChannel;
  }

  bridgeStarted = true;

  bridgeChannel = supabase
    .channel('smart-pdm-realtime-bridge')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      (payload) => {
        handleNotificationChange(io, payload).catch((error) => {
          console.error('REALTIME NOTIFICATION BRIDGE ERROR:', error);
        });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      (payload) => {
        handleMessageChange(io, supabase, payload).catch((error) => {
          console.error('REALTIME MESSAGE BRIDGE ERROR:', error);
        });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'program_openings' },
      (payload) => {
        handleOpeningChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'announcements' },
      (payload) => {
        handleAnnouncementChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payout_batches' },
      (payload) => {
        handlePayoutBatchChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payout_batch_students' },
      (payload) => {
        handlePayoutEntryChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'applications' },
      (payload) => {
        handleApplicationChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'application_documents' },
      (payload) => {
        handleApplicationDocumentChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'endorsement_slips' },
      (payload) => {
        handleEndorsementSlipChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'renewals' },
      (payload) => {
        handleRenewalChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'support_tickets' },
      (payload) => {
        handleSupportTicketChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'return_of_obligations' },
      (payload) => {
        handleRoChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ro_settings' },
      (payload) => {
        handleRoSettingChange(io, payload);
      }
    );

  bridgeChannel.subscribe((status, error) => {
    if (error) {
      console.error('REALTIME BRIDGE SUBSCRIBE ERROR:', error);
      return;
    }

    console.log('Realtime bridge status:', status);
  });

  return bridgeChannel;
}

module.exports = {
  configureRealtimeBridge,
};
