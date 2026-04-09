require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const multer = require('multer');
const {
  buildAuthToken,
  protect,
  authenticateSocket,
} = require('./middleware/authMiddleware');
const notificationService = require('./services/notificationService');
const messageService = require('./services/messageService');

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

notificationService.configureNotificationService({ io, supabase });
messageService.configureMessageService({ io, supabase });
io.use(authenticateSocket);

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
    userId: user.user_id,
    email: user.email,
    student_id: user.username,
    avatar_url: user.profile_image_url ?? null,
    role: user.role ?? null,
    is_verified: !!user.is_otp_verified,
  };
}

function buildAuthResponse(user) {
  return {
    message: 'Login successful',
    token: buildAuthToken(user),
    user: buildAuthUser(user),
  };
}

function getRequestUserId(req) {
  return req.user?.user_id || req.user?.userId || null;
}

const APPLICATION_DOCUMENT_DEFINITIONS = [
  {
    id: 'survey_form',
    name: 'Survey Form',
    aliases: ['survey form'],
  },
  {
    id: 'letter_of_request',
    name: 'Letter of Request',
    aliases: ['letter of request', 'request letter'],
  },
  {
    id: 'certificate_of_indigency',
    name: 'Certificate of Indigency',
    aliases: ['certificate of indigency', 'indigency'],
  },
  {
    id: 'certificate_of_good_moral_character',
    name: 'Certificate of Good Moral Character',
    aliases: ['certificate of good moral character', 'good moral'],
  },
  {
    id: 'senior_high_school_card',
    name: 'Senior High School Card',
    aliases: ['senior high school card', 'shs card'],
  },
  {
    id: 'student_grade_forms',
    name: 'Student Grade Forms',
    aliases: ['student grade forms', 'grade forms', 'grades'],
  },
  {
    id: 'certificate_of_registration',
    name: 'Certificate of Registration',
    aliases: ['certificate of registration', 'cor', 'registration'],
  },
  {
    id: 'id_picture',
    name: 'ID Picture',
    aliases: ['id picture', '1x1', 'picture'],
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
  const candidates = [document.document_type, document.file_name]
    .filter(Boolean)
    .map((value) => normalizeLookupValue(value));

  for (const definition of APPLICATION_DOCUMENT_DEFINITIONS) {
    if (
      candidates.some((candidate) =>
        definition.aliases.some((alias) => candidate.includes(alias))
      )
    ) {
      return definition.id;
    }
  }

  return normalizeLookupValue(
    document.document_type || document.file_name || 'document'
  ).replace(/\s+/g, '_');
}

function deriveDocumentReviewStatus(document = {}, review = null) {
  const preferredStatus = normalizeLookupValue(review?.review_status);

  if (preferredStatus === 'verified') return 'verified';
  if (preferredStatus === 'rejected' || preferredStatus === 're upload') {
    return 'rejected';
  }
  if (preferredStatus === 'flagged') return 'flagged';
  if (document.is_submitted && document.file_url) return 'uploaded';
  return 'pending';
}

function deriveApplicationDocumentStatus(documents = []) {
  const uploadedCount = documents.filter(
    (document) => document.is_submitted || !!document.file_url
  ).length;
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

  if (needsReview || uploadedCount < documents.length) {
    return 'Under Review';
  }

  if (verifiedCount > 0 && verifiedCount === documents.length) {
    return 'Documents Ready';
  }

  return 'Under Review';
}

function ensureDocumentCoverage(normalizedDocuments = []) {
  const documentMap = new Map(
    normalizedDocuments.map((document) => [document.id, document])
  );

  return APPLICATION_DOCUMENT_DEFINITIONS.map((definition) =>
    documentMap.get(definition.id) || {
      id: definition.id,
      document_key: definition.id,
      document_type: definition.name,
      name: definition.name,
      file_name: null,
      url: null,
      file_url: null,
      status: 'pending',
      is_submitted: false,
      admin_comment: '',
      remarks: null,
      uploaded_at: null,
      reviewed_at: null,
    }
  );
}

function resolveApplicationDocumentDefinition(documentKey = '') {
  const normalizedKey = normalizeLookupValue(documentKey);

  return APPLICATION_DOCUMENT_DEFINITIONS.find((definition) => {
    if (definition.id === normalizedKey.replace(/\s+/g, '_')) {
      return true;
    }

    return definition.aliases.some((alias) => alias === normalizedKey);
  }) || null;
}

async function listApplicationDocuments({ applicationId, studentId }) {
  const { data, error } = await supabase
    .from('application_documents')
    .select('*')
    .eq('student_id', studentId)
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

async function ensureApplicationDocumentPlaceholders(applicationId, studentId) {
  const existingDocuments = await listApplicationDocuments({ applicationId, studentId });
  const existingTypes = new Set(
    existingDocuments
      .map((document) => document.document_type)
      .filter(Boolean)
  );

  const missingDocuments = APPLICATION_DOCUMENT_DEFINITIONS
    .filter((documentDefinition) => !existingTypes.has(documentDefinition.name))
    .map((documentDefinition) => ({
      application_id: applicationId,
      student_id: studentId,
      document_type: documentDefinition.name,
      is_submitted: false,
      file_url: null,
      submitted_at: null,
      remarks: null,
    }));

  if (missingDocuments.length === 0) {
    return existingDocuments;
  }

  const { error } = await supabase
    .from('application_documents')
    .insert(missingDocuments);

  if (error) {
    throw error;
  }

  return listApplicationDocuments({ applicationId, studentId });
}

async function refreshApplicationDocumentStatus(applicationId, studentId) {
  const savedDocuments = await listApplicationDocuments({ applicationId, studentId });
  const nextDocumentStatus = deriveApplicationDocumentStatus(savedDocuments || []);
  const { error: applicationStatusError } = await supabase
    .from('applications')
    .update({ document_status: nextDocumentStatus })
    .eq('application_id', applicationId);

  if (applicationStatusError) {
    throw applicationStatusError;
  }

  return nextDocumentStatus;
}

async function resolveStudentByUserId(userId) {
  const { data: studentRecord, error } = await supabase
    .from('students')
    .select('student_id, user_id, pdm_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return studentRecord || null;
}

const SUPPORT_TICKET_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

function isSupportAdmin(req) {
  return !!(
    req.user?.adminId ||
    req.user?.admin_id ||
    ['admin', 'sdo'].includes((req.user?.role || '').toString().toLowerCase())
  );
}

function mapSupportTicketRow(row = {}) {
  const studentProfile = row.students || {};
  const handlerProfile = row.admin_profiles || {};
  const studentFirstName = studentProfile.first_name || '';
  const studentLastName = studentProfile.last_name || '';
  const handlerFirstName = handlerProfile.first_name || '';
  const handlerLastName = handlerProfile.last_name || '';

  return {
    ticket_id: row.ticket_id,
    student_id: row.student_id,
    issue_category: row.issue_category || '',
    description: row.description || '',
    status: row.status || 'Open',
    handled_by: row.handled_by || null,
    created_at: row.created_at || null,
    resolved_at: row.resolved_at || null,
    student_number: studentProfile.pdm_id || null,
    student_name: [studentFirstName, studentLastName].filter(Boolean).join(' ').trim() || null,
    handler_name: [handlerFirstName, handlerLastName].filter(Boolean).join(' ').trim() || null,
  };
}

async function listSupportTicketsForStudent(studentId) {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(`
      ticket_id,
      student_id,
      issue_category,
      description,
      status,
      handled_by,
      created_at,
      resolved_at
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapSupportTicketRow);
}

async function listSupportTicketsForAdmin() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(`
      ticket_id,
      student_id,
      issue_category,
      description,
      status,
      handled_by,
      created_at,
      resolved_at,
      students!support_tickets_student_id_fkey (
        student_id,
        first_name,
        last_name,
        pdm_id
      ),
      admin_profiles!support_tickets_handled_by_fkey (
        admin_id,
        first_name,
        last_name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapSupportTicketRow);
}

async function resolveLatestBaseApplicationForUser(userId) {
  const studentRecord = await resolveStudentByUserId(userId);
  if (!studentRecord) {
    return null;
  }

  const { data: applicationRecords, error } = await supabase
    .from('applications')
    .select('application_id, student_id, program_id, application_status, document_status, submission_date, is_disqualified')
    .eq('student_id', studentRecord.student_id)
    .eq('is_disqualified', false)
    .order('submission_date', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const applicationRecord = Array.isArray(applicationRecords) && applicationRecords.length > 0
    ? applicationRecords[0]
    : null;

  if (!applicationRecord) {
    return null;
  }

  return {
    student: studentRecord,
    application: applicationRecord,
  };
}

async function buildApplicantDocumentPackage({
  applicationId,
  context = {},
}) {
  const details = await buildApplicationDetails(applicationId);

  return {
    application: details.application,
    context: {
      opening_id: context.opening_id ?? '',
      opening_title: context.opening_title ?? 'Scholarship Requirements',
      program_name:
        context.program_name ||
        details.student?.program_name ||
        'Unassigned Application',
    },
    documents: details.documents ?? [],
  };
}

async function uploadApplicationDocumentFile({
  applicationId,
  studentId,
  documentKey,
  file,
}) {
  const definition = resolveApplicationDocumentDefinition(documentKey);
  if (!definition) {
    const error = new Error('Invalid document type.');
    error.statusCode = 400;
    throw error;
  }

  if (!file) {
    const error = new Error('A document file is required.');
    error.statusCode = 400;
    throw error;
  }

  await ensureApplicationDocumentPlaceholders(applicationId, studentId);

  const sanitizedFileName = (file.originalname || 'document')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
  const fileScope = applicationId || studentId;
  const fileName = `${fileScope}/${definition.id}/${Date.now()}-${sanitizedFileName}`;

  const { error: storageError } = await supabase.storage
    .from('application-documents')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (storageError) {
    throw storageError;
  }

  const { data: publicUrlData } = supabase.storage
    .from('application-documents')
    .getPublicUrl(fileName);
  const fileUrl = publicUrlData?.publicUrl || null;

  const { error: documentUpdateError } = await supabase
    .from('application_documents')
    .update({
      is_submitted: true,
      file_url: fileUrl,
      submitted_at: new Date().toISOString(),
      remarks: null,
    })
    .eq('student_id', studentId)
    .eq('application_id', applicationId)
    .eq('document_type', definition.name);

  if (documentUpdateError) {
    throw documentUpdateError;
  }

  await refreshApplicationDocumentStatus(applicationId, studentId);

  return buildApplicantDocumentPackage({ applicationId });
}

function parseResidentYears(value) {
  if (value === null || value === undefined) return null;
  const match = value.toString().match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeNullableText(value) {
  if (value === null || value === undefined) return null;
  const trimmed = value.toString().trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeEducationalAttainment(value) {
  const normalized = normalizeNullableText(value);
  if (!normalized) return null;

  const lookup = {
    none: 'None',
    elementary: 'Elementary',
    'high school': 'High School',
    'senior high school': 'Senior High School',
    vocational: 'Vocational',
    college: 'College',
    'post-graduate': 'Post-Graduate',
    postgraduate: 'Post-Graduate',
  };

  return lookup[normalizeLookupValue(normalized)] ?? null;
}

function buildFamilyResidencyByRelation(parentNativeStatus, yearsValue, originProvince) {
  const years = parseResidentYears(yearsValue);
  const origin = originProvince ?? null;
  const template = {
    Father: {
      is_marilao_native: null,
      years_as_resident: null,
      origin_province: null,
    },
    Mother: {
      is_marilao_native: null,
      years_as_resident: null,
      origin_province: null,
    },
    Sibling: {
      is_marilao_native: null,
      years_as_resident: null,
      origin_province: null,
    },
    Guardian: {
      is_marilao_native: null,
      years_as_resident: null,
      origin_province: null,
    },
  };

  switch (parentNativeStatus) {
    case 'Yes, father only':
      template.Father = {
        is_marilao_native: true,
        years_as_resident: years,
        origin_province: null,
      };
      break;
    case 'Yes, mother only':
      template.Mother = {
        is_marilao_native: true,
        years_as_resident: years,
        origin_province: null,
      };
      break;
    case 'Yes, both parents':
      template.Father = {
        is_marilao_native: true,
        years_as_resident: years,
        origin_province: null,
      };
      template.Mother = {
        is_marilao_native: true,
        years_as_resident: years,
        origin_province: null,
      };
      break;
    case 'No':
      template.Father = {
        is_marilao_native: false,
        years_as_resident: null,
        origin_province: origin,
      };
      template.Mother = {
        is_marilao_native: false,
        years_as_resident: null,
        origin_province: origin,
      };
      break;
    default:
      break;
  }

  return template;
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
      scholarship_program (
        program_id,
        program_name
      )
    `)
    .eq('application_id', applicationId)
    .single();

  if (applicationError) {
    throw applicationError;
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

  const [
    studentProfileResult,
    familyMembersResult,
    educationRecordsResult,
    documentsResult,
    reviewsResult,
  ] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('*')
      .eq('student_id', applicationRecord.student_id)
      .maybeSingle(),
    supabase
      .from('student_family')
      .select('*')
      .eq('student_id', applicationRecord.student_id)
      .order('relation', { ascending: true }),
    supabase
      .from('student_education')
      .select('*')
      .eq('student_id', applicationRecord.student_id)
      .order('education_level', { ascending: true }),
    supabase
      .from('application_documents')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true }),
    supabase
      .from('application_document_reviews')
      .select('*')
      .eq('application_id', applicationId),
  ]);

  const resultErrors = [
    studentProfileResult.error,
    familyMembersResult.error,
    educationRecordsResult.error,
    documentsResult.error,
    reviewsResult.error,
  ].filter(Boolean);

  if (resultErrors.length > 0) {
    throw resultErrors[0];
  }

  const reviewByKey = new Map(
    (reviewsResult.data || []).map((review) => [review.document_key, review])
  );

  const normalizedDocuments = (documentsResult.data || []).map((document) => {
    const documentKey = inferDocumentKey(document);
    const review = reviewByKey.get(documentKey) || null;

    return {
      id: documentKey,
      document_key: documentKey,
      name: document.document_type || 'Document',
      document_type: document.document_type || null,
      file_name: document.document_type || null,
      url: review?.file_url || document.file_url || null,
      file_url: review?.file_url || document.file_url || null,
      status: deriveDocumentReviewStatus(document, review),
      is_submitted: !!document.is_submitted,
      admin_comment: review?.admin_comment || document.remarks || '',
      remarks: document.remarks || null,
      uploaded_at: document.submitted_at || null,
      reviewed_at: review?.reviewed_at || null,
    };
  });

  const documents = ensureDocumentCoverage(normalizedDocuments);

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
      program_name: applicationRecord.scholarship_program?.program_name ?? null,
      barangay: student.barangay ?? null,
    },
    student_profile: studentProfileResult.data ?? null,
    family_members: familyMembersResult.data ?? [],
    education_records: educationRecordsResult.data ?? [],
    documents,
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

  if (!email || !password || !student_id) {
    return res.status(400).json({ error: 'Email, password, and Student ID are required' });
  }

  const studentIdRegex = /^PDM-\d{4}-\d{6}$/;
  if (!studentIdRegex.test(student_id)) {
    return res.status(400).json({ error: 'Student ID must be in the format PDM-YYYY-NNNNNN (e.g., PDM-2023-000001)' });
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

  const hashedPassword = await bcrypt.hash(password, 10);

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
  otpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  sendOTPEmail(email, otp)
    .then(() => console.log(`OTP sent to ${email}`))
    .catch(err => console.error('Error sending email:', err));

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

  otpStore.delete(email);

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
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    const { error: storageError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

    if (storageError) throw storageError;

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const avatarUrl = publicUrlData.publicUrl;

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

  res.status(200).json(buildAuthResponse(data));
});

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

app.get('/api/support-tickets/me', protect, async (req, res) => {
  try {
    const studentRecord = await resolveStudentByUserId(getRequestUserId(req));

    if (!studentRecord?.student_id) {
      return res.status(404).json({
        error: 'No student profile is linked to this account.',
      });
    }

    const items = await listSupportTicketsForStudent(studentRecord.student_id);
    res.status(200).json({ items });
  } catch (error) {
    console.error('SUPPORT TICKETS ME ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load your support tickets.',
    });
  }
});

app.post('/api/support-tickets', protect, async (req, res) => {
  try {
    const studentRecord = await resolveStudentByUserId(getRequestUserId(req));

    if (!studentRecord?.student_id) {
      return res.status(404).json({
        error: 'No student profile is linked to this account.',
      });
    }

    const issueCategory = (req.body?.issue_category || '').toString().trim();
    const description = (req.body?.description || '').toString().trim();

    if (!issueCategory) {
      return res.status(400).json({ error: 'issue_category is required.' });
    }

    if (issueCategory.length > 50) {
      return res.status(400).json({
        error: 'issue_category must be 50 characters or fewer.',
      });
    }

    if (!description) {
      return res.status(400).json({ error: 'description is required.' });
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        student_id: studentRecord.student_id,
        issue_category: issueCategory,
        description,
      })
      .select(`
        ticket_id,
        student_id,
        issue_category,
        description,
        status,
        handled_by,
        created_at,
        resolved_at
      `)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Support ticket created successfully.',
      data: mapSupportTicketRow(data),
    });
  } catch (error) {
    console.error('SUPPORT TICKET CREATE ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to create support ticket.',
    });
  }
});

app.get('/api/support-tickets', protect, async (req, res) => {
  try {
    if (!isSupportAdmin(req)) {
      return res.status(403).json({
        error: 'Only staff accounts can access support tickets.',
      });
    }

    const items = await listSupportTicketsForAdmin();
    res.status(200).json({ items });
  } catch (error) {
    console.error('SUPPORT TICKET LIST ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to load support tickets.',
    });
  }
});

app.patch('/api/support-tickets/:ticketId', protect, async (req, res) => {
  try {
    if (!isSupportAdmin(req)) {
      return res.status(403).json({
        error: 'Only staff accounts can update support tickets.',
      });
    }

    const nextStatusRaw = req.body?.status;
    const nextStatus = nextStatusRaw == null ? null : nextStatusRaw.toString().trim();
    const assignToSelf = req.body?.assignToSelf === true;
    const adminId = req.user?.adminId || req.user?.admin_id || null;

    if (!adminId && assignToSelf) {
      return res.status(400).json({
        error: 'Your account is missing an admin profile link.',
      });
    }

    if (!nextStatus && !assignToSelf) {
      return res.status(400).json({
        error: 'Provide a status or set assignToSelf to true.',
      });
    }

    if (nextStatus && !SUPPORT_TICKET_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        error: `status must be one of: ${SUPPORT_TICKET_STATUSES.join(', ')}.`,
      });
    }

    const updatePayload = {};

    if (nextStatus) {
      updatePayload.status = nextStatus;
      if (nextStatus === 'Resolved' || nextStatus === 'Closed') {
        updatePayload.resolved_at = new Date().toISOString();
      }
      if ((nextStatus === 'Open' || nextStatus === 'In Progress') && !assignToSelf) {
        updatePayload.resolved_at = null;
      }
      if (nextStatus !== 'Open' && adminId) {
        updatePayload.handled_by = adminId;
      }
    }

    if (assignToSelf) {
      updatePayload.handled_by = adminId;
      if (!nextStatus) {
        updatePayload.resolved_at = null;
      }
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .update(updatePayload)
      .eq('ticket_id', req.params.ticketId)
      .select(`
        ticket_id,
        student_id,
        issue_category,
        description,
        status,
        handled_by,
        created_at,
        resolved_at,
        students!support_tickets_student_id_fkey (
          student_id,
          first_name,
          last_name,
          pdm_id
        ),
        admin_profiles!support_tickets_handled_by_fkey (
          admin_id,
          first_name,
          last_name
        )
      `)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Support ticket not found.' });
    }

    res.status(200).json({
      message: 'Support ticket updated successfully.',
      data: mapSupportTicketRow(data),
    });
  } catch (error) {
    console.error('SUPPORT TICKET UPDATE ROUTE ERROR:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to update support ticket.',
    });
  }
});

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

app.get('/api/faqs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('faq_id, question, answer, display_order, is_active')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching FAQs:', error);
      return res.status(500).json({ error: 'Failed to fetch FAQs.' });
    }

    const items = (data ?? [])
      .filter((faq) => {
        const question = faq?.question?.toString().trim();
        const answer = faq?.answer?.toString().trim();

        return !!question && !!answer;
      })
      .map((faq) => ({
        id: faq.faq_id,
        question: faq.question.trim(),
        answer: faq.answer.trim(),
        displayOrder: faq.display_order,
      }));

    res.status(200).json(items);
  } catch (error) {
    console.error('FAQ ROUTE ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch FAQs.' });
  }
});

app.get('/api/scholarship-programs', async (req, res) => {
  const { data, error } = await supabase
    .from('scholarship_program')
    .select('program_id, program_name')
    .order('program_name', { ascending: true });

  if (error) {
    console.error('Error fetching scholarship programs:', error);
    return res.status(500).json({ error: 'Failed to fetch scholarship programs' });
  }

  res.status(200).json(data ?? []);
});

app.get('/api/applications/me/documents', protect, async (req, res) => {
  try {
    const activeApplication = await resolveLatestBaseApplicationForUser(req.user.user_id);

    if (!activeApplication?.application?.application_id) {
      return res.status(404).json({
        error: 'Complete and submit your application form first before uploading scholarship requirements.',
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

app.post('/api/applications/me/documents/:documentKey/upload', protect, upload.single('document'), async (req, res) => {
  try {
    const activeApplication = await resolveLatestBaseApplicationForUser(req.user.user_id);

    if (!activeApplication?.application?.application_id) {
      return res.status(404).json({
        error: 'Complete and submit your application form first before uploading scholarship requirements.',
      });
    }

    const payload = await uploadApplicationDocumentFile({
      applicationId: activeApplication.application.application_id,
      studentId: activeApplication.student.student_id,
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

  if (
    academic.student_number &&
    academic.student_number.trim() &&
    academic.student_number.trim() !== account.student_id
  ) {
    return res.status(400).json({ error: 'Student number must match the logged-in student ID.' });
  }

  if (application.program_id) {
    const { data: programData, error: programError } = await supabase
      .from('scholarship_program')
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

  let savedApplication = null;
  let applicationId = null;
  if (application.program_id) {
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

    applicationId = savedApplication.application_id;
  } else {
    const { data: existingBaseApplication, error: existingBaseApplicationError } = await supabase
      .from('applications')
      .select('application_id, application_status, submission_date, document_status')
      .eq('student_id', studentRecord.student_id)
      .is('program_id', null)
      .in('application_status', ['Pending Review', 'Interview'])
      .eq('is_disqualified', false)
      .maybeSingle();

    if (existingBaseApplicationError) {
      console.error('Existing base application lookup error:', existingBaseApplicationError);
      return res.status(500).json({ error: 'Failed to load saved base application.' });
    }

    if (existingBaseApplication) {
      const { data: updatedBaseApplication, error: updateBaseError } = await supabase
        .from('applications')
        .update({
          student_id: studentRecord.student_id,
          submission_date: new Date().toISOString(),
        })
        .eq('application_id', existingBaseApplication.application_id)
        .select('application_id, application_status, submission_date, document_status')
        .single();

      if (updateBaseError) {
        console.error('Base application update error:', updateBaseError);
        return res.status(500).json({ error: updateBaseError.message || 'Failed to update your base application.' });
      }

      savedApplication = updatedBaseApplication;
    } else {
      const { data: insertedBaseApplication, error: insertBaseError } = await supabase
        .from('applications')
        .insert([{
          student_id: studentRecord.student_id,
          program_id: null,
          application_status: 'Pending Review',
          submission_date: new Date().toISOString(),
          document_status: 'Missing Docs',
        }])
        .select('application_id, application_status, submission_date, document_status')
        .single();

      if (insertBaseError) {
        console.error('Base application insert error:', insertBaseError);
        return res.status(500).json({ error: insertBaseError.message || 'Failed to submit your base application.' });
      }

      savedApplication = insertedBaseApplication;
    }

    applicationId = savedApplication.application_id;
  }

  const buildStreetAddress = [
    address.unit_bldg_no ?? address.block,
    address.house_lot_block_no ?? address.lot,
    address.street,
  ]
    .filter((value) => !!value && value.toString().trim().length > 0)
    .join(', ');

  const studentProfilePayload = {
    student_id: studentRecord.student_id,
    date_of_birth: personal.date_of_birth ?? null,
    place_of_birth: personal.place_of_birth ?? null,
    sex: personal.sex ?? null,
    civil_status: personal.civil_status ?? null,
    maiden_name: personal.maiden_name ?? null,
    religion: personal.religion ?? null,
    citizenship: personal.citizenship ?? 'Filipino',
    street_address: buildStreetAddress || null,
    subdivision: address.subdivision ?? null,
    city: address.city_municipality ?? null,
    province: address.province ?? null,
    zip_code: address.zip_code ?? null,
    landline_number: contact.landline ?? null,
    learners_reference_number: academic.lrn ?? null,
    financial_support_type: support.financial_support ?? null,
    financial_support_other:
      support.financial_support === 'Other'
        ? support.scholarship_others_specify ?? null
        : null,
    has_prior_scholarship: support.scholarship_history ?? false,
    prior_scholarship_details: support.scholarship_details ?? null,
    has_disciplinary_record: discipline.disciplinary_action ?? false,
    disciplinary_details: discipline.disciplinary_explanation ?? null,
    self_description: essays.describe_yourself_essay ?? null,
    aims_and_ambitions: essays.aims_and_ambition_essay ?? null,
    applicant_signature_url: null,
    guardian_signature_url: null,
  };

  const { error: profileError } = await supabase
    .from('student_profiles')
    .upsert([studentProfilePayload], { onConflict: 'student_id' });

  if (profileError) {
    console.error('Student profile upsert error:', profileError);
    return res.status(500).json({ error: profileError.message || 'Failed to save student profile.' });
  }

  const familyResidencyMap = buildFamilyResidencyByRelation(
    family.parent_native_status,
    family.parent_marilao_residency_duration,
    family.parent_previous_town_province
  );

  const familyRows = [
    {
      relation: 'Father',
      last_name: normalizeNullableText(family.father?.last_name),
      first_name: normalizeNullableText(family.father?.first_name),
      middle_name: normalizeNullableText(family.father?.middle_name),
      mobile_number: normalizeNullableText(family.father?.mobile),
      address: normalizeNullableText(family.parent_guardian_address),
      highest_educational_attainment: normalizeEducationalAttainment(
        family.father?.educational_attainment
      ),
      occupation: normalizeNullableText(family.father?.occupation),
      company_name_address: normalizeNullableText(
        family.father?.company_name_and_address
      ),
      ...familyResidencyMap.Father,
    },
    {
      relation: 'Mother',
      last_name: normalizeNullableText(family.mother?.last_name),
      first_name: normalizeNullableText(family.mother?.first_name),
      middle_name: normalizeNullableText(family.mother?.middle_name),
      mobile_number: normalizeNullableText(family.mother?.mobile),
      address: normalizeNullableText(family.parent_guardian_address),
      highest_educational_attainment: normalizeEducationalAttainment(
        family.mother?.educational_attainment
      ),
      occupation: normalizeNullableText(family.mother?.occupation),
      company_name_address: normalizeNullableText(
        family.mother?.company_name_and_address
      ),
      ...familyResidencyMap.Mother,
    },
    {
      relation: 'Sibling',
      last_name: normalizeNullableText(family.sibling?.last_name),
      first_name: normalizeNullableText(family.sibling?.first_name),
      middle_name: normalizeNullableText(family.sibling?.middle_name),
      mobile_number: normalizeNullableText(family.sibling?.mobile),
      address: null,
      highest_educational_attainment: null,
      occupation: null,
      company_name_address: null,
      ...familyResidencyMap.Sibling,
    },
    {
      relation: 'Guardian',
      last_name: normalizeNullableText(family.guardian?.last_name),
      first_name: normalizeNullableText(family.guardian?.first_name),
      middle_name: normalizeNullableText(family.guardian?.middle_name),
      mobile_number: normalizeNullableText(family.guardian?.mobile),
      address: normalizeNullableText(family.parent_guardian_address),
      highest_educational_attainment: normalizeEducationalAttainment(
        family.guardian?.educational_attainment
      ),
      occupation: normalizeNullableText(family.guardian?.occupation),
      company_name_address: normalizeNullableText(
        family.guardian?.company_name_and_address
      ),
      ...familyResidencyMap.Guardian,
    },
  ];

  for (const row of familyRows) {
    const { data: existingFamilyRows, error: familyFetchError } = await supabase
      .from('student_family')
      .select('family_id')
      .eq('student_id', studentRecord.student_id)
      .eq('relation', row.relation);

    if (familyFetchError) {
      console.error('Student family fetch error:', familyFetchError);
      return res.status(500).json({ error: familyFetchError.message || 'Failed to load student family records.' });
    }

    if ((existingFamilyRows || []).length > 0) {
      const { error: familyUpdateError } = await supabase
        .from('student_family')
        .update({
          last_name: row.last_name,
          first_name: row.first_name,
          middle_name: row.middle_name,
          mobile_number: row.mobile_number,
          address: row.address,
          highest_educational_attainment: row.highest_educational_attainment,
          occupation: row.occupation,
          company_name_address: row.company_name_address,
          is_marilao_native: row.is_marilao_native,
          years_as_resident: row.years_as_resident,
          origin_province: row.origin_province,
        })
        .eq('student_id', studentRecord.student_id)
        .eq('relation', row.relation);

      if (familyUpdateError) {
        console.error('Student family update error:', familyUpdateError);
        return res.status(500).json({ error: familyUpdateError.message || 'Failed to update student family records.' });
      }
    } else {
      const { error: familyInsertError } = await supabase
        .from('student_family')
        .insert([{
          student_id: studentRecord.student_id,
          relation: row.relation,
          last_name: row.last_name,
          first_name: row.first_name,
          middle_name: row.middle_name,
          mobile_number: row.mobile_number,
          address: row.address,
          highest_educational_attainment: row.highest_educational_attainment,
          occupation: row.occupation,
          company_name_address: row.company_name_address,
          is_marilao_native: row.is_marilao_native,
          years_as_resident: row.years_as_resident,
          origin_province: row.origin_province,
        }]);

      if (familyInsertError) {
        console.error('Student family insert error:', familyInsertError);
        return res.status(500).json({ error: familyInsertError.message || 'Failed to create student family records.' });
      }
    }
  }

  const educationRows = [
    {
      education_level: 'Elementary',
      school_name: academic.elementary_school ?? null,
      school_address: academic.elementary_address ?? null,
      honors_awards: academic.elementary_honors ?? null,
      club_organization: academic.elementary_club ?? null,
      year_graduated: academic.elementary_year_graduated ?? null,
    },
    {
      education_level: 'High School',
      school_name: academic.high_school_school ?? null,
      school_address: academic.high_school_address ?? null,
      honors_awards: academic.high_school_honors ?? null,
      club_organization: academic.high_school_club ?? null,
      year_graduated: academic.high_school_year_graduated ?? null,
    },
    {
      education_level: 'Senior High School',
      school_name: academic.senior_high_school ?? null,
      school_address: academic.senior_high_address ?? null,
      honors_awards: academic.senior_high_honors ?? null,
      club_organization: academic.senior_high_club ?? null,
      year_graduated: academic.senior_high_year_graduated ?? null,
    },
    {
      education_level: 'College',
      school_name: academic.college_school ?? null,
      school_address: academic.college_address ?? null,
      honors_awards: academic.college_honors ?? null,
      club_organization: academic.college_club ?? null,
      year_graduated: academic.college_year_graduated ?? null,
    },
  ].map((row) => ({
    student_id: studentRecord.student_id,
    ...row,
  }));

  const { error: educationError } = await supabase
    .from('student_education')
    .upsert(educationRows, { onConflict: 'student_id,education_level' });

  if (educationError) {
    console.error('Student education upsert error:', educationError);
    return res.status(500).json({ error: educationError.message || 'Failed to save student education records.' });
  }

  if (applicationId) {
    try {
      await ensureApplicationDocumentPlaceholders(applicationId, studentRecord.student_id);
    } catch (placeholderDocumentError) {
      console.error('Application document placeholder upsert error:', placeholderDocumentError);
      return res.status(500).json({ error: placeholderDocumentError.message || 'Failed to prepare application documents.' });
    }

    const submittedDocuments = Array.isArray(documents.records) ? documents.records : [];
    if (submittedDocuments.length > 0) {
      for (const document of submittedDocuments) {
        const targetDocumentType = document.document_type || document.name || null;
        if (!targetDocumentType) continue;

        const { error: documentUpdateError } = await supabase
          .from('application_documents')
          .update({
            is_submitted: !!document.file_url,
            file_url: document.file_url ?? null,
            submitted_at: document.file_url ? (document.uploaded_at ?? new Date().toISOString()) : null,
            remarks: document.notes ?? null,
          })
          .eq('application_id', applicationId)
          .eq('document_type', targetDocumentType);

        if (documentUpdateError) {
          console.error('Application document update error:', documentUpdateError);
          return res.status(500).json({ error: documentUpdateError.message || 'Failed to save uploaded documents.' });
        }
      }

      try {
        await refreshApplicationDocumentStatus(applicationId, studentRecord.student_id);
      } catch (applicationStatusError) {
        console.error('Application document status update error:', applicationStatusError);
        return res.status(500).json({ error: applicationStatusError.message || 'Failed to update application document status.' });
      }
    }
  }

  let detailedApplication = null;
  if (applicationId) {
    try {
      detailedApplication = await buildApplicationDetails(applicationId);
    } catch (detailError) {
      console.error('Application detail build error:', detailError);
      return res.status(500).json({ error: detailError.message || 'Application saved but failed to load the response.' });
    }
  }

  res.status(200).json({
    message: applicationId
      ? 'Application submitted successfully. You can now upload your scholarship requirements.'
      : 'Profile details saved successfully. Scholarship program selection is temporarily unavailable.',
    application: detailedApplication?.application ?? null,
    student: detailedApplication?.student ?? {
      id: studentRecord.student_id,
      pdm_id: account.student_id,
      email: contact.email,
      phone: contact.mobile_number ?? null,
    },
    student_profile: detailedApplication?.student_profile ?? studentProfilePayload,
    family_members: detailedApplication?.family_members ?? familyRows,
    education_records: detailedApplication?.education_records ?? educationRows,
    documents: detailedApplication?.documents ?? [],
    certification: {
      certification_read: certification.certification_read ?? false,
      agree: certification.agree ?? false,
    },
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

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
