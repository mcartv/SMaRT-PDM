const MESSAGE_FIELDS =
  'message_id, sender_id, receiver_id, room_id, subject, message_body, sent_at, is_read, attachment_url';

const DEFAULT_ADMIN_EMAIL = process.env.MESSAGE_ADMIN_EMAIL || 'admin@pdm.edu.ph';
const FETCH_PAGE_SIZE = 1000;

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

function emitToUser(userId, eventName, payload) {
  if (!ioRef || !userId) return;
  ioRef.to(`user:${userId}`).emit(eventName, payload);
}

function emitToGroup(roomId, eventName, payload) {
  if (!ioRef || !roomId) return;
  ioRef.to(`group:${roomId}`).emit(eventName, payload);
}

function mapMessageRow(row = {}, profiles = null) {
  const profile = profiles ? profiles.get(row.sender_id) : null;
  return {
    messageId: row.message_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    roomId: row.room_id,
    subject: row.subject,
    messageBody: row.message_body,
    sentAt: row.sent_at,
    isRead: !!row.is_read,
    attachmentUrl: row.attachment_url,
    senderName: profile?.name || null,
    senderAvatarUrl: profile?.avatarUrl || null,
  };
}

function normalizeMessageBody(messageBody = '') {
  return String(messageBody || '').trim();
}

function buildThreadFilter(leftUserId, rightUserId) {
  return `and(sender_id.eq.${leftUserId},receiver_id.eq.${rightUserId}),and(sender_id.eq.${rightUserId},receiver_id.eq.${leftUserId})`;
}

async function resolveFixedAdminUserId({ forceRefresh = false } = {}) {
  if (!forceRefresh && fixedAdminUserIdPromise) {
    return fixedAdminUserIdPromise;
  }

  fixedAdminUserIdPromise = (async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('user_id, email')
      .ilike('email', DEFAULT_ADMIN_EMAIL)
      .maybeSingle();

    if (error) {
      console.error('MESSAGE ADMIN LOOKUP ERROR:', error);
      throw new Error(error.message);
    }

    if (!data?.user_id) {
      throw createHttpError(
        500,
        `Fixed admin messaging user not found for ${DEFAULT_ADMIN_EMAIL}.`
      );
    }

    return data.user_id;
  })();

  return fixedAdminUserIdPromise;
}

async function ensureFixedAdminActor(userId) {
  const adminUserId = await resolveFixedAdminUserId();

  if (userId !== adminUserId) {
    throw createHttpError(403, 'This endpoint is restricted to the fixed admin account.');
  }

  return adminUserId;
}

async function ensureMobileThreadActor(userId) {
  const adminUserId = await resolveFixedAdminUserId();

  if (userId === adminUserId) {
    throw createHttpError(400, 'The fixed admin account must use the admin conversations API.');
  }

  return adminUserId;
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
    .limit(safeLimit);

  if (error) {
    console.error('MESSAGE THREAD FETCH ERROR:', error);
    throw new Error(error.message);
  }

  // To display sender info on 1-on-1 we can also fetch profiles
  const profilesResult = await fetchConversationProfiles([leftUserId, rightUserId]);
  const combinedMap = new Map();
  profilesResult.userMap.forEach((u, id) => {
    const s = profilesResult.studentMap.get(id);
    const name = [s?.first_name, s?.last_name].filter(Boolean).join(' ').trim() || u.username || 'Unknown';
    combinedMap.set(id, { name, avatarUrl: s?.profile_photo_url || null });
  });

  return (data || []).map(row => mapMessageRow(row, combinedMap));
}

async function createMessage({ senderId, receiverId, roomId, messageBody }) {
  const trimmedBody = normalizeMessageBody(messageBody);

  if (!senderId) throw createHttpError(400, 'senderId is required.');
  if (!receiverId && !roomId) throw createHttpError(400, 'receiverId or roomId is required.');
  if (!trimmedBody) throw createHttpError(400, 'messageBody is required.');

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

  // Pre-fetch sender profile to append to payload so receivers know who sent it
  const profilesResult = await fetchConversationProfiles([senderId]);
  const combinedMap = new Map();
  profilesResult.userMap.forEach((u, id) => {
    const s = profilesResult.studentMap.get(id);
    const name = [s?.first_name, s?.last_name].filter(Boolean).join(' ').trim() || u.username || 'Unknown';
    combinedMap.set(id, { name, avatarUrl: s?.profile_photo_url || null });
  });

  const message = mapMessageRow(data, combinedMap);

  if (roomId) {
    emitToGroup(roomId, 'message:new', message);
  } else {
    emitToUser(senderId, 'message:new', message);
    emitToUser(receiverId, 'message:new', message);
  }
  
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

  const items = (data || []).map(mapMessageRow);

  if (items.length) {
    const payload = {
      readerId,
      counterpartyId: senderId,
      messageIds: items.map((item) => item.messageId),
    };
    emitToUser(readerId, 'message:read', payload);
    emitToUser(senderId, 'message:read', payload);
  }

  return {
    updatedCount: items.length,
    messageIds: items.map((item) => item.messageId),
  };
}

async function getUnreadCount(userId) {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('messages')
    .select('message_id', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('MESSAGE UNREAD COUNT ERROR:', error);
    throw new Error(error.message);
  }

  return count || 0;
}

async function listFixedThread(userId) {
  const adminUserId = await ensureMobileThreadActor(userId);
  return {
    counterpartyId: adminUserId,
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

async function fetchAllMessagesForUser(userId) {
  const supabase = getSupabase();
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('messages')
      .select(MESSAGE_FIELDS)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('sent_at', { ascending: false })
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

async function fetchConversationProfiles(counterpartyIds = []) {
  if (!counterpartyIds.length) {
    return {
      userMap: new Map(),
      studentMap: new Map(),
    };
  }

  const supabase = getSupabase();
  const [usersResult, studentsResult] = await Promise.all([
    supabase
      .from('users')
      .select('user_id, email, username')
      .in('user_id', counterpartyIds),
    supabase
      .from('students')
      .select('user_id, pdm_id, first_name, last_name')
      .in('user_id', counterpartyIds),
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
    studentMap: new Map((studentsResult.data || []).map((row) => [row.user_id, row])),
  };
}

function buildConversationPreview(counterpartyId, row, { userMap, studentMap }, unreadCount) {
  const user = userMap.get(counterpartyId);
  const student = studentMap.get(counterpartyId);
  const studentName = [student?.first_name, student?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    counterpartyId,
    name: studentName || user?.username || user?.email || 'Unknown user',
    studentNumber: student?.pdm_id || null,
    lastMessage: row.message_body || '',
    lastSentAt: row.sent_at,
    unreadCount,
  };
}

async function listAdminConversations(userId) {
  const adminUserId = await ensureFixedAdminActor(userId);
  const rows = await fetchAllMessagesForUser(adminUserId);
  const previews = new Map();

  for (const row of rows) {
    const counterpartyId =
      row.sender_id === adminUserId ? row.receiver_id : row.sender_id;

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

    if (row.receiver_id === adminUserId && !row.is_read) {
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
      const leftTime = new Date(left.lastSentAt || 0).getTime();
      const rightTime = new Date(right.lastSentAt || 0).getTime();
      return rightTime - leftTime;
    });
}

async function listAdminConversation(userId, counterpartyId) {
  const adminUserId = await ensureFixedAdminActor(userId);
  return {
    counterpartyId,
    items: await fetchThreadMessages(adminUserId, counterpartyId),
  };
}

async function sendAdminConversationMessage(userId, counterpartyId, messageBody) {
  const adminUserId = await ensureFixedAdminActor(userId);
  return createMessage({
    senderId: adminUserId,
    receiverId: counterpartyId,
    messageBody,
  });
}

async function markAdminConversationRead(userId, counterpartyId) {
  const adminUserId = await ensureFixedAdminActor(userId);
  return markThreadRead({
    readerId: adminUserId,
    senderId: counterpartyId,
  });
}

// ------------------ GROUP MESSAGING LOGIC ------------------

async function listRoomsForAdmin(adminUserId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('room_id, room_name, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

async function createRoom(adminUserId, roomName, userIds = []) {
  const supabase = getSupabase();
  const { data: group, error } = await supabase
    .from('chat_rooms')
    .insert([{ room_name: roomName, created_by: adminUserId }])
    .select('room_id, room_name, created_at')
    .single();

  if (error) throw new Error(error.message);

  // Auto-add the admin creator to the group
  const memberInserts = [{ room_id: group.room_id, user_id: adminUserId, is_admin: true }];
  
  // Add selected students
  if (userIds && userIds.length > 0) {
    for (const uid of userIds) {
      if (uid !== adminUserId) {
        memberInserts.push({ room_id: group.room_id, user_id: uid, is_admin: false });
      }
    }
  }

  const { error: memberError } = await supabase
    .from('chat_room_members')
    .insert(memberInserts);

  if (memberError) throw new Error(memberError.message);

  return group;
}

async function addGroupMembers(adminUserId, roomId, userIds = []) {
  if (!userIds || userIds.length === 0) return [];
  const supabase = getSupabase();
  const inserts = userIds.map(uid => ({ room_id: roomId, user_id: uid }));
  
  const { data, error } = await supabase
    .from('chat_room_members')
    .insert(inserts)
    .select('user_id');

  if (error) throw new Error(error.message);
  return data;
}

async function removeGroupMember(adminUserId, roomId, memberId) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('chat_room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', memberId);

  if (error) throw new Error(error.message);
  return { success: true };
}

async function listRoomsForUser(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_room_members')
    .select('room_id, chat_rooms (room_name, created_at)')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return data.map(item => ({
    roomId: item.room_id,
    roomName: item.chat_rooms?.room_name,
    createdAt: item.chat_rooms?.created_at
  }));
}

async function fetchRoomThread(userId, roomId, { limit = 200 } = {}) {
  const supabase = getSupabase();
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);

  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_FIELDS)
    .eq('room_id', roomId)
    .order('sent_at', { ascending: true })
    .limit(safeLimit);

  if (error) throw new Error(error.message);

  const rows = data || [];
  const senderIds = Array.from(new Set(rows.map(r => r.sender_id).filter(Boolean)));
  
  const profilesResult = await fetchConversationProfiles(senderIds);
  const combinedMap = new Map();
  profilesResult.userMap.forEach((u, id) => {
    const s = profilesResult.studentMap.get(id);
    const name = [s?.first_name, s?.last_name].filter(Boolean).join(' ').trim() || u.username || 'Unknown';
    combinedMap.set(id, { name, avatarUrl: s?.profile_photo_url || null });
  });

  return rows.map(row => mapMessageRow(row, combinedMap));
}

async function sendRoomMessage(userId, roomId, messageBody) {
  // If it's the admin, ensure the user actor matches admin
  return createMessage({
    senderId: userId,
    roomId: roomId,
    messageBody,
  });
}

// ---------------------------------------------------------

module.exports = {
  configureMessageService,
  getUnreadCount,
  listFixedThread,
  sendToFixedThread,
  markFixedThreadRead,
  listAdminConversations,
  listAdminConversation,
  sendAdminConversationMessage,
  markAdminConversationRead,
  resolveFixedAdminUserId,

  // Group Features
  listRoomsForAdmin,
  createRoom,
  addGroupMembers,
  removeGroupMember,
  listRoomsForUser,
  fetchRoomThread,
  sendRoomMessage
};
