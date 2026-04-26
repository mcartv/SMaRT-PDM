// Extracted messaging routes
app.get('/api/messages/unread-count', protect, async (req, res) => {
  try {
    const unreadCount = await messageService.getUnreadCount(getRequestUserId(req));
    res.status(200).json({ unreadCount });
  } catch (error) {
    console.error('MESSAGE UNREAD COUNT ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load unread message count.',
    });
  }
});

app.get('/api/messages/thread', protect, async (req, res) => {
  try {
    const payload = await messageService.listFixedThread(getRequestUserId(req));
    res.status(200).json(payload);
  } catch (error) {
    console.error('MESSAGE THREAD ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load messages.',
    });
  }
});

app.post('/api/messages/thread', protect, async (req, res) => {
  try {
    const payload = await messageService.sendToFixedThread(
      getRequestUserId(req),
      req.body?.messageBody
    );
    res.status(201).json(payload);
  } catch (error) {
    console.error('MESSAGE SEND THREAD ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to send message.',
    });
  }
});

app.patch('/api/messages/thread/read', protect, async (req, res) => {
  try {
    const payload = await messageService.markFixedThreadRead(getRequestUserId(req));
    res.status(200).json(payload);
  } catch (error) {
    console.error('MESSAGE THREAD READ ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to mark messages as read.',
    });
  }
});

app.get('/api/messages/conversations', protect, async (req, res) => {
  try {
    const items = await messageService.listAdminConversations(getRequestUserId(req));
    res.status(200).json({ items });
  } catch (error) {
    console.error('MESSAGE CONVERSATIONS ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load conversations.',
    });
  }
});

app.get('/api/messages/conversations/:counterpartyId', protect, async (req, res) => {
  try {
    const payload = await messageService.listAdminConversation(
      getRequestUserId(req),
      req.params.counterpartyId
    );
    res.status(200).json(payload);
  } catch (error) {
    console.error('MESSAGE CONVERSATION ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load the conversation.',
    });
  }
});

app.post('/api/messages/conversations/:counterpartyId', protect, async (req, res) => {
  try {
    const payload = await messageService.sendAdminConversationMessage(
      getRequestUserId(req),
      req.params.counterpartyId,
      req.body?.messageBody
    );
    res.status(201).json(payload);
  } catch (error) {
    console.error('MESSAGE CONVERSATION SEND ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to send the conversation message.',
    });
  }
});

app.patch('/api/messages/conversations/:counterpartyId/read', protect, async (req, res) => {
  try {
    const payload = await messageService.markAdminConversationRead(
      getRequestUserId(req),
      req.params.counterpartyId
    );
    res.status(200).json(payload);
  } catch (error) {
    console.error('MESSAGE CONVERSATION READ ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to mark the conversation as read.',
    });
  }
});

// --- GROUP MESSAGES ROUTES ---

app.get('/api/messages/rooms/admin', protect, async (req, res) => {
  try {
    const payload = await messageService.listRoomsForAdmin(getRequestUserId(req));
    res.status(200).json(payload);
  } catch (error) {
    console.error('LIST ADMIN GROUPS ERROR:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to list admin rooms.' });
  }
});

app.post('/api/messages/rooms', protect, async (req, res) => {
  try {
    const { roomName, userIds } = req.body;
    const payload = await messageService.createRoom(getRequestUserId(req), roomName, userIds);
    res.status(201).json(payload);
  } catch (error) {
    console.error('CREATE GROUP ERROR:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create group.' });
  }
});

app.post('/api/messages/rooms/:roomId/members', protect, async (req, res) => {
  try {
    const { userIds } = req.body;
    const payload = await messageService.addGroupMembers(getRequestUserId(req), req.params.roomId, userIds);
    res.status(200).json(payload);
  } catch (error) {
    console.error('ADD GROUP MEMBERS ERROR:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to add members.' });
  }
});

app.delete('/api/messages/rooms/:roomId/members/:userId', protect, async (req, res) => {
  try {
    const payload = await messageService.removeGroupMember(getRequestUserId(req), req.params.roomId, req.params.userId);
    res.status(200).json(payload);
  } catch (error) {
    console.error('REMOVE GROUP MEMBER ERROR:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to remove member.' });
  }
});

app.get('/api/messages/rooms', protect, async (req, res) => {
  try {
    const payload = await messageService.listRoomsForUser(getRequestUserId(req));
    res.status(200).json(payload);
  } catch (error) {
    console.error('LIST USER GROUPS ERROR:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to list user rooms.' });
  }
});

app.get('/api/messages/rooms/:roomId/thread', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
    const items = await messageService.fetchRoomThread(getRequestUserId(req), req.params.roomId, { limit });
    res.status(200).json({ items });
  } catch (error) {
    console.error('FETCH GROUP THREAD ERROR:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch thread.' });
  }
});

app.post('/api/messages/rooms/:roomId/send', protect, async (req, res) => {
  try {
    const payload = await messageService.sendRoomMessage(getRequestUserId(req), req.params.roomId, req.body?.messageBody);
    res.status(201).json(payload);
  } catch (error) {
    console.error('SEND GROUP MESSAGE ERROR:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to send group message.' });
  }
});

app.patch('/api/messages/rooms/:roomId/read', protect, async (req, res) => {
  // Dummy read for group messages
  res.status(200).json({ success: true, messageIds: [] });
});

app.get('/api/messages/members/scholars', protect, async (req, res) => {
  try {
    const { data: students, error } = await supabase
      .from('students')
      .select('user_id, pdm_id, first_name, last_name, academic_course(course_name)')
      .not('user_id', 'is', null);

    if (error) throw new Error(error.message);

    const items = (students || []).map(s => ({
      user_id: s.user_id,
      student_id: s.pdm_id,
      student_number: s.pdm_id,
      student_name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
      program_name: s.academic_course?.course_name || 'Unknown Program',
      benefactor_name: 'PDM'
    }));

    res.status(200).json({ items });
  } catch (error) {
    console.error('SCHOLARS LIST ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});



