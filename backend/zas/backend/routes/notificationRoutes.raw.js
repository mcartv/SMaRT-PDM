// Extracted notification routes
app.get('/api/notifications', protect, async (req, res) => {
  try {
    const payload = await notificationService.listUserNotifications(req.user.user_id, {
      limit: req.query.limit,
      offset: req.query.offset,
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error('NOTIFICATION LIST ROUTE ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to load notifications.' });
  }
});

app.post('/api/internal/notifications/user', async (req, res) => {
  if (!isAuthorizedInternalRequest(req)) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const {
    userId,
    type,
    title,
    message,
    referenceId = null,
    referenceType = null,
    createdAt = null,
  } = req.body ?? {};

  if (!userId || !type || !title || !message) {
    return res.status(400).json({
      error: 'userId, type, title, and message are required.',
    });
  }

  try {
    const notification = await notificationService.createUserNotification({
      userId,
      type,
      title,
      message,
      referenceId,
      referenceType,
      createdAt,
    });

    res.status(201).json({ notification });
  } catch (error) {
    console.error('INTERNAL USER NOTIFICATION ROUTE ERROR:', error);
    res.status(500).json({
      error: error.message || 'Failed to create the user notification.',
    });
  }
});

app.get('/api/openings', protect, async (req, res) => {
  try {
    const payload = await buildApplicantOpeningsPayload(getRequestUserId(req));
    res.status(200).json(payload);
  } catch (error) {
    console.error('OPENINGS ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load scholarship openings.',
    });
  }
});

app.get('/api/openings/latest', protect, async (req, res) => {
  try {
    const latestOpening = await fetchLatestVisibleProgramOpeningForUser(
      getRequestUserId(req)
    );
    res.status(200).json({ item: latestOpening });
  } catch (error) {
    console.error('LATEST OPENING ROUTE ERROR:', error);
    res.status(500).json({
      error: error.message || 'Failed to load the latest scholarship opening.',
    });
  }
});

app.get('/api/applications/me/form-data', protect, async (req, res) => {
  try {
    const payload = await buildSavedFormDataForMobile(req.user.user_id);
    res.status(200).json(payload);
  } catch (error) {
    console.error('FORM DATA ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/renewals/me/current', protect, async (req, res) => {
  try {
    const payload = await buildCurrentRenewalForMobile(req.user.user_id);
    res.status(200).json(payload);
  } catch (error) {
    console.error('RENEWAL ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payouts/me', protect, async (req, res) => {
  try {
    const payload = await fetchMyPayoutSchedules(req.user.user_id);
    res.status(200).json(payload);
  } catch (error) {
    console.error('PAYOUT ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notifications/unread-count', protect, async (req, res) => {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user.user_id);
    res.status(200).json({ unreadCount });
  } catch (error) {
    console.error('NOTIFICATION UNREAD COUNT ROUTE ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to load unread notification count.' });
  }
});

app.patch('/api/notifications/read-all', protect, async (req, res) => {
  try {
    const payload = await notificationService.markAllNotificationsRead(req.user.user_id);
    res.status(200).json(payload);
  } catch (error) {
    console.error('NOTIFICATION MARK ALL READ ROUTE ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to mark notifications as read.' });
  }
});

app.patch('/api/notifications/:id/read', protect, async (req, res) => {
  try {
    const payload = await notificationService.markNotificationRead(
      req.user.user_id,
      req.params.id
    );

    if (!payload) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    res.status(200).json(payload);
  } catch (error) {
    console.error('NOTIFICATION MARK READ ROUTE ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to mark notification as read.' });
  }
});

app.delete('/api/notifications/:id', protect, async (req, res) => {
  try {
    const deleted = await notificationService.deleteNotification(req.user.user_id, req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    res.status(200).json({ deleted: true, notificationId: req.params.id });
  } catch (error) {
    console.error('NOTIFICATION DELETE ROUTE ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to delete notification.' });
  }
});

app.post('/api/notifications/device-token', protect, async (req, res) => {
  const { deviceToken, platform } = req.body ?? {};

  if (!deviceToken || !platform) {
    return res.status(400).json({ error: 'deviceToken and platform are required.' });
  }

  try {
    const payload = await notificationService.registerDeviceToken(req.user.user_id, {
      deviceToken,
      platform,
    });

    res.status(201).json(payload);
  } catch (error) {
    console.error('NOTIFICATION DEVICE TOKEN ROUTE ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to register device token.' });
  }
});

