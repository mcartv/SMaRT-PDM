require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const multer = require('multer');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to your app's domain/origins
    methods: ["GET", "POST"]
  }
});
app.use(cors());
app.use(express.json());

// Configure multer to hold the uploaded file in memory temporarily
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
// CRITICAL: Use your `service_role` secret key here, NOT the `anon` / publishable key.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Temporary in-memory store for OTPs (e.g., { "user@email.com": { otp: "123456", expiresAt: 171146... } })
// In production, you could also save this to a 'otps' table in Supabase.
const otpStore = new Map();

// Configure the email sender
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'pelimavenice.pdm@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD 
  }
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildAuthUser(user) {
  return {
    id: user.user_id,
    user_id: user.user_id,
    email: user.email,
    student_id: user.username,
    avatar_url: user.profile_image_url ?? null,
  };
}

function buildAuthResponse(user) {
  return {
    message: 'Login successful',
    token: `mock_jwt_token_${user.user_id}`,
    user: buildAuthUser(user),
  };
}

const LEGACY_DOCUMENT_DEFINITIONS = [
  {
    id: 'loi',
    name: 'Letter of Intent',
    aliases: ['letter of intent', 'loi', 'intent'],
  },
  {
    id: 'cor',
    name: 'Certificate of Registration',
    aliases: ['certificate of registration', 'cor', 'registration'],
  },
  {
    id: 'grades',
    name: 'Grade Form',
    aliases: ['grade form', 'grades', 'report of grades'],
  },
  {
    id: 'indigency',
    name: 'Certificate of Indigency',
    aliases: ['certificate of indigency', 'indigency'],
  },
  {
    id: 'valid_id',
    name: 'Valid ID',
    aliases: ['valid id', 'government id', 'identification'],
  },
];

function normalizeLookupValue(value) {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferDocumentKey(document = {}) {
  const candidates = [
    document.document_type,
    document.program_requirements?.requirement_name,
    document.program_requirements?.name,
    document.file_name,
  ]
    .filter(Boolean)
    .map((value) => normalizeLookupValue(value));

  for (const definition of LEGACY_DOCUMENT_DEFINITIONS) {
    if (
      candidates.some((candidate) =>
        definition.aliases.some((alias) => candidate.includes(alias))
      )
    ) {
      return definition.id;
    }
  }

  return document.requirement_id
    ? `requirement-${document.requirement_id}`
    : normalizeLookupValue(document.document_type || document.file_name || 'document').replace(/\s+/g, '_');
}

function deriveDocumentReviewStatus(document = {}, review = null) {
  const preferredStatus = normalizeLookupValue(
    review?.review_status ?? document.file_status
  );

  if (preferredStatus === 'verified') return 'verified';
  if (preferredStatus === 'rejected' || preferredStatus === 're upload') return 'rejected';
  if (preferredStatus === 'flagged') return 'flagged';
  if (preferredStatus === 'uploaded') return 'uploaded';
  return document.file_url ? 'uploaded' : 'pending';
}

function deriveApplicationDocumentStatus(documents = []) {
  const uploadedCount = documents.filter((document) => !!document.file_url).length;
  const verifiedCount = documents.filter(
    (document) => deriveDocumentReviewStatus(document) === 'verified'
  ).length;
  const needsReview = documents.some((document) => {
    const status = deriveDocumentReviewStatus(document);
    return status === 'rejected' || status === 'flagged' || status === 'uploaded';
  });

  if (uploadedCount === 0) {
    return 'Missing Docs';
  }

  if (needsReview) {
    return 'Under Review';
  }

  if (verifiedCount > 0 && verifiedCount === uploadedCount) {
    return 'Documents Ready';
  }

  return 'Under Review';
}

async function buildApplicationDetails(applicationId) {
  const { data: applicationRecord, error: applicationError } = await supabase
    .from('applications')
    .select(`
      application_id,
      student_id,
      program_id,
      application_status,
      document_status,
      submission_date,
      is_disqualified,
      disqualification_reason,
      evaluator_id,
      students (
        user_id,
        first_name,
        middle_name,
        last_name,
        pdm_id,
        gwa,
        year_level,
        course_id,
        barangay
      ),
      scholarship_programs (
        program_id,
        program_name
      )
    `)
    .eq('application_id', applicationId)
    .single();

  if (applicationError) {
    throw applicationError;
  }

  const [
    formSubmissionResult,
    personalDetailsResult,
    familyMembersResult,
    educationRecordsResult,
    documentsResult,
    reviewsResult,
  ] = await Promise.all([
    supabase
      .from('application_form_submissions')
      .select('*')
      .eq('application_id', applicationId)
      .maybeSingle(),
    supabase
      .from('application_personal_details')
      .select('*')
      .eq('application_id', applicationId)
      .maybeSingle(),
    supabase
      .from('application_family_members')
      .select('*')
      .eq('application_id', applicationId)
      .order('relation_type', { ascending: true }),
    supabase
      .from('application_education_records')
      .select('*')
      .eq('application_id', applicationId)
      .order('education_level', { ascending: true }),
    supabase
      .from('application_documents_submitted')
      .select(`
        *,
        program_requirements (*)
      `)
      .eq('application_id', applicationId)
      .order('uploaded_at', { ascending: true }),
    supabase
      .from('application_document_reviews')
      .select('*')
      .eq('application_id', applicationId),
  ]);

  const resultErrors = [
    formSubmissionResult.error,
    personalDetailsResult.error,
    familyMembersResult.error,
    educationRecordsResult.error,
    documentsResult.error,
    reviewsResult.error,
  ].filter(Boolean);

  if (resultErrors.length > 0) {
    throw resultErrors[0];
  }

  const student = applicationRecord.students || {};
  let userContact = { email: null, phone_number: null };

  if (student.user_id) {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, phone_number')
      .eq('user_id', student.user_id)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (userData) {
      userContact = userData;
    }
  }

  let courseCode = null;
  if (student.course_id) {
    const { data: courseData, error: courseError } = await supabase
      .from('academic_course')
      .select('course_code')
      .eq('course_id', student.course_id)
      .maybeSingle();

    if (courseError) {
      throw courseError;
    }

    courseCode = courseData?.course_code ?? null;
  }

  const reviewByKey = new Map(
    (reviewsResult.data || []).map((review) => [review.document_key, review])
  );

  const normalizedDocuments = (documentsResult.data || []).map((document) => {
    const documentKey = inferDocumentKey(document);
    const review = reviewByKey.get(documentKey) || null;
    const requirementMeta = document.program_requirements || {};

    return {
      id: documentKey,
      document_key: documentKey,
      requirement_id: document.requirement_id,
      requirement_name:
        requirementMeta.requirement_name ??
        requirementMeta.name ??
        document.document_type ??
        document.file_name ??
        'Document',
      name:
        requirementMeta.requirement_name ??
        requirementMeta.name ??
        document.document_type ??
        document.file_name ??
        'Document',
      document_type: document.document_type ?? null,
      file_name: document.file_name ?? null,
      url: review?.file_url ?? document.file_url ?? null,
      file_url: review?.file_url ?? document.file_url ?? null,
      status: deriveDocumentReviewStatus(document, review),
      file_status: document.file_status ?? 'pending',
      admin_comment: review?.admin_comment ?? document.notes ?? '',
      notes: document.notes ?? null,
      uploaded_at: document.uploaded_at ?? null,
      reviewed_at: review?.reviewed_at ?? document.reviewed_at ?? null,
    };
  });

  return {
    application: {
      application_id: applicationRecord.application_id,
      student_id: applicationRecord.student_id,
      program_id: applicationRecord.program_id,
      application_status: applicationRecord.application_status,
      document_status: applicationRecord.document_status,
      submission_date: applicationRecord.submission_date,
      is_disqualified: !!applicationRecord.is_disqualified,
      disqualification_reason: applicationRecord.disqualification_reason,
      evaluator_id: applicationRecord.evaluator_id ?? null,
    },
    student: {
      user_id: student.user_id ?? null,
      first_name: student.first_name ?? null,
      middle_name: student.middle_name ?? null,
      last_name: student.last_name ?? null,
      pdm_id: student.pdm_id ?? null,
      gwa: student.gwa ?? null,
      year_level: student.year_level ?? null,
      course_code: courseCode,
      email: userContact.email ?? null,
      phone_number: userContact.phone_number ?? null,
      program_name: applicationRecord.scholarship_programs?.program_name ?? null,
      barangay: student.barangay ?? null,
    },
    form_submission: formSubmissionResult.data ?? null,
    personal_details: personalDetailsResult.data ?? null,
    family_members: familyMembersResult.data ?? [],
    education_records: educationRecordsResult.data ?? [],
    documents: normalizedDocuments,
  };
}

async function sendOTPEmail(userEmail, otpCode) {
  const mailOptions = {
    from: '"SMaRT-PDM Admin" <pelimavenice.pdm@gmail.com>',
    to: userEmail,
    subject: 'Your SMaRT-PDM Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to SMaRT-PDM!</h2>
        <p>Your 6-digit verification code is:</p>
        <h1 style="letter-spacing: 5px; color: #7C4A2E;">${otpCode}</h1>
        <p>Please enter this code in the app to verify your account. It will expire in 10 minutes.</p>
      </div>
    `
  };
  await transporter.sendMail(mailOptions);
}

// --- ROUTES ---

// 1. Register Route
app.post('/api/auth/register', async (req, res) => {
  const { email, password, student_id } = req.body; // username is no longer expected as a primary input

  console.log('DEBUG (Backend): Received registration request body:', req.body);

  // 1. Initial required fields check
  // Validate required fields: email, password, and student_id
  if (!email || !password || !student_id) {
    return res.status(400).json({ error: 'Email, password, and Student ID are required' });
  }

  // 2. Server-side validation for student_id format (e.g., PDM-YYYY-NNNNNN)
  const studentIdRegex = /^PDM-\d{4}-\d{6}$/;
  if (!studentIdRegex.test(student_id)) {
    return res.status(400).json({ error: 'Student ID must be in the format PDM-YYYY-NNNNNN (e.g., PDM-2023-000001)' });
  }

  // 3. Check student_id uniqueness
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

  // 4. Check email uniqueness (if not already handled by DB constraint)
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

  // Hash the password securely
  const hashedPassword = await bcrypt.hash(password, 10);

  // Save the user credentials to Supabase
  const { data, error } = await supabase
    .from('users')
    .insert([{
      email,
      username: student_id,
      password_hash: hashedPassword,
      is_otp_verified: false,
      role: 'Student',
    }])
    .select()
    .single();

  if (error) {
    console.error('Supabase Insert Error:', error);
    return res.status(500).json({ error: 'Database error during registration' });
  }

  const otp = generateOTP();
  // Store OTP with a 10-minute expiration
  otpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  // Send email in the background (DO NOT use 'await' here so we don't hold up the Flutter app)
  sendOTPEmail(email, otp)
    .then(() => console.log(`OTP sent to ${email}`))
    .catch(err => console.error('Error sending email:', err));

  // Respond immediately so Flutter transitions to the OTP screen instantly
  res.status(200).json({
    message: 'Registration successful. OTP sent.',
    user: buildAuthUser(data),
  });
});

// 2. Verify OTP Route
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore.get(email);

  if (!record) return res.status(400).json({ error: 'No OTP found or already verified' });
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP has expired' });
  }
  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

  // OTP is correct - clear it from store
  otpStore.delete(email);
  
  // Update user's OTP verification status in Supabase
  const { error } = await supabase
    .from('users')
    .update({ is_otp_verified: true })
    .eq('email', email);

  if (error) return res.status(500).json({ error: 'Failed to verify user in database' });

  const { data: verifiedUser, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (userError || !verifiedUser) {
    return res.status(500).json({ error: 'Failed to load verified user.' });
  }

  res.status(200).json({
    ...buildAuthResponse(verifiedUser),
    message: 'Email verified successfully',
  });
});

// 3. Resend OTP Route
app.post('/api/auth/resend-otp', (req, res) => {
  const { email } = req.body;
  const otp = generateOTP();
  
  otpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  sendOTPEmail(email, otp).catch(err => console.error('Error resending email:', err));
  
  res.status(200).json({ message: 'OTP resent successfully' });
});

// 4. Upload Avatar Route
app.post('/api/auth/upload-avatar', upload.single('image'), async (req, res) => {
  const { email } = req.body;
  const file = req.file;

  if (!email || !file) {
    return res.status(400).json({ error: 'Email and image file are required' });
  }

  try {
    // 1. Upload file to Supabase Storage
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

    if (storageError) throw storageError;

    // 2. Get the public URL of the uploaded image
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const avatarUrl = publicUrlData.publicUrl;

    // 3. Save URL to users table if the column exists in your schema.
    const { error: updateError } = await supabase
      .from('users')
      .update({ profile_image_url: avatarUrl })
      .eq('email', email);

    if (updateError) {
      console.warn('Avatar URL was uploaded but not saved to users table:', updateError.message);
    }

    res.status(200).json({ message: 'Upload successful', avatarUrl });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// 5. Login Route
app.post('/api/auth/login', async (req, res) => {
  const { student_id, password } = req.body; // Expect student_id for login

  if (!student_id || !password) {
    return res.status(400).json({ error: 'Student ID and password are required' });
  }

  // Fetch the user from Supabase using student_id
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', student_id)
    .maybeSingle();

  if (error || !data) {
    return res.status(401).json({ error: 'Invalid Student ID or password' });
  }

  // Compare the provided password with the hashed password in the database
  const isMatch = await bcrypt.compare(password, data.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid Student ID or password' });
  }

  if (!data.is_otp_verified) {
    return res.status(403).json({ error: 'Please verify your email first' });
  }

  // Generate a real JWT token here in production
  res.status(200).json(buildAuthResponse(data));
});

app.get('/api/scholarship-programs', async (req, res) => {
  const { data, error } = await supabase
    .from('scholarship_programs')
    .select('program_id, program_name')
    .order('program_name', { ascending: true });

  if (error) {
    console.error('Error fetching scholarship programs:', error);
    return res.status(500).json({ error: 'Failed to fetch scholarship programs' });
  }

  res.status(200).json(data ?? []);
});

app.post('/api/applications', async (req, res) => {
  const {
    account = {},
    application = {},
    personal = {},
    address = {},
    contact = {},
    family = {},
    academic = {},
    support = {},
    discipline = {},
    essays = {},
    certification = {},
    documents = {},
  } = req.body ?? {};

  if (!account.user_id || !account.student_id || !contact.email) {
    return res.status(400).json({ error: 'Missing required account details.' });
  }

  if (!application.program_id) {
    return res.status(400).json({ error: 'Scholarship program is required.' });
  }

  if (
    academic.student_number &&
    academic.student_number.trim() &&
    academic.student_number.trim() != account.student_id
  ) {
    return res.status(400).json({ error: 'Student number must match the logged-in student ID.' });
  }

  const { data: programData, error: programError } = await supabase
    .from('scholarship_programs')
    .select('program_id')
    .eq('program_id', application.program_id)
    .maybeSingle();

  if (programError) {
    console.error('Scholarship program lookup error:', programError);
    return res.status(500).json({ error: 'Failed to validate scholarship program.' });
  }

  if (!programData) {
    return res.status(400).json({ error: 'Selected scholarship program is invalid.' });
  }

  let courseId = null;
  if (academic.current_course_code) {
    const { data: courseData, error: courseError } = await supabase
      .from('academic_course')
      .select('course_id, course_code')
      .eq('course_code', academic.current_course_code)
      .maybeSingle();

    if (courseError) {
      console.error('Course lookup error:', courseError);
      return res.status(500).json({ error: 'Failed to validate course.' });
    }

    if (!courseData) {
      return res.status(400).json({ error: 'Selected course is invalid.' });
    }

    courseId = courseData.course_id;
  }

  const studentPayload = {
    user_id: account.user_id,
    pdm_id: account.student_id,
    first_name: personal.first_name ?? '',
    middle_name: personal.middle_name ?? null,
    last_name: personal.last_name ?? '',
    barangay: address.barangay ?? null,
    year_level: academic.current_year_level ?? null,
    course_id: courseId,
    gwa: null,
    is_archived: false,
  };

  const { data: existingStudent, error: studentFetchError } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', account.user_id)
    .maybeSingle();

  if (studentFetchError) {
    console.error('Student fetch error:', studentFetchError);
    return res.status(500).json({ error: 'Failed to load student profile.' });
  }

  let studentRecord = existingStudent;
  if (existingStudent) {
    const { data: updatedStudent, error: studentUpdateError } = await supabase
      .from('students')
      .update(studentPayload)
      .eq('student_id', existingStudent.student_id)
      .select('student_id')
      .single();

    if (studentUpdateError) {
      console.error('Student update error:', studentUpdateError);
      return res.status(500).json({ error: 'Failed to update student profile.' });
    }

    studentRecord = updatedStudent;
  } else {
    const { data: insertedStudent, error: studentInsertError } = await supabase
      .from('students')
      .insert([studentPayload])
      .select('student_id')
      .single();

    if (studentInsertError) {
      console.error('Student insert error:', studentInsertError);
      return res.status(500).json({ error: 'Failed to create student profile.' });
    }

    studentRecord = insertedStudent;
  }

  const { error: userUpdateError } = await supabase
    .from('users')
    .update({
      email: contact.email,
      phone_number: contact.mobile_number ?? null,
    })
    .eq('user_id', account.user_id);

  if (userUpdateError) {
    console.error('User contact update error:', userUpdateError);
    return res.status(500).json({ error: 'Failed to update account contact information.' });
  }

  const { data: existingApplication, error: existingApplicationError } = await supabase
    .from('applications')
    .select('application_id, application_status, document_status, evaluator_id')
    .eq('student_id', studentRecord.student_id)
    .eq('program_id', application.program_id)
    .in('application_status', ['Pending Review', 'Interview'])
    .eq('is_disqualified', false)
    .maybeSingle();

  if (existingApplicationError) {
    console.error('Existing application lookup error:', existingApplicationError);
    return res.status(500).json({ error: 'Failed to load existing application.' });
  }

  let savedApplication;
  if (existingApplication) {
    const { data: updatedApplication, error: updateError } = await supabase
      .from('applications')
      .update({
        student_id: studentRecord.student_id,
        program_id: application.program_id,
        submission_date: new Date().toISOString(),
      })
      .eq('application_id', existingApplication.application_id)
      .select('application_id, application_status, submission_date, document_status')
      .single();

    if (updateError) {
      console.error('Application update error:', updateError);
      return res.status(500).json({ error: updateError.message || 'Failed to update application.' });
    }

    savedApplication = updatedApplication;
  } else {
    const { data: insertedApplication, error: insertError } = await supabase
      .from('applications')
      .insert([{ 
        student_id: studentRecord.student_id,
        program_id: application.program_id,
        application_status: 'Pending Review',
        submission_date: new Date().toISOString(),
        document_status: 'Missing Docs',
      }])
      .select('application_id, application_status, submission_date, document_status')
      .single();

    if (insertError) {
      console.error('Application insert error:', insertError);
      return res.status(500).json({ error: insertError.message || 'Failed to submit application.' });
    }

    savedApplication = insertedApplication;
  }

  const applicationId = savedApplication.application_id;

  const formSubmissionPayload = {
    application_id: applicationId,
    user_id: account.user_id,
    contact_email: contact.email ?? null,
    mobile_number: contact.mobile_number ?? null,
    landline: contact.landline ?? null,
    financial_support: support.financial_support ?? null,
    parent_guardian_address: family.parent_guardian_address ?? null,
    parent_native_status: family.parent_native_status ?? null,
    parent_marilao_residency_duration: family.parent_marilao_residency_duration ?? null,
    parent_previous_town_province: family.parent_previous_town_province ?? null,
    scholarship_history: support.scholarship_history ?? false,
    scholarship_elementary: support.scholarship_elementary ?? false,
    scholarship_high_school: support.scholarship_high_school ?? false,
    scholarship_college: support.scholarship_college ?? false,
    scholarship_others: support.scholarship_others ?? false,
    scholarship_others_specify: support.scholarship_others_specify ?? null,
    scholarship_details: support.scholarship_details ?? null,
    disciplinary_action: discipline.disciplinary_action ?? false,
    disciplinary_explanation: discipline.disciplinary_explanation ?? null,
    describe_yourself_essay: essays.describe_yourself_essay ?? null,
    aims_and_ambition_essay: essays.aims_and_ambition_essay ?? null,
    certification_read: certification.certification_read ?? false,
    agree: certification.agree ?? false,
  };

  const { error: formSubmissionError } = await supabase
    .from('application_form_submissions')
    .upsert([formSubmissionPayload], { onConflict: 'application_id' });

  if (formSubmissionError) {
    console.error('Application form submission upsert error:', formSubmissionError);
    return res.status(500).json({ error: formSubmissionError.message || 'Failed to save application form submission.' });
  }

  const personalDetailsPayload = {
    application_id: applicationId,
    first_name: personal.first_name ?? null,
    middle_name: personal.middle_name ?? null,
    last_name: personal.last_name ?? null,
    maiden_name: personal.maiden_name ?? null,
    age: personal.age ?? null,
    date_of_birth: personal.date_of_birth ?? null,
    sex: personal.sex ?? null,
    place_of_birth: personal.place_of_birth ?? null,
    citizenship: personal.citizenship ?? null,
    civil_status: personal.civil_status ?? null,
    religion: personal.religion ?? null,
    address_block: address.block ?? null,
    address_lot: address.lot ?? null,
    address_phase: address.phase ?? null,
    address_street: address.street ?? null,
    address_subdivision: address.subdivision ?? null,
    barangay: address.barangay ?? null,
    city_municipality: address.city_municipality ?? null,
    province: address.province ?? null,
    zip_code: address.zip_code ?? null,
  };

  const { error: personalDetailsError } = await supabase
    .from('application_personal_details')
    .upsert([personalDetailsPayload], { onConflict: 'application_id' });

  if (personalDetailsError) {
    console.error('Application personal details upsert error:', personalDetailsError);
    return res.status(500).json({ error: personalDetailsError.message || 'Failed to save personal details.' });
  }

  const familyMemberPayloads = [
    {
      relation_type: 'father',
      last_name: family.father?.last_name ?? null,
      first_name: family.father?.first_name ?? null,
      middle_name: family.father?.middle_name ?? null,
      mobile_number: family.father?.mobile ?? null,
      educational_attainment: family.father?.educational_attainment ?? null,
      occupation: family.father?.occupation ?? null,
      company_name_and_address: family.father?.company_name_and_address ?? null,
    },
    {
      relation_type: 'mother',
      last_name: family.mother?.last_name ?? null,
      first_name: family.mother?.first_name ?? null,
      middle_name: family.mother?.middle_name ?? null,
      mobile_number: family.mother?.mobile ?? null,
      educational_attainment: family.mother?.educational_attainment ?? null,
      occupation: family.mother?.occupation ?? null,
      company_name_and_address: family.mother?.company_name_and_address ?? null,
    },
    {
      relation_type: 'sibling',
      last_name: family.sibling?.last_name ?? null,
      first_name: family.sibling?.first_name ?? null,
      middle_name: family.sibling?.middle_name ?? null,
      mobile_number: family.sibling?.mobile ?? null,
      educational_attainment: null,
      occupation: null,
      company_name_and_address: null,
    },
    {
      relation_type: 'guardian',
      last_name: family.guardian?.last_name ?? null,
      first_name: family.guardian?.first_name ?? null,
      middle_name: family.guardian?.middle_name ?? null,
      mobile_number: family.guardian?.mobile ?? null,
      educational_attainment: family.guardian?.educational_attainment ?? null,
      occupation: family.guardian?.occupation ?? null,
      company_name_and_address: family.guardian?.company_name_and_address ?? null,
    },
  ].map((member) => ({
    application_id: applicationId,
    ...member,
  }));

  const { error: familyMembersError } = await supabase
    .from('application_family_members')
    .upsert(familyMemberPayloads, { onConflict: 'application_id,relation_type' });

  if (familyMembersError) {
    console.error('Application family members upsert error:', familyMembersError);
    return res.status(500).json({ error: familyMembersError.message || 'Failed to save family members.' });
  }

  const educationRecordPayloads = [
    {
      education_level: 'college',
      school_name: academic.college_school ?? null,
      school_address: academic.college_address ?? null,
      honors_awards: academic.college_honors ?? null,
      club_org: academic.college_club ?? null,
      year_graduated: academic.college_year_graduated ?? null,
      course_code: null,
      year_level: null,
      section: null,
      student_number: null,
      lrn: null,
    },
    {
      education_level: 'high_school',
      school_name: academic.high_school_school ?? null,
      school_address: academic.high_school_address ?? null,
      honors_awards: academic.high_school_honors ?? null,
      club_org: academic.high_school_club ?? null,
      year_graduated: academic.high_school_year_graduated ?? null,
      course_code: null,
      year_level: null,
      section: null,
      student_number: null,
      lrn: null,
    },
    {
      education_level: 'senior_high',
      school_name: academic.senior_high_school ?? null,
      school_address: academic.senior_high_address ?? null,
      honors_awards: academic.senior_high_honors ?? null,
      club_org: academic.senior_high_club ?? null,
      year_graduated: academic.senior_high_year_graduated ?? null,
      course_code: null,
      year_level: null,
      section: null,
      student_number: null,
      lrn: null,
    },
    {
      education_level: 'elementary',
      school_name: academic.elementary_school ?? null,
      school_address: academic.elementary_address ?? null,
      honors_awards: academic.elementary_honors ?? null,
      club_org: academic.elementary_club ?? null,
      year_graduated: academic.elementary_year_graduated ?? null,
      course_code: null,
      year_level: null,
      section: null,
      student_number: null,
      lrn: null,
    },
    {
      education_level: 'current_enrollment',
      school_name: null,
      school_address: null,
      honors_awards: null,
      club_org: null,
      year_graduated: null,
      course_code: academic.current_course_code ?? null,
      year_level: academic.current_year_level ?? null,
      section: academic.current_section ?? null,
      student_number: academic.student_number ?? null,
      lrn: academic.lrn ?? null,
    },
  ].map((record) => ({
    application_id: applicationId,
    ...record,
  }));

  const { error: educationRecordsError } = await supabase
    .from('application_education_records')
    .upsert(educationRecordPayloads, { onConflict: 'application_id,education_level' });

  if (educationRecordsError) {
    console.error('Application education records upsert error:', educationRecordsError);
    return res.status(500).json({ error: educationRecordsError.message || 'Failed to save education records.' });
  }

  const submittedDocuments = Array.isArray(documents.records) ? documents.records : [];
  if (submittedDocuments.length > 0) {
    const documentPayloads = submittedDocuments.map((document) => ({
      application_id: applicationId,
      requirement_id: document.requirement_id ?? null,
      document_type: document.document_type ?? null,
      file_url: document.file_url ?? null,
      file_name: document.file_name ?? null,
      file_status: document.file_status ?? 'uploaded',
      uploaded_at: document.uploaded_at ?? new Date().toISOString(),
      reviewed_at: document.reviewed_at ?? null,
      notes: document.notes ?? null,
    }));

    const { error: documentsError } = await supabase
      .from('application_documents_submitted')
      .upsert(documentPayloads, { onConflict: 'application_id,requirement_id' });

    if (documentsError) {
      console.error('Application submitted documents upsert error:', documentsError);
      return res.status(500).json({ error: documentsError.message || 'Failed to save submitted documents.' });
    }

    const nextDocumentStatus = deriveApplicationDocumentStatus(documentPayloads);
    const { error: applicationStatusError } = await supabase
      .from('applications')
      .update({ document_status: nextDocumentStatus })
      .eq('application_id', applicationId);

    if (applicationStatusError) {
      console.error('Application document status update error:', applicationStatusError);
      return res.status(500).json({ error: applicationStatusError.message || 'Failed to update application document status.' });
    }
  }

  let detailedApplication;
  try {
    detailedApplication = await buildApplicationDetails(applicationId);
  } catch (detailError) {
    console.error('Application detail build error:', detailError);
    return res.status(500).json({ error: detailError.message || 'Application saved but failed to load the normalized response.' });
  }

  res.status(200).json({
    message: 'Application submitted successfully.',
    application: detailedApplication.application,
    student: detailedApplication.student,
    form_submission: detailedApplication.form_submission,
    personal_details: detailedApplication.personal_details,
    family_members: detailedApplication.family_members,
    education_records: detailedApplication.education_records,
    documents: detailedApplication.documents,
  });
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

// 6. Get Chat History Route
app.get('/api/messages/:room', async (req, res) => {
  const { room } = req.params;
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room', room)
    .order('created_at', { ascending: false }) // Fetches newest first to match Flutter's reverse ListView
    .limit(50);

  if (error) {
    console.error('Error fetching messages from Supabase:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
  
  res.status(200).json(data);
});

// --- SOCKET.IO REAL-TIME CHAT LOGIC ---
io.on('connection', (socket) => {
  console.log(`User connected via Socket.io: ${socket.id}`);

  // Allow a user to join a specific room (e.g., their student_id to chat with admin)
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  // Listen for messages from the client
  socket.on('send_message', async (data) => {
    console.log('Message received on backend:', data);
    
    // Broadcast the message to everyone else in that specific room
    socket.to(data.room).emit('receive_message', data);
    
    // Save the message into Supabase
    const { error } = await supabase.from('messages').insert([{
      room: data.room,
      sender_id: data.sender_id, // Needs to be sent by the client (e.g., student ID)
      text: data.text
    }]);
    if (error) console.error('Error saving message to Supabase:', error);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
