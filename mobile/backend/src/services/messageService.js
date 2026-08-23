const adminRealtimeRelayService = require('./adminRealtimeRelayService');
const { resolveAvatarUrl } = require('./avatarService');

const MESSAGE_FIELDS =
  'message_id, sender_id, receiver_id, room_id, subject, message_body, sent_at, is_read, attachment_url';

const FETCH_PAGE_SIZE = 1000;

const ALLOWED_ADMIN_ROLES = new Set([
  'admin',
  'osfa_admin',
  'sdo',
  'guidance',
  'pd',
  'ro_coordinator',
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
      adminMap: new Map(),
    };
  }

  const supabase = getSupabase();

  // Member/profile enrichment must never make the group member list disappear.
  // Membership rows are authoritative; these profile queries only decorate them.
  const [usersResult, studentsResult, adminProfilesResult] = await Promise.all([
    supabase
      .from('users')
      .select('user_id, email, username, role')
      .in('user_id', ids),
    supabase
      .from('students')
      .select('user_id, pdm_id, first_name, last_name, profile_photo_url')
      .in('user_id', ids),
    supabase
      .from('admin_profiles')
      .select('user_id, first_name, last_name, department, position, is_archived')
      .in('user_id', ids),
  ]);

  if (usersResult.error) {
    console.error('MESSAGE USER PROFILE FETCH ERROR:', usersResult.error);
  }
  if (studentsResult.error) {
    console.error('MESSAGE STUDENT PROFILE FETCH ERROR:', studentsResult.error);
  }
  if (adminProfilesResult.error) {
    console.error('MESSAGE ADMIN PROFILE FETCH ERROR:', adminProfilesResult.error);
  }

  const userRows = usersResult.error ? [] : usersResult.data || [];
  const rawStudentRows = studentsResult.error ? [] : studentsResult.data || [];
  const rawAdminRows = adminProfilesResult.error ? [] : adminProfilesResult.data || [];

  // Admin profile photos are optional in older schemas. Query them separately so
  // a missing/unsupported photo column cannot break names or membership data.
  let adminPhotoByUserId = new Map();
  if (rawAdminRows.length) {
    const adminPhotoResult = await supabase
      .from('admin_profiles')
      .select('user_id, profile_photo_url')
      .in('user_id', ids);

    if (adminPhotoResult.error) {
      console.warn('MESSAGE ADMIN PHOTO ENRICHMENT SKIPPED:', adminPhotoResult.error.message);
    } else {
      adminPhotoByUserId = new Map(
        (adminPhotoResult.data || []).map((row) => [
          row.user_id,
          row.profile_photo_url || null,
        ])
      );
    }
  }

  async function resolveUsableAvatar(value) {
    const raw = safeText(value);
    if (!raw) return null;

    try {
      const resolved = safeText(await resolveAvatarUrl(raw));
      // Flutter NetworkImage requires a real network URL. If signing fails and
      // the avatar service returns a storage path, return null so the UI falls
      // back to initials instead of rendering a broken image.
      return /^https?:\/\//i.test(resolved) ? resolved : null;
    } catch (error) {
      console.warn('MESSAGE AVATAR RESOLVE ERROR:', error?.message || error);
      return null;
    }
  }

  const [studentRows, adminRows] = await Promise.all([
    Promise.all(
      rawStudentRows.map(async (row) => ({
        ...row,
        profile_photo_url: await resolveUsableAvatar(row.profile_photo_url || null),
      }))
    ),
    Promise.all(
      rawAdminRows.map(async (row) => ({
        ...row,
        profile_photo_url: await resolveUsableAvatar(
          adminPhotoByUserId.get(row.user_id) || null
        ),
      }))
    ),
  ]);

  return {
    userMap: new Map(userRows.map((row) => [row.user_id, row])),
    studentMap: new Map(studentRows.map((row) => [row.user_id, row])),
    adminMap: new Map(adminRows.map((row) => [row.user_id, row])),
  };
}

function buildProfileDisplay(userId, { userMap, studentMap, adminMap }) {
  const user = userMap.get(userId);
  const student = studentMap.get(userId);
  const admin = adminMap.get(userId);

  const studentName = [student?.first_name, student?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const adminName = [admin?.first_name, admin?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  const rawUsername = safeText(user?.username);
  const rawEmail = safeText(user?.email);
  const deletedAccount = /^deleted[-_]/i.test(rawUsername) || /^deleted[-_]/i.test(rawEmail);
  const fallbackName = deletedAccount
    ? 'Deleted user'
    : rawUsername || rawEmail || 'Unknown user';

  return {
    name: studentName || adminName || fallbackName,
    studentNumber: student?.pdm_id || null,
    avatarUrl: student?.profile_photo_url || admin?.profile_photo_url || null,
    role: user?.role || null,
    email: deletedAccount ? null : user?.email || null,
    department: admin?.department || null,
    position: admin?.position || null,
    subtitle:
      student?.pdm_id ||
      admin?.position ||
      admin?.department ||
      user?.role ||
      '',
    isDeleted: deletedAccount,
  };
}

function buildProfileMap(profilesResult) {
  const ids = new Set([
    ...profilesResult.userMap.keys(),
    ...profilesResult.studentMap.keys(),
    ...profilesResult.adminMap.keys(),
  ]);
  const map = new Map();

  for (const id of ids) {
    const display = buildProfileDisplay(id, profilesResult);
    map.set(id, {
      name: display.name,
      avatarUrl: display.avatarUrl,
    });
  }

  return map;
}

function buildConversationPreview(
  counterpartyId,
  row,
  { userMap, studentMap, adminMap },
  unreadCount
) {
  const display = buildProfileDisplay(counterpartyId, { userMap, studentMap, adminMap });

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
  const profileMap = buildProfileMap(profilesResult);

  return (data || []).map((row) => mapMessageRow(row, profileMap));
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

async function upsertMessageReadStates(rows = []) {
  const normalizedRows = rows
    .filter((row) => row?.message_id && row?.user_id)
    .map((row) => ({
      message_id: row.message_id,
      user_id: row.user_id,
      is_read: row.is_read === true,
    }));

  if (!normalizedRows.length) return;

  const supabase = getSupabase();
  const { error } = await supabase
    .from('message_read_states')
    .upsert(normalizedRows, { onConflict: 'message_id,user_id' });

  if (error) {
    console.error('MESSAGE READ STATE UPSERT ERROR:', error);
    throw new Error(error.message);
  }
}

async function fetchViewerReadMap(userId, messageIds = []) {
  const normalizedIds = [...new Set(messageIds.map(safeText).filter(Boolean))];
  const map = new Map();
  if (!normalizedIds.length) return map;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('message_read_states')
    .select('message_id, is_read')
    .eq('user_id', userId)
    .in('message_id', normalizedIds);

  if (error) {
    console.error('MESSAGE READ STATE FETCH ERROR:', error);
    throw new Error(error.message);
  }

  for (const row of data || []) {
    map.set(row.message_id, row.is_read === true);
  }
  return map;
}

async function ensureSharedRoomMembership(leftUserId, rightUserId) {
  const left = safeText(leftUserId);
  const right = safeText(rightUserId);
  if (!left || !right || left === right) {
    throw createHttpError(400, 'A valid group member is required.');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_room_members')
    .select('room_id, user_id')
    .in('user_id', [left, right]);

  if (error) {
    console.error('SHARED ROOM MEMBERSHIP CHECK ERROR:', error);
    throw new Error(error.message);
  }

  const leftRooms = new Set(
    (data || []).filter((row) => row.user_id === left).map((row) => row.room_id)
  );
  const sharedRoom = (data || []).find(
    (row) => row.user_id === right && leftRooms.has(row.room_id)
  );

  if (!sharedRoom?.room_id) {
    throw createHttpError(403, 'Private messaging is available only between members of the same group.');
  }

  return sharedRoom.room_id;
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

  if (roomId) {
    const memberIds = await fetchRoomMemberIds(roomId);
    await upsertMessageReadStates(
      memberIds.map((userId) => ({
        message_id: data.message_id,
        user_id: userId,
        is_read: userId === senderId,
      }))
    );
  } else if (receiverId) {
    await upsertMessageReadStates([
      { message_id: data.message_id, user_id: senderId, is_read: true },
      { message_id: data.message_id, user_id: receiverId, is_read: false },
    ]);
  }

  const profilesResult = await fetchConversationProfiles([senderId]);
  const profileMap = buildProfileMap(profilesResult);
  const message = {
    ...mapMessageRow(data, profileMap),
    isRead: true,
    is_read: true,
  };
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

    adminRealtimeRelayService.relayMessageEvent(
      'message:read',
      payload,
      [readerId, senderId]
    ).catch((error) => {
      console.error('[Admin Realtime Relay] read event error:', error.message);
    });
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

  const roomIds = (memberships || []).map((row) => row.room_id).filter(Boolean);
  const roomUnread = await fetchRoomUnreadCounts(normalizedUserId, roomIds);
  const groupCount = [...roomUnread.values()].reduce((sum, value) => sum + value, 0);

  return (privateCount || 0) + groupCount;
}

async function fetchRoomUnreadCounts(userId, roomIds = []) {
  const normalizedUserId = safeText(userId);
  const normalizedRoomIds = roomIds
    .map((roomId) => safeText(roomId))
    .filter((roomId) => roomId.length > 0);
  const unreadCounts = new Map(normalizedRoomIds.map((roomId) => [roomId, 0]));

  if (!normalizedRoomIds.length) return unreadCounts;

  const supabase = getSupabase();
  const { data: messages, error: messageError } = await supabase
    .from('messages')
    .select('message_id, room_id, sender_id')
    .in('room_id', normalizedRoomIds)
    .neq('sender_id', normalizedUserId);

  if (messageError) {
    console.error('ROOM MESSAGE UNREAD FETCH ERROR:', messageError);
    throw new Error(messageError.message);
  }

  const messageRows = messages || [];
  const readMap = await fetchViewerReadMap(
    normalizedUserId,
    messageRows.map((row) => row.message_id)
  );

  for (const row of messageRows) {
    if (readMap.get(row.message_id) === true) continue;
    unreadCounts.set(row.room_id, (unreadCounts.get(row.room_id) || 0) + 1);
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

  const rooms = data || [];
  const roomIds = rooms.map((room) => room.room_id).filter(Boolean);
  const memberCounts = new Map(roomIds.map((roomId) => [roomId, 0]));

  if (roomIds.length) {
    const { data: memberRows, error: memberError } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .in('room_id', roomIds);

    if (memberError) {
      console.error('MESSAGE ADMIN ROOM MEMBER COUNT ERROR:', memberError);
      throw new Error(memberError.message);
    }

    for (const row of memberRows || []) {
      memberCounts.set(row.room_id, (memberCounts.get(row.room_id) || 0) + 1);
    }
  }

  return rooms.map((room) => ({
    roomId: room.room_id,
    room_id: room.room_id,
    roomName: room.room_name,
    room_name: room.room_name,
    createdAt: room.created_at,
    created_at: room.created_at,
    memberCount: memberCounts.get(room.room_id) || 0,
    member_count: memberCounts.get(room.room_id) || 0,
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

  const roomMembers = await fetchRoomMembers(admin.userId, group.room_id);
  const payload = {
    roomId: group.room_id,
    room_id: group.room_id,
    roomName: group.room_name,
    room_name: group.room_name,
    createdAt: group.created_at,
    created_at: group.created_at,
    unreadCount: 0,
    unread_count: 0,
    members: roomMembers,
    roomMembers: roomMembers,
    memberCount: roomMembers.length,
    member_count: roomMembers.length,
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

  const membership = await ensureRoomMember(admin.userId, normalizedRoomId);
  if (membership.is_admin !== true) {
    throw createHttpError(403, 'Only the group admin can add members.');
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

  return fetchRoomMembers(admin.userId, normalizedRoomId);
}

async function removeGroupMember(adminUserId, roomId, memberId) {
  const admin = await resolveActiveAdminUser(adminUserId);
  const normalizedRoomId = safeText(roomId);
  const normalizedMemberId = safeText(memberId);

  if (!normalizedRoomId) {
    throw createHttpError(400, 'roomId is required.');
  }

  const membership = await ensureRoomMember(admin.userId, normalizedRoomId);
  if (membership.is_admin !== true) {
    throw createHttpError(403, 'Only the group admin can remove members.');
  }

  if (!normalizedMemberId) {
    throw createHttpError(400, 'memberId is required.');
  }

  if (normalizedMemberId === admin.userId) {
    throw createHttpError(400, 'Use Leave Group to remove yourself.');
  }

  const supabase = getSupabase();
  const { data: targetMembership, error: targetError } = await supabase
    .from('chat_room_members')
    .select('is_admin')
    .eq('room_id', normalizedRoomId)
    .eq('user_id', normalizedMemberId)
    .maybeSingle();

  if (targetError) throw new Error(targetError.message);
  if (!targetMembership) throw createHttpError(404, 'Group member not found.');
  if (targetMembership.is_admin === true) {
    throw createHttpError(403, 'Another group admin cannot be removed.');
  }

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
        created_at,
        is_archived
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
        isArchived: room?.is_archived === true,
      };
    })
    .filter((room) => room.roomId && room.isArchived !== true);

  const roomIds = rooms.map((room) => room.roomId);
  const [unreadCounts, memberCountResult] = await Promise.all([
    fetchRoomUnreadCounts(normalizedUserId, roomIds),
    roomIds.length
      ? supabase.from('chat_room_members').select('room_id').in('room_id', roomIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (memberCountResult.error) {
    console.error('MESSAGE USER ROOM MEMBER COUNT ERROR:', memberCountResult.error);
    throw new Error(memberCountResult.error.message);
  }

  const memberCounts = new Map(roomIds.map((roomId) => [roomId, 0]));
  for (const row of memberCountResult.data || []) {
    memberCounts.set(row.room_id, (memberCounts.get(row.room_id) || 0) + 1);
  }

  return rooms.map((room) => ({
    ...room,
    memberCount: memberCounts.get(room.roomId) || 0,
    member_count: memberCounts.get(room.roomId) || 0,
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
  const profileMap = buildProfileMap(profilesResult);
  const readMap = await fetchViewerReadMap(
    safeText(userId),
    rows.map((row) => row.message_id)
  );

  return rows.map((row) =>
    mapMessageRow(
      {
        ...row,
        is_read: row.sender_id === safeText(userId) || readMap.get(row.message_id) === true,
      },
      profileMap
    )
  );
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
    .select('message_id')
    .eq('room_id', normalizedRoomId)
    .neq('sender_id', normalizedUserId);

  if (error) {
    console.error('MESSAGE ROOM MARK READ FETCH ERROR:', error);
    throw new Error(error.message);
  }

  const messageIds = (data || []).map((row) => row.message_id).filter(Boolean);
  if (messageIds.length) {
    await upsertMessageReadStates(
      messageIds.map((messageId) => ({
        message_id: messageId,
        user_id: normalizedUserId,
        is_read: true,
      }))
    );

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
    adminRealtimeRelayService.relayMessageEvent(
      'message:read',
      payload,
      await fetchRoomMemberIds(normalizedRoomId)
    ).catch((relayError) => {
      console.error('[Admin Realtime Relay] room read event error:', relayError.message);
    });
  }

  return {
    updatedCount: messageIds.length,
    updated_count: messageIds.length,
    messageIds,
    message_ids: messageIds,
  };
}

async function fetchRoomMembers(userId, roomId) {
  await ensureRoomMember(userId, roomId);
  const normalizedUserId = safeText(userId);
  const normalizedRoomId = safeText(roomId);
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('chat_room_members')
    .select('room_id, user_id, is_admin')
    .eq('room_id', normalizedRoomId)
    .order('is_admin', { ascending: false })
    .order('user_id', { ascending: true });

  if (error) {
    console.error('MESSAGE ROOM MEMBERS FETCH ERROR:', error);
    throw new Error(error.message);
  }

  const rows = data || [];
  const profiles = await fetchConversationProfiles(rows.map((row) => row.user_id));

  return rows.map((row) => {
    const display = buildProfileDisplay(row.user_id, profiles);
    return {
      userId: row.user_id,
      user_id: row.user_id,
      name: display.name,
      subtitle: display.subtitle,
      studentNumber: display.studentNumber,
      student_number: display.studentNumber,
      role: display.role,
      email: display.email,
      department: display.department,
      position: display.position,
      avatarUrl: display.avatarUrl,
      avatar_url: display.avatarUrl,
      profile_photo_url: display.avatarUrl,
      isAdmin: row.is_admin === true,
      is_admin: row.is_admin === true,
      isCurrentUser: row.user_id === normalizedUserId,
      is_current_user: row.user_id === normalizedUserId,
      isDeleted: display.isDeleted === true,
      is_deleted: display.isDeleted === true,
      joinedAt: row.joined_at || null,
      joined_at: row.joined_at || null,
    };
  });
}

async function leaveRoom(userId, roomId) {
  const membership = await ensureRoomMember(userId, roomId);
  const normalizedUserId = safeText(userId);
  const normalizedRoomId = safeText(roomId);
  const supabase = getSupabase();

  const { error: deleteError } = await supabase
    .from('chat_room_members')
    .delete()
    .eq('room_id', normalizedRoomId)
    .eq('user_id', normalizedUserId);

  if (deleteError) {
    console.error('MESSAGE ROOM LEAVE ERROR:', deleteError);
    throw new Error(deleteError.message);
  }

  const { data: remaining, error: remainingError } = await supabase
    .from('chat_room_members')
    .select('user_id, is_admin')
    .eq('room_id', normalizedRoomId)
    .order('is_admin', { ascending: false })
    .order('user_id', { ascending: true });

  if (remainingError) {
    console.error('MESSAGE ROOM REMAINING MEMBERS ERROR:', remainingError);
    throw new Error(remainingError.message);
  }

  let promotedUserId = null;
  const rows = remaining || [];

  if (!rows.length) {
    const { error: archiveError } = await supabase
      .from('chat_rooms')
      .update({ is_archived: true })
      .eq('room_id', normalizedRoomId);
    if (archiveError) throw new Error(archiveError.message);
  } else if (membership.is_admin === true && !rows.some((row) => row.is_admin === true)) {
    promotedUserId = rows[0].user_id;
    const { error: promoteError } = await supabase
      .from('chat_room_members')
      .update({ is_admin: true })
      .eq('room_id', normalizedRoomId)
      .eq('user_id', rows[0].user_id);
    if (promoteError) throw new Error(promoteError.message);
  }

  const payload = {
    roomId: normalizedRoomId,
    room_id: normalizedRoomId,
    userId: normalizedUserId,
    user_id: normalizedUserId,
    promotedUserId,
    promoted_user_id: promotedUserId,
  };

  emitToGroup(normalizedRoomId, 'room:member-left', payload);
  emitToUser(normalizedUserId, 'room:member-left', payload);
  for (const member of rows) emitToUser(member.user_id, 'room:member-left', payload);
  adminRealtimeRelayService.relayMessageEvent(
    'room:member-left',
    payload,
    [normalizedUserId, ...rows.map((row) => row.user_id)]
  ).catch((relayError) => {
    console.error('[Admin Realtime Relay] leave room event error:', relayError.message);
  });

  return { success: true, ...payload };
}

async function fetchSharedConversationMessages(userId, counterpartyId) {
  await ensureSharedRoomMembership(userId, counterpartyId);
  return fetchThreadMessages(safeText(userId), safeText(counterpartyId));
}

async function sendSharedConversationMessage(userId, counterpartyId, messageBody) {
  await ensureSharedRoomMembership(userId, counterpartyId);
  return createMessage({
    senderId: safeText(userId),
    receiverId: safeText(counterpartyId),
    messageBody,
  });
}

async function markSharedConversationRead(userId, counterpartyId) {
  await ensureSharedRoomMembership(userId, counterpartyId);
  return markThreadRead({
    readerId: safeText(userId),
    senderId: safeText(counterpartyId),
  });
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
  fetchRoomMembers,
  leaveRoom,
  fetchSharedConversationMessages,
  sendSharedConversationMessage,
  markSharedConversationRead,
};
