let bridgeStarted = false;
let bridgeChannel = null;

function normalizeValue(value) {
  return value == null ? '' : String(value).trim();
}

function emitPublic(io, eventName, payload) {
  if (!io) return;
  io.emit(eventName, payload);
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

  emitPublic(io, 'application-document:uploaded', {
    application_id: document.application_id,
    document_key: document.document_type,
    document_name: document.document_type,
    document_status: document.review_status,
    updated_at: document.updated_at,
    source: 'application_document',
    event_type: eventType,
  });

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

async function fetchRoomMemberIds(supabase, roomId) {
  if (!supabase || !roomId) return [];

  const { data, error } = await supabase
    .from('chat_room_members')
    .select('user_id')
    .eq('room_id', roomId);

  if (error) {
    console.error('[Realtime Bridge] room member fetch error:', error);
    return [];
  }

  return (data || [])
    .map((row) => row.user_id)
    .filter(Boolean);
}

function buildMessagePayload(row = {}) {
  return {
    messageId: row.message_id,
    message_id: row.message_id,

    senderId: row.sender_id,
    sender_id: row.sender_id,

    receiverId: row.receiver_id,
    receiver_id: row.receiver_id,

    roomId: row.room_id,
    room_id: row.room_id,

    subject: row.subject || null,

    messageBody: row.message_body || '',
    message_body: row.message_body || '',

    sentAt: row.sent_at,
    sent_at: row.sent_at,

    isRead: row.is_read === true,
    is_read: row.is_read === true,

    attachmentUrl: row.attachment_url || null,
    attachment_url: row.attachment_url || null,
  };
}

async function handleMessageChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};

  const row = eventType === 'DELETE' ? old : next;
  const messageId = row.message_id;

  console.log('[Realtime Bridge] messages change:', {
    eventType,
    messageId,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    roomId: row.room_id,
  });

  if (!messageId) {
    console.warn('[Realtime Bridge] message change skipped: missing message_id');
    return;
  }

  let eventName = 'message:updated';

  if (eventType === 'INSERT') {
    eventName = 'message:new';
  }

  if (eventType === 'UPDATE') {
    eventName = row.is_read === true ? 'message:read' : 'message:updated';
  }

  if (eventType === 'DELETE') {
    eventName = 'message:deleted';
  }

  const eventPayload = buildMessagePayload(row);

  console.log('[Socket Emit Message]', eventName, eventPayload);

  if (row.room_id) {
    io.to(`group:${row.room_id}`).emit(eventName, eventPayload);

    const memberIds = await fetchRoomMemberIds(supabase, row.room_id);

    for (const memberId of memberIds) {
      io.to(`user:${memberId}`).emit(eventName, eventPayload);
    }

    return;
  }

  if (row.sender_id) {
    io.to(`user:${row.sender_id}`).emit(eventName, eventPayload);
  }

  if (row.receiver_id) {
    io.to(`user:${row.receiver_id}`).emit(eventName, eventPayload);
  }
}

function configureRealtimeBridge({ io, supabase }) {
  if (bridgeStarted) {
    return bridgeChannel;
  }

  if (!io || !supabase?.channel) {
    console.warn('Realtime bridge skipped: missing io or supabase channel support.');
    return null;
  }

  bridgeStarted = true;

  bridgeChannel = supabase
    .channel('admin-realtime-bridge')
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
      {
        event: '*',
        schema: 'public',
        table: 'messages',
      },
      (payload) => handleMessageChange(io, supabase, payload)
    );

  bridgeChannel.subscribe((status, error) => {
    if (error) {
      console.error('ADMIN REALTIME BRIDGE SUBSCRIBE ERROR:', error);
      return;
    }

    console.log('Admin realtime bridge status:', status);
  });

  return bridgeChannel;
}

module.exports = {
  configureRealtimeBridge,
};
