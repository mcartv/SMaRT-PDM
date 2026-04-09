const MESSAGE_FIELDS =
  'message_id, sender_id, receiver_id, subject, message_body, sent_at, is_read, attachment_url';

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

function mapMessageRow(row = {}) {
  return {
    messageId: row.message_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    subject: row.subject,
    messageBody: row.message_body,
    sentAt: row.sent_at,
    isRead: !!row.is_read,
    attachmentUrl: row.attachment_url,
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
    .or(buildThreadFilter(leftUserId, rightUserId))
    .order('sent_at', { ascending: true })
    .limit(safeLimit);

  if (error) {
    console.error('MESSAGE THREAD FETCH ERROR:', error);
    throw new Error(error.message);
  }

  return (data || []).map(mapMessageRow);
}

async function createMessage({ senderId, receiverId, messageBody }) {
  const trimmedBody = normalizeMessageBody(messageBody);

  if (!senderId || !receiverId) {
    throw createHttpError(400, 'senderId and receiverId are required.');
  }

  if (!trimmedBody) {
    throw createHttpError(400, 'messageBody is required.');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        sender_id: senderId,
        receiver_id: receiverId,
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

  const message = mapMessageRow(data);
  emitToUser(senderId, 'message:new', message);
  emitToUser(receiverId, 'message:new', message);
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
};
