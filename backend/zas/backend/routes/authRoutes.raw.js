// Extracted auth/register/login/recovery routes
app.post('/api/auth/register', async (req, res) => {
  let { email, password, student_id } = req.body;

  console.log('DEBUG (Backend): Received registration request body:', req.body);

  try {
    email = (email || '').toString().trim().toLowerCase();
    student_id = (student_id || '').toString().trim();

    if (!email || !password || !student_id) {
      return res.status(400).json({ error: 'Email, password, and Student ID are required' });
    }

    accountRecoveryService.ensurePasswordPolicy(password);

    const studentIdRegex = /^PDM-\d{4}-\d{6}$/;
    if (!studentIdRegex.test(student_id)) {
      return res.status(400).json({
        error: 'Student ID must be in the format PDM-YYYY-NNNNNN (e.g. PDM-2023-000001)',
      });
    }

    const registrarStudent = await resolveRegistrarStudentByStudentNumber(
      student_id
    );

    if (!registrarStudent) {
      return res.status(403).json({
        error: 'Student ID is not registered in the registrar records.',
      });
    }

    const { data: existingUserByStudentId, error: studentIdCheckError } = await supabase
      .from('users')
      .select('username')
      .eq('username', student_id)
      .maybeSingle();

    if (studentIdCheckError) {
      console.error('Supabase Student ID Check Error:', studentIdCheckError);
      return res.status(500).json({ error: 'Database error during student ID check' });
    }

    if (existingUserByStudentId) {
      return res.status(409).json({ error: 'Student ID already registered' });
    }

    const { data: existingUserByEmail, error: emailCheckError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (emailCheckError) {
      console.error('Supabase Email Check Error:', emailCheckError);
      return res.status(500).json({ error: 'Database error during email check' });
    }

    if (existingUserByEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    for (const [storedEmail, pending] of pendingRegistrationStore.entries()) {
      if (Date.now() > pending.expiresAt) {
        pendingRegistrationStore.delete(storedEmail);
        otpStore.delete(storedEmail);
        continue;
      }

      if (storedEmail === email || pending.student_id === student_id) {
        otpStore.delete(storedEmail);
        pendingRegistrationStore.delete(storedEmail);
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    pendingRegistrationStore.set(email, {
      email,
      student_id,
      registrar_student: registrarStudent,
      password_hash: hashedPassword,
      role: 'Student',
      expiresAt,
    });

    otpStore.set(email, { otp, expiresAt });

    await sendOTPEmail(email, otp);

    return res.status(200).json({
      message: 'OTP sent. Complete verification to finish registration.',
      user: {
        user_id: null,
        email,
        student_id,
        role: 'Student',
        is_verified: false,
      },
    });
  } catch (error) {
    console.error('REGISTER ROUTE ERROR:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process registration',
    });
  }
});

// 2. Verify OTP Route
app.post('/api/auth/verify-otp', async (req, res) => {
  let { email, otp } = req.body;

  try {
    email = (email || '').toString().trim().toLowerCase();
    otp = (otp || '').toString().trim();

    const record = otpStore.get(email);
    const pendingRegistration = pendingRegistrationStore.get(email);

    if (!record || !pendingRegistration) {
      return res.status(400).json({ error: 'No pending registration found or OTP already used' });
    }

    if (Date.now() > record.expiresAt || Date.now() > pendingRegistration.expiresAt) {
      otpStore.delete(email);
      pendingRegistrationStore.delete(email);
      return res.status(400).json({ error: 'OTP has expired. Please register again.' });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const registrarStudent = await resolveRegistrarStudentByStudentNumber(
      pendingRegistration.student_id
    );

    if (!registrarStudent) {
      otpStore.delete(email);
      pendingRegistrationStore.delete(email);
      return res.status(403).json({
        error: 'Student ID is not registered in the registrar records.',
      });
    }

    const { data: existingUserByStudentId, error: studentIdCheckError } = await supabase
      .from('users')
      .select('username')
      .eq('username', pendingRegistration.student_id)
      .maybeSingle();

    if (studentIdCheckError) {
      console.error('Supabase Student ID Recheck Error:', studentIdCheckError);
      return res.status(500).json({ error: 'Database error during final student ID validation' });
    }

    if (existingUserByStudentId) {
      otpStore.delete(email);
      pendingRegistrationStore.delete(email);
      return res.status(409).json({ error: 'Student ID already registered' });
    }

    const { data: existingUserByEmail, error: emailCheckError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (emailCheckError) {
      console.error('Supabase Email Recheck Error:', emailCheckError);
      return res.status(500).json({ error: 'Database error during final email validation' });
    }

    if (existingUserByEmail) {
      otpStore.delete(email);
      pendingRegistrationStore.delete(email);
      return res.status(409).json({ error: 'Email already registered' });
    }

    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          email: pendingRegistration.email,
          username: pendingRegistration.student_id,
          password_hash: pendingRegistration.password_hash,
          is_otp_verified: true,
          role: pendingRegistration.role || 'Student',
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Supabase Insert Error During OTP Verification:', insertError);
      return res.status(500).json({ error: 'Failed to complete registration' });
    }

    // --- BEGIN: Auto-create student profile from registrar data ---
    const registrarStudentData = pendingRegistration.registrar_student;
    if (registrarStudentData && insertedUser.user_id) {
      const studentPayload = {
        user_id: insertedUser.user_id,
        pdm_id: registrarStudentData.student_number,
        first_name: registrarStudentData.first_name,
        middle_name: registrarStudentData.middle_name,
        last_name: registrarStudentData.last_name,
        course_id: registrarStudentData.course_id,
        year_level: registrarStudentData.year_level,
        account_status: 'Verified',
        is_profile_complete: false,
      };

      const { error: studentInsertError } = await supabase
        .from('students')
        .insert([studentPayload]);

      if (studentInsertError) {
        // The user is created but the student profile is not.
        // For now, just log it. A more robust solution would use a transaction.
        console.error('Failed to create student record during registration:', studentInsertError);
      } else {
        // Link the user_id back to the registry to mark it as "claimed"
        const { error: registryUpdateError } = await supabase
          .from('student_registry')
          .update({ user_id: insertedUser.user_id })
          .eq('registry_id', registrarStudentData.registry_id);

        if (registryUpdateError) {
          console.warn('Failed to link user to student registry:', registryUpdateError);
        }
      }
    }
    // --- END: Auto-create student profile ---

    otpStore.delete(email);
    pendingRegistrationStore.delete(email);

    return res.status(200).json({
      ...(await buildAuthResponse(insertedUser)),
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('VERIFY OTP ROUTE ERROR:', error);
    return res.status(500).json({
      error: error.message || 'Failed to verify OTP',
    });
  }
});

// 3. Resend OTP Route
app.post('/api/auth/resend-otp', async (req, res) => {
  let { email } = req.body;

  try {
    email = (email || '').toString().trim().toLowerCase();

    const pendingRegistration = pendingRegistrationStore.get(email);

    if (!pendingRegistration) {
      return res.status(400).json({ error: 'No pending registration found. Please register again.' });
    }

    if (Date.now() > pendingRegistration.expiresAt) {
      pendingRegistrationStore.delete(email);
      otpStore.delete(email);
      return res.status(400).json({ error: 'Pending registration expired. Please register again.' });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    pendingRegistrationStore.set(email, {
      ...pendingRegistration,
      expiresAt,
    });

    otpStore.set(email, { otp, expiresAt });

    await sendOTPEmail(email, otp);

    return res.status(200).json({ message: 'OTP resent successfully' });
  } catch (error) {
    console.error('RESEND OTP ROUTE ERROR:', error);
    return res.status(500).json({
      error: error.message || 'Failed to resend OTP',
    });
  }
});

// 4. Cancel Registration Route
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
