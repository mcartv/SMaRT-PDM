const adminRealtimeRelayService = require('./adminRealtimeRelayService');

const MESSAGE_FIELDS =
  'message_id, sender_id, receiver_id, room_id, subject, message_body, sent_at, is_read, attachment_url';

const FETCH_PAGE_SIZE = 1000;

const ALLOWED_ADMIN_ROLES = new Set([
  'admin',
  'osfa_admin',
  'sdo',
  'guidance',
  'pd',
]);

let ioRef = null;
let supabaseRef = null;
let fixedAdminUserIdPromise = null;

function configureMessageService({ io, supabase }) {
  ioRef = io;
  supabaseRef = supabase;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getSupabase() {
  if (!supabaseRef) {
    throw new Error('Message service is not configured with Supabase.');
  }

  return supabaseRef;
}

function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeText(value) {
  return safeText(value).toLowerCase();
}

function emitToUser(userId, eventName, payload) {
  if (!ioRef) {
    console.warn('[MessageService Emit] skipped: ioRef missing');
    return;
  }

  if (!userId) {
    console.warn('[MessageService Emit] skipped: userId missing', {
      eventName,
      payload,
    });
    return;
  }

  if (!eventName) {
    console.warn('[MessageService Emit] skipped: eventName missing', {
      userId,
      payload,
    });
    return;
  }

  console.log('[MessageService Emit User]', {
    room: `user:${userId}`,
    eventName,
    messageId: payload?.messageId || payload?.message_id,
    senderId: payload?.senderId || payload?.sender_id,
    receiverId: payload?.receiverId || payload?.receiver_id,
  });

  ioRef.to(`user:${userId}`).emit(eventName, payload);
}

function emitToGroup(roomId, eventName, payload) {
  if (!ioRef) {
    console.warn('[MessageService Emit Group] skipped: ioRef missing');
    return;
  }

  if (!roomId) {
    console.warn('[MessageService Emit Group] skipped: roomId missing', {
      eventName,
      payload,
    });
    return;
  }

  if (!eventName) {
    console.warn('[MessageService Emit Group] skipped: eventName missing', {
      roomId,
      payload,
    });
    return;
  }

  console.log('[MessageService Emit Group]', {
    room: `group:${roomId}`,
    eventName,
    messageId: payload?.messageId || payload?.message_id,
    senderId: payload?.senderId || payload?.sender_id,
  });

  ioRef.to(`group:${roomId}`).emit(eventName, payload);
}


function relayToAdminBackend(message) {
  adminRealtimeRelayService.relayMessageCreated(message).catch((error) => {
    console.error('[Admin Realtime Relay] async error:', error.message);
  });
}

function mapMessageRow(row = {}, profiles = null) {
  const profile = profiles ? profiles.get(row.sender_id) : null;

  return {
    messageId: row.message_id,
    message_id: row.message_id,

    senderId: row.sender_id,
    sender_id: row.sender_id,

    receiverId: row.receiver_id,
    receiver_id: row.receiver_id,

    roomId: row.room_id,
    room_id: row.room_id,

    subject: row.subject,
    messageBody: row.message_body,
    message_body: row.message_body,

    sentAt: row.sent_at,
    sent_at: row.sent_at,

    isRead: !!row.is_read,
    is_read: !!row.is_read,

    attachmentUrl: row.attachment_url,
    attachment_url: row.attachment_url,

    senderName: profile?.name || null,
    sender_name: profile?.name || null,

    senderAvatarUrl: profile?.avatarUrl || null,
    sender_avatar_url: profile?.avatarUrl || null,
  };
}

function normalizeMessageBody(messageBody = '') {
  return String(messageBody || '').trim();
}

function validateConversationMessageBody(messageBody = '') {
  const trimmedBody = normalizeMessageBody(messageBody);

  if (!trimmedBody) {
    throw createHttpError(400, 'messageBody is required.');
  }

  if (trimmedBody.length > 5000) {
    throw createHttpError(400, 'messageBody is too long.');
  }

  return trimmedBody;
}

function buildThreadFilter(leftUserId, rightUserId) {
  return `and(sender_id.eq.${leftUserId},receiver_id.eq.${rightUserId}),and(sender_id.eq.${rightUserId},receiver_id.eq.${leftUserId})`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function adminProfileLooksActive(adminProfile) {
  if (!adminProfile) return false;
  return adminProfile.is_archived !== true;
}

function userLooksAdmin(user = {}, adminProfile = null) {
  const normalizedRole = normalizeText(user.role);
  const normalizedDepartment = normalizeText(adminProfile?.department);
  const normalizedPosition = normalizeText(adminProfile?.position);

  return (
    ALLOWED_ADMIN_ROLES.has(normalizedRole) ||
    normalizedDepartment.includes('osfa') ||
    normalizedDepartment.includes('admin') ||
    normalizedPosition.includes('admin') ||
    normalizedPosition.includes('officer')
  );
}

async function resolveFixedAdminUserId({ forceRefresh = false } = {}) {
  if (!forceRefresh && fixedAdminUserIdPromise) {
    return fixedAdminUserIdPromise;
  }

  fixedAdminUserIdPromise = (async () => {
    const configuredUserId = safeText(process.env.MESSAGING_ADMIN_USER_ID);

    if (!configuredUserId) {
      throw createHttpError(500, 'MESSAGING_ADMIN_USER_ID is not configured.');
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('users')
      .select(`
        user_id,
        email,
        role,
        admin_profiles (
          user_id,
          department,
          position,
          is_archived
        )
      `)
      .eq('user_id', configuredUserId)
      .maybeSingle();

    if (error) {
      console.error('MESSAGE ADMIN LOOKUP ERROR:', error);
      throw new Error(error.message);
    }

    if (!data?.user_id) {
      throw createHttpError(
        500,
        'Configured messaging admin user was not found.'
      );
    }

    const adminProfile = Array.isArray(data.admin_profiles)
      ? data.admin_profiles[0]
      : data.admin_profiles || null;

    if (!adminProfileLooksActive(adminProfile)) {
      throw createHttpError(
        500,
        'Configured messaging admin user is inactive or archived.'
      );
    }

    if (!userLooksAdmin(data, adminProfile)) {
      throw createHttpError(
        500,
        'Configured messaging user is not an authorized administrator.'
      );
    }

    return data.user_id;
  })();

  return fixedAdminUserIdPromise;
}

async function ensureMobileThreadActor(userId) {
  const normalizedUserId = safeText(userId);
  const adminUserId = await resolveFixedAdminUserId();

  if (!normalizedUserId) {
    throw createHttpError(401, 'Authentication required.');
  }

  if (normalizedUserId === adminUserId) {
    throw createHttpError(
      400,
      'The fixed admin account must use the admin conversations API.'
    );
  }

  return adminUserId;
}

async function resolveActiveAdminUser(userId) {
  const normalizedUserId = safeText(userId);

  if (!normalizedUserId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('users')
    .select(`
      user_id,
      role,
      admin_profiles (
        user_id,
        department,
        position,
        is_archived
      )
    `)
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  if (error) {
    console.error('MESSAGE ADMIN AUTH ERROR:', error);
    throw new Error(error.message);
  }

  const adminProfile = Array.isArray(data?.admin_profiles)
    ? data.admin_profiles[0]
    : data?.admin_profiles || null;

  if (!data?.user_id || !adminProfileLooksActive(adminProfile)) {
    throw createHttpError(403, 'This endpoint is restricted to administrators.');
  }

  if (!userLooksAdmin(data, adminProfile)) {
    throw createHttpError(403, 'This endpoint is restricted to administrators.');
  }

  return {
    userId: data.user_id,
    adminProfile,
  };
}

async function fetchConversationProfiles(counterpartyIds = []) {
  const ids = Array.from(
    new Set(
      counterpartyIds
        .map((item) => safeText(item))
        .filter((item) => item.length > 0)
    )
  );

  if (!ids.length) {
    return {
      userMap: new Map(),
      studentMap: new Map(),
    };
  }

  const supabase = getSupabase();

  const [usersResult, studentsResult] = await Promise.all([
    supabase
      .from('users')
      .select('user_id, email, username, role')
      .in('user_id', ids),

    supabase
      .from('students')
      .select('user_id, pdm_id, first_name, last_name, profile_photo_url')
      .in('user_id', ids),
  ]);

  if (usersResult.error) {
    console.error('MESSAGE USER PROFILE FETCH ERROR:', usersResult.error);
    throw new Error(usersResult.error.message);
  }

  if (studentsResult.error) {
    console.error('MESSAGE STUDENT PROFILE FETCH ERROR:', studentsResult.error);
    throw new Error(studentsResult.error.message);
  }

  return {
    userMap: new Map((usersResult.data || []).map((row) => [row.user_id, row])),
    studentMap: new Map(
      (studentsResult.data || []).map((row) => [row.user_id, row])
    ),
  };
}

function buildProfileDisplay(userId, { userMap, studentMap }) {
  const user = userMap.get(userId);
  const student = studentMap.get(userId);

  const studentName = [student?.first_name, student?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    name: studentName || user?.username || user?.email || 'Unknown user',
    studentNumber: student?.pdm_id || null,
    avatarUrl: student?.profile_photo_url || null,
    role: user?.role || null,
  };
}

function buildConversationPreview(
  counterpartyId,
  row,
  { userMap, studentMap },
  unreadCount
) {
  const display = buildProfileDisplay(counterpartyId, { userMap, studentMap });

  return {
    counterpartyId,
    counterparty_id: counterpartyId,

    name: display.name,
    studentNumber: display.studentNumber,
    student_number: display.studentNumber,

    role: display.role,

    avatarUrl: display.avatarUrl,
    avatar_url: display.avatarUrl,

    lastMessage: row?.message_body || '',
    last_message: row?.message_body || '',

    lastSentAt: row?.sent_at || null,
    last_sent_at: row?.sent_at || null,

    unreadCount,
    unread_count: unreadCount,
  };
}

async function fetchThreadMessages(leftUserId, rightUserId, { limit = 200 } = {}) {
  const supabase = getSupabase();
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);

  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_FIELDS)
    .is('room_id', null)
    .or(buildThreadFilter(leftUserId, rightUserId))
    .order('sent_at', { ascending: true })
    .order('message_id', { ascending: true })
    .limit(safeLimit);

  if (error) {
    console.error('MESSAGE THREAD FETCH ERROR:', error);
    throw new Error(error.message);
  }

  const profilesResult = await fetchConversationProfiles([leftUserId, rightUserId]);
  const combinedMap = new Map();

  profilesResult.userMap.forEach((user, id) => {
    const student = profilesResult.studentMap.get(id);

    const name =
      [student?.first_name, student?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      user.username ||
      user.email ||
      'Unknown';

    combinedMap.set(id, {
      name,
      avatarUrl: student?.profile_photo_url || null,
    });
  });

  return (data || []).map((row) => mapMessageRow(row, combinedMap));
}

async function fetchAllPrivateMessagesForUser(userId) {
  const supabase = getSupabase();
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('messages')
      .select(MESSAGE_FIELDS)
      .is('room_id', null)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('sent_at', { ascending: false })
      .order('message_id', { ascending: false })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) {
      console.error('MESSAGE USER FETCH ERROR:', error);
      throw new Error(error.message);
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < FETCH_PAGE_SIZE) {
      break;
    }

    from += FETCH_PAGE_SIZE;
  }

  return rows;
}

async function resolveConversationStudent(counterpartyId) {
  const normalizedCounterpartyId = safeText(counterpartyId);

  if (!normalizedCounterpartyId) {
    throw createHttpError(400, 'counterpartyId is required.');
  }

  if (!isUuid(normalizedCounterpartyId)) {
    throw createHttpError(400, 'counterpartyId must be a valid UUID.');
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('students')
    .select('user_id, student_id, pdm_id, first_name, last_name')
    .eq('user_id', normalizedCounterpartyId)
    .maybeSingle();

  if (error) {
    console.error('MESSAGE CONVERSATION STUDENT LOOKUP ERROR:', error);
    throw new Error(error.message);
  }

  if (!data?.user_id) {
    throw createHttpError(400, 'Counterparty student not found.');
  }

  return data;
}

async function fetchRoomMemberIds(roomId) {
  const normalizedRoomId = safeText(roomId);

  if (!normalizedRoomId) {
    return [];
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('chat_room_members')
    .select('user_id')
    .eq('room_id', normalizedRoomId);

  if (error) {
    console.error('MESSAGE ROOM MEMBERS FETCH ERROR:', error);
    throw new Error(error.message);
  }

  return (data || [])
    .map((row) => row.user_id)
    .filter(Boolean);
}

async function emitRoomMessageToMembers(roomId, eventName, payload) {
  emitToGroup(roomId, eventName, payload);

  try {
    const memberIds = await fetchRoomMemberIds(roomId);

    for (const memberId of memberIds) {
      emitToUser(memberId, eventName, payload);
    }
  } catch (error) {
    console.error('MESSAGE ROOM MEMBER EMIT ERROR:', error);
  }
}

async function createMessage({ senderId, receiverId, roomId, messageBody }) {
  const trimmedBody = validateConversationMessageBody(messageBody);
  console.log('[MessageService] createMessage called', {
    senderId,
    receiverId,
    roomId,
    hasMessageBody: !!trimmedBody,
  });

  if (!senderId) {
    throw createHttpError(400, 'senderId is required.');
  }

  if (!receiverId && !roomId) {
    throw createHttpError(400, 'receiverId or roomId is required.');
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        sender_id: senderId,
        receiver_id: receiverId || null,
        room_id: roomId || null,
        message_body: trimmedBody,
        subject: null,
        attachment_url: null,
      },
    ])
    .select(MESSAGE_FIELDS)
    .single();

  if (error) {
    console.error('MESSAGE INSERT ERROR:', error);
    throw new Error(error.message);
  }

  const profilesResult = await fetchConversationProfiles([senderId]);
  const combinedMap = new Map();

  profilesResult.userMap.forEach((user, id) => {
    const student = profilesResult.studentMap.get(id);

    const name =
      [student?.first_name, student?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      user.username ||
      user.email ||
      'Unknown';

    combinedMap.set(id, {
      name,
      avatarUrl: student?.profile_photo_url || null,
    });
  });

  const message = mapMessageRow(data, combinedMap);
  console.log('[MessageService] message inserted', {
    messageId: message.messageId,
    senderId: message.senderId,
    receiverId: message.receiverId,
    roomId: message.roomId,
  });

  if (roomId) {
    await emitRoomMessageToMembers(roomId, 'message:new', message);
    await emitRoomMessageToMembers(roomId, 'message:created', message);
  } else {
    emitToUser(senderId, 'message:new', message);
    emitToUser(receiverId, 'message:new', message);

    emitToUser(senderId, 'message:created', message);
    emitToUser(receiverId, 'message:created', message);
  }

  relayToAdminBackend(message);

  return message;
}

async function markThreadRead({ readerId, senderId }) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('receiver_id', readerId)
    .eq('sender_id', senderId)
    .eq('is_read', false)
    .select(MESSAGE_FIELDS);

  if (error) {
    console.error('MESSAGE MARK READ ERROR:', error);
    throw new Error(error.message);
  }

  const items = (data || []).map((row) => mapMessageRow(row));
  const messageIds = items.map((item) => item.messageId);

  if (messageIds.length) {
    const payload = {
      readerId,
      reader_id: readerId,
      counterpartyId: senderId,
      counterparty_id: senderId,
      messageIds,
      message_ids: messageIds,
    };

    emitToUser(readerId, 'message:read', payload);
    emitToUser(senderId, 'message:read', payload);
  }

  return {
    updatedCount: messageIds.length,
    updated_count: messageIds.length,
    messageIds,
    message_ids: messageIds,
  };
}

async function getUnreadCount(userId) {
  const normalizedUserId = safeText(userId);

  if (!normalizedUserId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const supabase = getSupabase();

  const { count: privateCount, error: privateError } = await supabase
    .from('messages')
    .select('message_id', { count: 'exact', head: true })
    .eq('receiver_id', normalizedUserId)
    .eq('is_read', false);

  if (privateError) {
    console.error('MESSAGE UNREAD COUNT ERROR:', privateError);
    throw new Error(privateError.message);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('chat_room_members')
    .select('room_id')
    .eq('user_id', normalizedUserId);

  if (membershipError) {
    console.error('MESSAGE ROOM MEMBERSHIP COUNT ERROR:', membershipError);
    throw new Error(membershipError.message);
  }

  const roomIds = (memberships || [])
    .map((row) => row.room_id)
    .filter(Boolean);

  let groupCount = 0;

  if (roomIds.length) {
    const { count, error: groupError } = await supabase
      .from('messages')
      .select('message_id', { count: 'exact', head: true })
      .in('room_id', roomIds)
      .neq('sender_id', normalizedUserId)
      .eq('is_read', false);

    if (groupError) {
      console.error('GROUP MESSAGE UNREAD COUNT ERROR:', groupError);
      throw new Error(groupError.message);
    }

    groupCount = count || 0;
  }

  return (privateCount || 0) + groupCount;
}

async function fetchRoomUnreadCounts(userId, roomIds = []) {
  const normalizedUserId = safeText(userId);
  const normalizedRoomIds = roomIds
    .map((roomId) => safeText(roomId))
    .filter((roomId) => roomId.length > 0);

  if (!normalizedRoomIds.length) {
    return new Map();
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('messages')
    .select('room_id')
    .in('room_id', normalizedRoomIds)
    .neq('sender_id', normalizedUserId)
    .eq('is_read', false);

  if (error) {
    console.error('ROOM MESSAGE UNREAD COUNT ERROR:', error);
    throw new Error(error.message);
  }

  const unreadCounts = new Map();

  for (const roomId of normalizedRoomIds) {
    unreadCounts.set(roomId, 0);
  }

  for (const row of data || []) {
    const roomId = row.room_id;

    if (!roomId) {
      continue;
    }

    unreadCounts.set(roomId, (unreadCounts.get(roomId) || 0) + 1);
  }

  return unreadCounts;
}

async function listFixedThread(userId) {
  const adminUserId = await ensureMobileThreadActor(userId);

  return {
    counterpartyId: adminUserId,
    counterparty_id: adminUserId,
    items: await fetchThreadMessages(userId, adminUserId),
  };
}

async function sendToFixedThread(userId, messageBody) {
  const adminUserId = await ensureMobileThreadActor(userId);

  return createMessage({
    senderId: userId,
    receiverId: adminUserId,
    messageBody,
  });
}

async function markFixedThreadRead(userId) {
  const adminUserId = await ensureMobileThreadActor(userId);

  return markThreadRead({
    readerId: userId,
    senderId: adminUserId,
  });
}

async function listAdminConversations(userId) {
  const admin = await resolveActiveAdminUser(userId);
  const rows = await fetchAllPrivateMessagesForUser(admin.userId);
  const previews = new Map();

  for (const row of rows) {
    const counterpartyId =
      row.sender_id === admin.userId ? row.receiver_id : row.sender_id;

    if (!counterpartyId) {
      continue;
    }

    const existing = previews.get(counterpartyId) || {
      row: null,
      unreadCount: 0,
    };

    if (!existing.row) {
      existing.row = row;
    }

    if (row.receiver_id === admin.userId && !row.is_read) {
      existing.unreadCount += 1;
    }

    previews.set(counterpartyId, existing);
  }

  const counterpartyIds = Array.from(previews.keys());
  const profiles = await fetchConversationProfiles(counterpartyIds);

  return counterpartyIds
    .map((counterpartyId) =>
      buildConversationPreview(
        counterpartyId,
        previews.get(counterpartyId).row,
        profiles,
        previews.get(counterpartyId).unreadCount
      )
    )
    .sort((left, right) => {
      const leftTime = new Date(left.lastSentAt || left.last_sent_at || 0).getTime();
      const rightTime = new Date(right.lastSentAt || right.last_sent_at || 0).getTime();

      return rightTime - leftTime;
    });
}

async function listAdminConversation(userId, counterpartyId) {
  const admin = await resolveActiveAdminUser(userId);
  const student = await resolveConversationStudent(counterpartyId);

  return {
    counterpartyId: student.user_id,
    counterparty_id: student.user_id,
    items: await fetchThreadMessages(admin.userId, student.user_id),
  };
}

async function fetchAdminConversationMessages(userId, counterpartyId) {
  const admin = await resolveActiveAdminUser(userId);
  const student = await resolveConversationStudent(counterpartyId);

  return fetchThreadMessages(admin.userId, student.user_id);
}

async function sendAdminConversationMessage(userId, counterpartyId, messageBody) {
  const admin = await resolveActiveAdminUser(userId);
  const student = await resolveConversationStudent(counterpartyId);

  return createMessage({
    senderId: admin.userId,
    receiverId: student.user_id,
    messageBody,
  });
}

async function markAdminConversationRead(userId, counterpartyId) {
  const admin = await resolveActiveAdminUser(userId);
  const student = await resolveConversationStudent(counterpartyId);

  return markThreadRead({
    readerId: admin.userId,
    senderId: student.user_id,
  });
}

async function listRoomsForAdmin(userId) {
  await resolveActiveAdminUser(userId);

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('chat_rooms')
    .select('room_id, room_name, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('MESSAGE ADMIN ROOMS FETCH ERROR:', error);
    throw new Error(error.message);
  }

  return (data || []).map((room) => ({
    roomId: room.room_id,
    room_id: room.room_id,
    roomName: room.room_name,
    room_name: room.room_name,
    createdAt: room.created_at,
    created_at: room.created_at,
    unreadCount: 0,
    unread_count: 0,
  }));
}

async function createRoom(adminUserId, roomName, userIds = []) {
  const admin = await resolveActiveAdminUser(adminUserId);
  const normalizedRoomName = safeText(roomName) || 'Group Chat';

  const selectedUserIds = Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((userId) => safeText(userId))
        .filter((userId) => userId.length > 0 && userId !== admin.userId)
    )
  );

  const supabase = getSupabase();

  const { data: group, error } = await supabase
    .from('chat_rooms')
    .insert([
      {
        room_name: normalizedRoomName,
        created_by: admin.userId,
      },
    ])
    .select('room_id, room_name, created_at')
    .single();

  if (error) {
    console.error('MESSAGE ROOM CREATE ERROR:', error);
    throw new Error(error.message);
  }

  const memberInserts = [
    {
      room_id: group.room_id,
      user_id: admin.userId,
      is_admin: true,
    },
    ...selectedUserIds.map((userId) => ({
      room_id: group.room_id,
      user_id: userId,
      is_admin: false,
    })),
  ];

  const { error: memberError } = await supabase
    .from('chat_room_members')
    .insert(memberInserts);

  if (memberError) {
    console.error('MESSAGE ROOM MEMBER INSERT ERROR:', memberError);
    throw new Error(memberError.message);
  }

  const payload = {
    roomId: group.room_id,
    room_id: group.room_id,
    roomName: group.room_name,
    room_name: group.room_name,
    createdAt: group.created_at,
    created_at: group.created_at,
    unreadCount: 0,
    unread_count: 0,
  };

  emitToUser(admin.userId, 'room:created', payload);

  for (const memberId of selectedUserIds) {
    emitToUser(memberId, 'room:created', payload);
  }

  return payload;
}

async function addGroupMembers(adminUserId, roomId, userIds = []) {
  const admin = await resolveActiveAdminUser(adminUserId);
  const normalizedRoomId = safeText(roomId);

  if (!normalizedRoomId) {
    throw createHttpError(400, 'roomId is required.');
  }

  const selectedUserIds = Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((userId) => safeText(userId))
        .filter((userId) => userId.length > 0)
    )
  );

  if (!selectedUserIds.length) {
    return [];
  }

  const supabase = getSupabase();

  const inserts = selectedUserIds.map((userId) => ({
    room_id: normalizedRoomId,
    user_id: userId,
    is_admin: false,
  }));

  const { data, error } = await supabase
    .from('chat_room_members')
    .upsert(inserts, {
      onConflict: 'room_id,user_id',
      ignoreDuplicates: true,
    })
    .select('room_id, user_id, is_admin');

  if (error) {
    console.error('MESSAGE ROOM MEMBER ADD ERROR:', error);
    throw new Error(error.message);
  }

  const payload = {
    roomId: normalizedRoomId,
    room_id: normalizedRoomId,
    memberIds: selectedUserIds,
    member_ids: selectedUserIds,
    addedBy: admin.userId,
    added_by: admin.userId,
  };

  emitToGroup(normalizedRoomId, 'room:members-added', payload);
  emitToUser(admin.userId, 'room:members-added', payload);

  for (const memberId of selectedUserIds) {
    emitToUser(memberId, 'room:members-added', payload);
  }

  return data || [];
}

async function removeGroupMember(adminUserId, roomId, memberId) {
  const admin = await resolveActiveAdminUser(adminUserId);
  const normalizedRoomId = safeText(roomId);
  const normalizedMemberId = safeText(memberId);

  if (!normalizedRoomId) {
    throw createHttpError(400, 'roomId is required.');
  }

  if (!normalizedMemberId) {
    throw createHttpError(400, 'memberId is required.');
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from('chat_room_members')
    .delete()
    .eq('room_id', normalizedRoomId)
    .eq('user_id', normalizedMemberId);

  if (error) {
    console.error('MESSAGE ROOM MEMBER REMOVE ERROR:', error);
    throw new Error(error.message);
  }

  const payload = {
    roomId: normalizedRoomId,
    room_id: normalizedRoomId,
    memberId: normalizedMemberId,
    member_id: normalizedMemberId,
    removedBy: admin.userId,
    removed_by: admin.userId,
  };

  emitToGroup(normalizedRoomId, 'room:members-removed', payload);
  emitToUser(normalizedMemberId, 'room:members-removed', payload);

  return {
    success: true,
  };
}

async function listRoomsForUser(userId) {
  const normalizedUserId = safeText(userId);

  if (!normalizedUserId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('chat_room_members')
    .select(`
      room_id,
      chat_rooms (
        room_id,
        room_name,
        created_at
      )
    `)
    .eq('user_id', normalizedUserId);

  if (error) {
    console.error('MESSAGE USER ROOMS FETCH ERROR:', error);
    throw new Error(error.message);
  }

  const rooms = (data || [])
    .map((item) => {
      const room = Array.isArray(item.chat_rooms)
        ? item.chat_rooms[0]
        : item.chat_rooms;

      return {
        roomId: item.room_id,
        room_id: item.room_id,
        roomName: room?.room_name || 'Group Chat',
        room_name: room?.room_name || 'Group Chat',
        createdAt: room?.created_at || null,
        created_at: room?.created_at || null,
      };
    })
    .filter((room) => room.roomId);

  const unreadCounts = await fetchRoomUnreadCounts(
    normalizedUserId,
    rooms.map((room) => room.roomId)
  );

  return rooms.map((room) => ({
    ...room,
    unreadCount: unreadCounts.get(room.roomId) || 0,
    unread_count: unreadCounts.get(room.roomId) || 0,
  }));
}

async function ensureRoomMember(userId, roomId) {
  const normalizedUserId = safeText(userId);
  const normalizedRoomId = safeText(roomId);

  if (!normalizedUserId) {
    throw createHttpError(401, 'Authentication required.');
  }

  if (!normalizedRoomId) {
    throw createHttpError(400, 'roomId is required.');
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('chat_room_members')
    .select('room_id, user_id, is_admin')
    .eq('room_id', normalizedRoomId)
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  if (error) {
    console.error('MESSAGE ROOM MEMBER CHECK ERROR:', error);
    throw new Error(error.message);
  }

  if (!data) {
    throw createHttpError(403, 'You are not a member of this room.');
  }

  return data;
}

async function fetchRoomThread(userId, roomId, { limit = 200 } = {}) {
  await ensureRoomMember(userId, roomId);

  const normalizedRoomId = safeText(roomId);
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_FIELDS)
    .eq('room_id', normalizedRoomId)
    .order('sent_at', { ascending: true })
    .order('message_id', { ascending: true })
    .limit(safeLimit);

  if (error) {
    console.error('MESSAGE ROOM THREAD FETCH ERROR:', error);
    throw new Error(error.message);
  }

  const rows = data || [];
  const senderIds = Array.from(
    new Set(rows.map((row) => row.sender_id).filter(Boolean))
  );

  const profilesResult = await fetchConversationProfiles(senderIds);
  const combinedMap = new Map();

  profilesResult.userMap.forEach((user, id) => {
    const student = profilesResult.studentMap.get(id);

    const name =
      [student?.first_name, student?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      user.username ||
      user.email ||
      'Unknown';

    combinedMap.set(id, {
      name,
      avatarUrl: student?.profile_photo_url || null,
    });
  });

  return rows.map((row) => mapMessageRow(row, combinedMap));
}

async function sendRoomMessage(userId, roomId, messageBody) {
  await ensureRoomMember(userId, roomId);

  return createMessage({
    senderId: userId,
    roomId,
    messageBody,
  });
}

async function markRoomThreadRead(userId, roomId) {
  await ensureRoomMember(userId, roomId);

  const normalizedUserId = safeText(userId);
  const normalizedRoomId = safeText(roomId);
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('room_id', normalizedRoomId)
    .neq('sender_id', normalizedUserId)
    .eq('is_read', false)
    .select(MESSAGE_FIELDS);

  if (error) {
    console.error('MESSAGE ROOM MARK READ ERROR:', error);
    throw new Error(error.message);
  }

  const items = (data || []).map((row) => mapMessageRow(row));
  const messageIds = items.map((item) => item.messageId);

  if (messageIds.length) {
    const payload = {
      readerId: normalizedUserId,
      reader_id: normalizedUserId,
      roomId: normalizedRoomId,
      room_id: normalizedRoomId,
      messageIds,
      message_ids: messageIds,
    };

    emitToGroup(normalizedRoomId, 'message:read', payload);
    emitToUser(normalizedUserId, 'message:read', payload);
  }

  return {
    updatedCount: messageIds.length,
    updated_count: messageIds.length,
    messageIds,
    message_ids: messageIds,
  };
}

module.exports = {
  configureMessageService,

  getUnreadCount,

  listFixedThread,
  sendToFixedThread,
  markFixedThreadRead,

  listAdminConversations,
  listAdminConversation,
  fetchAdminConversationMessages,
  sendAdminConversationMessage,
  markAdminConversationRead,
  resolveFixedAdminUserId,

  listRoomsForAdmin,
  createRoom,
  addGroupMembers,
  removeGroupMember,
  listRoomsForUser,
  fetchRoomThread,
  sendRoomMessage,
  markRoomThreadRead,
};