let bridgeStarted = false;
let bridgeChannel = null;

function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeValue(value) {
  return safeText(value);
}

function normalizeId(value) {
  return safeText(value);
}

function uniqueIds(...values) {
  return [
    ...new Set(
      values
        .flat()
        .map((value) => normalizeId(value))
        .filter(Boolean)
    ),
  ];
}

function emitPublic(io, eventName, payload) {
  if (!io) return;

  const finalPayload = {
    ...payload,
    emitted_at: new Date().toISOString(),
  };

  console.log('[Realtime Bridge] public emit:', eventName, finalPayload);
  io.emit(eventName, finalPayload);
}

function emitToUser(io, userId, eventName, payload) {
  if (!io) return;

  const normalizedUserId = normalizeId(userId);

  if (!normalizedUserId) return;

  const finalPayload = {
    ...payload,
    emitted_at: new Date().toISOString(),
  };

  console.log('[Realtime Bridge] user emit:', {
    userId: normalizedUserId,
    room: `user:${normalizedUserId}`,
    eventName,
    messageId: finalPayload.message_id || finalPayload.messageId || null,
  });

  io.to(`user:${normalizedUserId}`).emit(eventName, finalPayload);
}

function emitToUsers(io, userIds = [], eventName, payload) {
  const targetUserIds = uniqueIds(userIds);

  for (const userId of targetUserIds) {
    emitToUser(io, userId, eventName, payload);
  }
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

function handleApplicationChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
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

function handleApplicationDocumentChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
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

function handleEndorsementSlipChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
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
    console.error('[Realtime Bridge] room member fetch error:', error.message);
    return [];
  }

  return (data || [])
    .map((row) => row.user_id)
    .filter(Boolean);
}

async function fetchUserSummary(supabase, userId) {
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from('users')
    .select(`
      user_id,
      role,
      email,
      students (
        student_id,
        pdm_id,
        first_name,
        middle_name,
        last_name,
        profile_photo_url
      ),
      admin_profiles (
        admin_id,
        first_name,
        last_name
      )
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Realtime Bridge] user summary fetch error:', error.message);
    return null;
  }

  if (!data) return null;

  const student = Array.isArray(data.students) ? data.students[0] : data.students;
  const adminProfile = Array.isArray(data.admin_profiles)
    ? data.admin_profiles[0]
    : data.admin_profiles;

  const displayName = student
    ? [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    : adminProfile
      ? [adminProfile.first_name, adminProfile.last_name]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      : data.email || 'Unknown User';

  return {
    user_id: data.user_id,
    role: data.role || '',
    email: data.email || '',
    display_name: displayName || 'Unknown User',
    student_number: student?.pdm_id || '',
    profile_photo_url: student?.profile_photo_url || null,
  };
}

async function buildMessagePayload(supabase, row = {}) {
  const senderSummary = await fetchUserSummary(supabase, row.sender_id);

  return {
    messageId: row.message_id,
    message_id: row.message_id,

    senderId: row.sender_id,
    sender_id: row.sender_id,

    receiverId: row.receiver_id || null,
    receiver_id: row.receiver_id || null,

    roomId: row.room_id || null,
    room_id: row.room_id || null,

    subject: row.subject || null,

    messageBody: row.message_body || '',
    message_body: row.message_body || '',

    sentAt: row.sent_at,
    sent_at: row.sent_at,

    isRead: row.is_read === true,
    is_read: row.is_read === true,

    attachmentUrl: row.attachment_url || null,
    attachment_url: row.attachment_url || null,

    senderName: senderSummary?.display_name || '',
    sender_name: senderSummary?.display_name || '',

    senderProfilePhotoUrl: senderSummary?.profile_photo_url || null,
    sender_profile_photo_url: senderSummary?.profile_photo_url || null,

    senderAvatarUrl: senderSummary?.profile_photo_url || null,
    sender_avatar_url: senderSummary?.profile_photo_url || null,

    created_at: new Date().toISOString(),
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

  const eventPayload = await buildMessagePayload(supabase, row);

  let targetUserIds = [];

  if (row.room_id) {
    const memberIds = await fetchRoomMemberIds(supabase, row.room_id);
    targetUserIds = uniqueIds(memberIds, row.sender_id);
  } else {
    targetUserIds = uniqueIds(row.sender_id, row.receiver_id);
  }

  if (!targetUserIds.length) {
    console.warn('[Realtime Bridge] message emit skipped: no target users');
    return;
  }

  if (eventType === 'INSERT') {
    /*
      Emit both names because the frontend currently listens to both:
      - message:new
      - message:created
    */
    console.log('[Realtime Bridge] emitting message INSERT:', {
      messageId,
      targetUserIds,
    });

    emitToUsers(io, targetUserIds, 'message:new', eventPayload);
    emitToUsers(io, targetUserIds, 'message:created', eventPayload);
    return;
  }

  if (eventType === 'UPDATE') {
    if (row.is_read === true) {
      console.log('[Realtime Bridge] emitting message READ:', {
        messageId,
        targetUserIds,
      });

      emitToUsers(io, targetUserIds, 'message:read', {
        ...eventPayload,
        message_ids: [messageId],
        messageIds: [messageId],
        updated_at: new Date().toISOString(),
      });
      return;
    }

    console.log('[Realtime Bridge] emitting message UPDATE:', {
      messageId,
      targetUserIds,
    });

    emitToUsers(io, targetUserIds, 'message:updated', eventPayload);
    return;
  }

  if (eventType === 'DELETE') {
    console.log('[Realtime Bridge] emitting message DELETE:', {
      messageId,
      targetUserIds,
    });

    emitToUsers(io, targetUserIds, 'message:deleted', eventPayload);
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

  console.log('[Realtime Bridge Boot Check]', {
    bridgeStarted,
    hasIo: Boolean(io),
    hasSupabase: Boolean(supabase),
    hasChannel: Boolean(supabase?.channel),
  });

  supabase
    .from('messages')
    .select('message_id, sender_id, receiver_id, room_id, sent_at')
    .order('sent_at', { ascending: false })
    .limit(1)
    .then(({ data, error }) => {
      console.log('[Realtime Bridge DB Check]', {
        error: error?.message || null,
        latestMessage: data?.[0] || null,
      });
    });

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
      { event: '*', schema: 'public', table: 'messages' },
      async (payload) => {
        try {
          await handleMessageChange(io, supabase, payload);
        } catch (error) {
          console.error('[Realtime Bridge] message handler error:', error);
        }
      }
    )
    .subscribe((status, error) => {
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