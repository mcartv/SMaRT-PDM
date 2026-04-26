// Extracted application/opening routes and server bootstrap tail
app.get('/api/applications/me/form-data', protect, async (req, res) => {
  try {
    const draft = await resolveApplicantDraftByUserId(getRequestUserId(req));

    if (!draft) {
      return res.status(200).json({ has_saved_form: false });
    }

    const payload =
      draft.payload && typeof draft.payload === 'object' ? draft.payload : {};
    const opening = draft.opening_id
      ? await resolveOpeningById(draft.opening_id)
      : null;

    res.status(200).json({
      has_saved_form: true,
      ...payload,
      opening: {
        opening_id: opening?.opening_id || draft.opening_id || '',
        opening_title: opening?.opening_title || '',
        program_name: opening?.scholarship_program?.program_name || '',
      },
      draft_updated_at: draft.updated_at || draft.created_at || null,
    });
  } catch (error) {
    console.error('APPLICATION FORM DATA ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load your saved application draft.',
    });
  }
});

app.put('/api/applications/me/form-data', protect, async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const openingId = req.body?.opening?.opening_id?.toString().trim();

    if (!openingId) {
      return res.status(400).json({
        error: 'opening.opening_id is required to save an application draft.',
      });
    }

    const opening = await resolveOpeningById(openingId);
    if (!opening) {
      return res.status(404).json({ error: 'Scholarship opening not found.' });
    }

    if ((opening.posting_status || '').toLowerCase() !== 'open') {
      return res.status(409).json({
        error: 'This scholarship opening is no longer accepting applications.',
      });
    }

    const studentRecord = await resolveStudentByUserId(userId);
    const scholarRecord = studentRecord?.student_id
      ? await resolveScholarRecordForStudent(studentRecord.student_id)
      : null;

    if (
      scholarRecord &&
      !isTesProgramName(opening.scholarship_program?.program_name || '')
    ) {
      return res.status(403).json({
        error: 'Approved scholars can only access TES scholarship openings.',
      });
    }

    const activeApplication = await resolveActiveOpeningApplicationForUser(userId);
    if (activeApplication?.application?.application_id) {
      return res.status(409).json({
        error:
          'You already have an active scholarship application. Finish that application before starting a new one.',
      });
    }

    await upsertApplicantDraftByUserId(userId, {
      openingId,
      payload: req.body ?? {},
    });

    res.status(200).json({
      message: 'Application draft saved.',
      has_saved_form: true,
      opening: {
        opening_id: opening.opening_id,
        opening_title: opening.opening_title || '',
        program_name: opening.scholarship_program?.program_name || '',
      },
    });
  } catch (error) {
    console.error('APPLICATION FORM SAVE ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to save your application draft.',
    });
  }
});

app.get('/api/applications/me/documents', protect, async (req, res) => {
  try {
    const activeApplication = await resolveActiveOpeningApplicationForUser(
      getRequestUserId(req)
    );

    if (!activeApplication?.application?.application_id) {
      const draft = await resolveApplicantDraftByUserId(getRequestUserId(req));
      return res.status(draft ? 409 : 404).json({
        error:
          'Choose a scholarship opening and submit your application first before uploading scholarship requirements.',
      });
    }

    const payload = await buildApplicantDocumentPackage({
      applicationId: activeApplication.application.application_id,
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error('APPLICATION DOCUMENT PACKAGE ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load your scholarship requirements.',
    });
  }
});

app.get('/api/applications/me/status-summary', protect, async (req, res) => {
  try {
    const payload = await buildApplicantStatusSummaryForUser(req.user.user_id);
    res.status(200).json(payload);
  } catch (error) {
    console.error('APPLICATION STATUS SUMMARY ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load your application status.',
    });
  }
});

app.post('/api/applications/me/documents/:documentKey/upload', protect, upload.single('document'), async (req, res) => {
  try {
    const activeApplication = await resolveActiveOpeningApplicationForUser(
      getRequestUserId(req)
    );

    if (!activeApplication?.application?.application_id) {
      const draft = await resolveApplicantDraftByUserId(getRequestUserId(req));
      return res.status(draft ? 409 : 404).json({
        error:
          'Choose a scholarship opening and submit your application first before uploading scholarship requirements.',
      });
    }

    const payload = await uploadApplicationDocumentFile({
      applicationId: activeApplication.application.application_id,
      uploadedBy: activeApplication.student.student_id,
      documentKey: req.params.documentKey,
      file: req.file,
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error('APPLICATION DOCUMENT UPLOAD ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to upload the scholarship requirement.',
    });
  }
});

app.post('/api/openings/:openingId/apply', protect, async (req, res) => {
  try {
    const responsePayload = await submitApplicantOpeningApplication({
      userId: getRequestUserId(req),
      openingId: req.params.openingId,
      incomingPayload: req.body ?? {},
    });

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('OPENING APPLICATION ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to submit your scholarship application.',
    });
  }
});

app.post('/api/applications', protect, async (req, res) => {
  try {
    const openingId =
      req.body?.opening?.opening_id ||
      req.body?.opening_id ||
      req.body?.application?.opening_id ||
      '';

    if (!openingId) {
      return res.status(409).json({
        error:
          'Choose a scholarship opening before submitting your application.',
      });
    }

    const responsePayload = await submitApplicantOpeningApplication({
      userId: getRequestUserId(req),
      openingId,
      incomingPayload: req.body ?? {},
    });

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('LEGACY APPLICATION ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to submit your scholarship application.',
    });
  }
});

app.get('/api/applications/:id', async (req, res) => {
  try {
    const payload = await buildApplicationDetails(req.params.id);
    res.status(200).json(payload);
  } catch (error) {
    console.error('Application detail fetch error:', error);
    res.status(500).json({ error: error.message || 'Failed to load application details.' });
  }
});

// --- SOCKET.IO USER CHANNELS ---
io.on('connection', (socket) => {
  console.log(`User connected via Socket.io: ${socket.id}`);
  if (socket.user?.user_id) {
    socket.join(`user:${socket.user.user_id}`);
  }

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// ===== 404 HANDLER - MUST BE LAST =====
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: `Cannot ${req.method} ${req.originalUrl}`,
    message: 'The requested endpoint does not exist',
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/socket-health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/courses',
      'GET /api/faqs',
      'GET /api/profile/me',
      'GET /api/openings'
    ]
  });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on port ${PORT}`);
});

