// Extracted profile routes
app.post('/api/profile/setup', protect, async (req, res) => {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      first_name,
      middle_name,
      last_name,
      course_code,
      year_level,
      phone_number,
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({
        error: 'First name and last name are required.',
      });
    }

    const userContext = await loadStudentProfileContextByUserId(userId);
    const accountStudentId =
      userContext?.student?.pdm_id ||
      userContext?.user?.username ||
      null;

    if (!accountStudentId) {
      return res.status(400).json({
        error: 'Student ID is missing from the authenticated account.',
      });
    }

    const registrarStudent = await resolveRegistrarStudentByStudentNumber(
      accountStudentId
    );

    if (!registrarStudent) {
      return res.status(403).json({
        error: 'Student ID is not registered in the registrar records.',
      });
    }

    const courseId = course_code
      ? await resolveCourseIdByCode(course_code)
      : registrarStudent.course_id
        ? (await resolveCourseById(registrarStudent.course_id))?.course_id || null
        : null;

    if (!courseId) {
      return res.status(400).json({
        error: 'Selected course is invalid.',
      });
    }

    const studentPayload = {
      user_id: userId,
      pdm_id: accountStudentId,
      first_name: String(first_name || registrarStudent.first_name || '').trim(),
      middle_name: middle_name
        ? String(middle_name).trim()
        : registrarStudent.middle_name || null,
      last_name: String(last_name || registrarStudent.last_name || '').trim(),
      year_level: year_level ?? registrarStudent.year_level ?? null,
      course_id: courseId,
      gwa: null,
      is_archived: false,
    };

    const { data: existingStudent, error: existingStudentError } = await supabase
      .from('students')
      .select('student_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingStudentError) {
      throw existingStudentError;
    }

    let studentRecord = existingStudent;

    if (existingStudent?.student_id) {
      const { data: updatedStudent, error: updateStudentError } = await supabase
        .from('students')
        .update(studentPayload)
        .eq('student_id', existingStudent.student_id)
        .select('student_id')
        .single();

      if (updateStudentError) {
        throw updateStudentError;
      }

      studentRecord = updatedStudent;
    } else {
      const { data: insertedStudent, error: insertStudentError } = await supabase
        .from('students')
        .insert([studentPayload])
        .select('student_id')
        .single();

      if (insertStudentError) {
        throw insertStudentError;
      }

      studentRecord = insertedStudent;
    }

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        phone_number: phone_number ? String(phone_number).trim() : null,
      })
      .eq('user_id', userId);

    if (userUpdateError) {
      throw userUpdateError;
    }

    const { error: profileUpsertError } = await supabase
      .from('student_profiles')
      .upsert(
        [
          {
            student_id: studentRecord.student_id,
            sex: normalizeStudentProfileSex(registrarStudent.sex_at_birth ?? null),
            learners_reference_number:
              registrarStudent.learners_reference_number ?? null,
          },
        ],
        { onConflict: 'student_id' }
      );

    if (profileUpsertError) {
      throw profileUpsertError;
    }

    const refreshedContext = await loadStudentProfileContextByUserId(userId);

    return res.status(200).json({
      message: 'Profile setup completed successfully.',
      ...(await buildMyProfileResponse(refreshedContext)),
    });
  } catch (error) {
    console.error('PROFILE SETUP ROUTE ERROR:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to complete profile setup.',
    });
  }
});

app.post('/api/auth/upload-avatar', protect, upload.single('image'), async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const context = await loadStudentProfileContextByUserId(userId);

    if (!context?.user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    if (!context.student?.student_id) {
      return res.status(404).json({ error: 'No student profile is linked to this account.' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'An avatar image is required.' });
    }

    const sanitizedFileName = (file.originalname || 'avatar')
      .replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `${userId}/avatar/${Date.now()}-${sanitizedFileName}`;

    const { error: storageError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (storageError) {
      throw storageError;
    }

    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({
        profile_photo_url: storagePath,
      })
      .eq('student_id', context.student.student_id);

    if (studentUpdateError) {
      throw studentUpdateError;
    }

    const avatarUrl = await resolveAvatarUrl(storagePath);
    const refreshedContext = await loadStudentProfileContextByUserId(userId);

    return res.status(200).json({
      message: 'Avatar uploaded successfully.',
      avatarUrl,
      ...(await buildMyProfileResponse(refreshedContext)),
    });
  } catch (error) {
    console.error('AVATAR UPLOAD ERROR:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to upload avatar.',
    });
  }
});

// 5. Account Recovery Lookup Route
app.post('/api/auth/recovery/lookup', async (req, res) => {
  try {
    const accounts = await accountRecoveryService.lookupAccounts(
      req.body?.identifier
    );

    return res.status(200).json({ accounts });
  } catch (error) {
    console.error('ACCOUNT RECOVERY LOOKUP ROUTE ERROR:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to find matching accounts.',
    });
  }
});

// 6. Account Recovery Start Route
app.post('/api/auth/recovery/start', async (req, res) => {
  try {
    const payload = await accountRecoveryService.startRecovery({
      userId: req.body?.user_id,
      channel: req.body?.channel,
      captchaToken: req.body?.captcha_token,
      userAgent: req.get('user-agent') || '',
      userIpAddress: req.ip || req.socket?.remoteAddress || '',
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error('ACCOUNT RECOVERY START ROUTE ERROR:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to start account recovery.',
    });
  }
});

// 7. Account Recovery Resend Code Route
app.post('/api/auth/recovery/resend-code', async (req, res) => {
  try {
    const payload = await accountRecoveryService.resendRecoveryCode(
      req.body?.session_id
    );

    return res.status(200).json(payload);
  } catch (error) {
    console.error('ACCOUNT RECOVERY RESEND ROUTE ERROR:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to resend the recovery code.',
    });
  }
});

// 8. Account Recovery Verify Code Route
app.post('/api/auth/recovery/verify-code', async (req, res) => {
  try {
    const payload = await accountRecoveryService.verifyRecoveryCode({
      sessionId: req.body?.session_id,
      code: req.body?.code,
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error('ACCOUNT RECOVERY VERIFY ROUTE ERROR:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to verify the recovery code.',
    });
  }
});

// 9. Account Recovery Reset Password Route
app.post('/api/auth/recovery/reset-password', async (req, res) => {
  try {
    const payload = await accountRecoveryService.resetPassword({
      resetToken: req.body?.reset_token,
      newPassword: req.body?.new_password,
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error('ACCOUNT RECOVERY RESET ROUTE ERROR:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to reset the password.',
    });
  }
});

// 10. Login Route
app.post('/api/auth/login', async (req, res) => {
  const { student_id, password } = req.body;

  if (!student_id || !password) {
    return res.status(400).json({ error: 'Student ID and password are required' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', student_id)
    .maybeSingle();

  if (error || !data) {
    return res.status(401).json({ error: 'Invalid Student ID or password' });
  }

  const isMatch = await bcrypt.compare(password, data.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid Student ID or password' });
  }

  if (!data.is_otp_verified) {
    return res.status(403).json({ error: 'Please verify your email first' });
  }

  res.status(200).json(await buildAuthResponse(data));
});

app.get('/api/profile/me', protect, async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const context = await loadStudentProfileContextByUserId(userId);

    if (!context?.user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.status(200).json(await buildMyProfileResponse(context));
  } catch (error) {
    console.error('PROFILE ME FETCH ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to load profile.' });
  }
});

app.patch('/api/profile/me', protect, async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const context = await loadStudentProfileContextByUserId(userId);

    if (!context?.user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    if (!context.student?.student_id) {
      return res.status(404).json({ error: 'No student profile is linked to this account.' });
    }

    const payload = req.body ?? {};
    const email = (payload.email ?? '').toString().trim();
    const phoneNumber = (payload.phone_number ?? '').toString().trim();
    const firstName = (payload.first_name ?? '').toString().trim();
    const lastName = (payload.last_name ?? '').toString().trim();
    const courseCode = (payload.course_code ?? '').toString().trim();

    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    let courseId = context.student.course_id ?? null;
    if (courseCode) {
      try {
        const resolvedCourseId = await resolveCourseIdByCode(courseCode);
        if (!resolvedCourseId) {
          return res.status(400).json({ error: 'Selected course is invalid.' });
        }

        courseId = resolvedCourseId;
      } catch (courseError) {
        console.error('Profile course lookup error:', courseError);
        return res.status(500).json({ error: 'Failed to validate course.' });
      }
    }

    const nextUserPayload = {};
    if (email) nextUserPayload.email = email;
    nextUserPayload.phone_number = phoneNumber || null;

    const { error: userUpdateError } = await supabase
      .from('users')
      .update(nextUserPayload)
      .eq('user_id', userId);

    if (userUpdateError) {
      console.error('Profile user update error:', userUpdateError);
      return res.status(500).json({ error: userUpdateError.message || 'Failed to update account information.' });
    }

    const nextStudentPayload = {};
    if (firstName) nextStudentPayload.first_name = firstName;
    if (lastName) nextStudentPayload.last_name = lastName;
    nextStudentPayload.course_id = courseId;

    const { error: studentUpdateError } = await supabase
      .from('students')
      .update(nextStudentPayload)
      .eq('student_id', context.student.student_id);

    if (studentUpdateError) {
      console.error('Profile student update error:', studentUpdateError);
      return res.status(500).json({ error: studentUpdateError.message || 'Failed to update student information.' });
    }

    const normalizedProfilePayload = {
      student_id: context.student.student_id,
      date_of_birth: payload.date_of_birth ?? context.student_profile?.date_of_birth ?? null,
      place_of_birth: payload.place_of_birth ?? context.student_profile?.place_of_birth ?? null,
      sex: normalizeStudentProfileSex(
        payload.sex ?? context.student_profile?.sex ?? null
      ),
      civil_status: payload.civil_status ?? context.student_profile?.civil_status ?? null,
      maiden_name: payload.maiden_name ?? context.student_profile?.maiden_name ?? null,
      religion: payload.religion ?? context.student_profile?.religion ?? null,
      citizenship: payload.citizenship ?? context.student_profile?.citizenship ?? 'Filipino',
      street_address: payload.street_address ?? payload.address ?? context.student_profile?.street_address ?? null,
      subdivision: payload.subdivision ?? context.student_profile?.subdivision ?? null,
      city: payload.city ?? context.student_profile?.city ?? null,
      province: payload.province ?? context.student_profile?.province ?? null,
      zip_code: payload.zip_code ?? context.student_profile?.zip_code ?? null,
      landline_number: payload.landline_number ?? context.student_profile?.landline_number ?? null,
      learners_reference_number:
        payload.learners_reference_number ??
        context.student_profile?.learners_reference_number ??
        null,
    };

    const { error: profileUpdateError } = await supabase
      .from('student_profiles')
      .upsert([normalizedProfilePayload], { onConflict: 'student_id' });

    if (profileUpdateError) {
      console.error('Profile student_profiles upsert error:', profileUpdateError);
      return res.status(500).json({ error: profileUpdateError.message || 'Failed to update profile details.' });
    }

    const refreshedContext = await loadStudentProfileContextByUserId(userId);
    res.status(200).json({
      message: 'Profile updated successfully.',
      ...(await buildMyProfileResponse(refreshedContext)),
    });
  } catch (error) {
    console.error('PROFILE ME UPDATE ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile.' });
  }
});

