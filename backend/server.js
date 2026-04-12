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

// Temporary in-memory store for OTPs and pending registrations
const otpStore = new Map();
const pendingRegistrationStore = new Map();

const APPLICATION_DRAFT_TABLE = 'application_form_drafts';
const ACTIVE_APPLICATION_STATUSES = new Set([
  'pending',
  'pending review',
  'submitted',
  'review',
  'under review',
  'for review',
  'interview',
  'qualified',
  'approved',
  'accepted',
  'waiting',
  'waitlisted',
  'requires reupload',
]);

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

function extractAvatarStoragePath(value) {
  const rawValue = (value ?? '').toString().trim();
  if (!rawValue) return null;

  if (!rawValue.startsWith('http')) {
    return rawValue.replace(/^avatars\//, '');
  }

  const markers = [
    '/storage/v1/object/public/avatars/',
    '/storage/v1/object/sign/avatars/',
    '/storage/v1/object/authenticated/avatars/',
  ];

  for (const marker of markers) {
    const markerIndex = rawValue.indexOf(marker);
    if (markerIndex >= 0) {
      const extracted = rawValue.slice(markerIndex + marker.length);
      return extracted.split('?')[0];
    }
  }

  return null;
}

async function resolveAvatarUrl(value) {
  const rawValue = (value ?? '').toString().trim();
  if (!rawValue) return null;

  const storagePath = extractAvatarStoragePath(rawValue);
  if (!storagePath) {
    return rawValue;
  }

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (error) {
    console.warn('Avatar signed URL generation failed:', error.message);
    return rawValue;
  }

  return data?.signedUrl ?? rawValue;
}

async function buildAuthUser(user, studentProfile = null) {
  return {
    id: user.user_id,
    user_id: user.user_id,
    userId: user.user_id,
    email: user.email,
    student_id: user.username,
    first_name: studentProfile?.first_name ?? null,
    last_name: studentProfile?.last_name ?? null,
    avatar_url: await resolveAvatarUrl(studentProfile?.profile_photo_url ?? null),
    role: user.role ?? null,
    is_verified: !!user.is_otp_verified,
  };
}

async function buildAuthResponse(user) {
  const studentProfile = user?.user_id
    ? await resolveStudentByUserId(user.user_id)
    : null;

  return {
    message: 'Login successful',
    token: buildAuthToken(user),
    user: await buildAuthUser(user, studentProfile),
  };
}

function getRequestUserId(req) {
  return req.user?.user_id || req.user?.userId || null;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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

function isTesProgramName(programName = '') {
  const normalized = normalizeLookupValue(programName);
  return normalized === 'tes' || normalized.includes('tertiary education subsidy');
}

function isActiveApplicationRecord(application = {}) {
  if (application.is_disqualified === true) {
    return false;
  }

  return ACTIVE_APPLICATION_STATUSES.has(
    normalizeLookupValue(application.application_status)
  );
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

async function listApplicationDocuments({ applicationId, uploadedBy }) {
  const { data, error } = await supabase
    .from('application_documents')
    .select('*')
    .eq('uploaded_by', uploadedBy)
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

async function ensureApplicationDocumentPlaceholders(applicationId, uploadedBy) {
  const existingDocuments = await listApplicationDocuments({
    applicationId,
    uploadedBy,
  });
  const existingTypes = new Set(
    existingDocuments
      .map((document) => document.document_type)
      .filter(Boolean)
  );

  const missingDocuments = APPLICATION_DOCUMENT_DEFINITIONS
    .filter((documentDefinition) => !existingTypes.has(documentDefinition.name))
    .map((documentDefinition) => ({
      application_id: applicationId,
      uploaded_by: uploadedBy,
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

  return listApplicationDocuments({ applicationId, uploadedBy });
}

async function refreshApplicationDocumentStatus(applicationId, uploadedBy) {
  const savedDocuments = await listApplicationDocuments({
    applicationId,
    uploadedBy,
  });
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
    .select('student_id, user_id, pdm_id, first_name, last_name, course_id, profile_photo_url')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return studentRecord || null;
}

async function loadStudentProfileContextByUserId(userId) {
  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('user_id, username, email, phone_number, role, is_otp_verified')
    .eq('user_id', userId)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  if (!userRecord) {
    return null;
  }

  const studentRecord = await resolveStudentByUserId(userId);
  let profileRecord = null;
  let courseRecord = null;

  if (studentRecord?.student_id) {
    const [
      studentProfileResult,
      courseLookupResult,
    ] = await Promise.all([
      supabase
        .from('student_profiles')
        .select(`
          student_id,
          date_of_birth,
          place_of_birth,
          sex,
          civil_status,
          maiden_name,
          religion,
          citizenship,
          street_address,
          subdivision,
          city,
          province,
          zip_code,
          landline_number,
          learners_reference_number
        `)
        .eq('student_id', studentRecord.student_id)
        .maybeSingle(),
      studentRecord.course_id
        ? supabase
          .from('academic_course')
          .select('course_id, course_code')
          .eq('course_id', studentRecord.course_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (studentProfileResult.error) {
      throw studentProfileResult.error;
    }

    if (courseLookupResult.error) {
      throw courseLookupResult.error;
    }

    profileRecord = studentProfileResult.data || null;
    courseRecord = courseLookupResult.data || null;
  }

  return {
    user: userRecord,
    student: studentRecord,
    student_profile: profileRecord,
    course: courseRecord,
  };
}

async function buildMyProfileResponse(context = {}) {
  const user = context.user || {};
  const student = context.student || {};
  const profile = context.student_profile || {};
  const course = context.course || {};
  const avatarUrl = await resolveAvatarUrl(student.profile_photo_url ?? null);

  return {
    profile: {
      user_id: user.user_id ?? null,
      student_id: student.pdm_id || user.username || null,
      first_name: student.first_name ?? null,
      last_name: student.last_name ?? null,
      email: user.email ?? null,
      phone_number: user.phone_number ?? null,
      avatar_url: avatarUrl,
      course_code: course.course_code ?? null,
      date_of_birth: profile.date_of_birth ?? null,
      place_of_birth: profile.place_of_birth ?? null,
      sex: profile.sex ?? null,
      civil_status: profile.civil_status ?? null,
      maiden_name: profile.maiden_name ?? null,
      religion: profile.religion ?? null,
      citizenship: profile.citizenship ?? null,
      street_address: profile.street_address ?? null,
      subdivision: profile.subdivision ?? null,
      city: profile.city ?? null,
      province: profile.province ?? null,
      zip_code: profile.zip_code ?? null,
      landline_number: profile.landline_number ?? null,
      learners_reference_number: profile.learners_reference_number ?? null,
    },
  };
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

async function resolveScholarRecordForStudent(studentId) {
  if (!studentId) {
    return null;
  }

  const { data, error } = await supabase
    .from('scholars')
    .select('scholar_id, student_id, application_id, program_id, status')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function resolveOpeningById(openingId) {
  if (!openingId) {
    return null;
  }

  const { data, error } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
      opening_title,
      announcement_text,
      posting_status,
      created_at,
      updated_at,
      scholarship_program (
        program_id,
        program_name
      )
    `)
    .eq('opening_id', openingId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function resolveApplicantDraftByUserId(userId) {
  try {
    const { data, error } = await supabase
      .from(APPLICATION_DRAFT_TABLE)
      .select('draft_id, user_id, opening_id, payload, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      const message = String(error.message || '').toLowerCase();
      const hint = String(error.hint || '').toLowerCase();

      if (
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        message.includes('application_form_drafts') ||
        message.includes('could not find the table') ||
        message.includes('relation') ||
        message.includes('does not exist') ||
        hint.includes('application_documents')
      ) {
        console.warn('Draft table missing, skipping applicant draft lookup.');
        return null;
      }

      throw error;
    }

    return data || null;
  } catch (error) {
    const message = String(error.message || '').toLowerCase();
    const hint = String(error.hint || '').toLowerCase();

    if (
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      message.includes('application_form_drafts') ||
      message.includes('could not find the table') ||
      message.includes('relation') ||
      message.includes('does not exist') ||
      hint.includes('application_documents')
    ) {
      console.warn('Draft table missing, skipping applicant draft lookup.');
      return null;
    }

    throw error;
  }
}

async function upsertApplicantDraftByUserId(userId, { openingId, payload }) {
  const { data, error } = await supabase
    .from(APPLICATION_DRAFT_TABLE)
    .upsert(
      {
        user_id: userId,
        opening_id: openingId,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('draft_id, user_id, opening_id, payload, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function clearApplicantDraftByUserId(userId) {
  const { error } = await supabase
    .from(APPLICATION_DRAFT_TABLE)
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

async function resolveLatestOpeningApplicationForUser(userId) {
  const studentRecord = await resolveStudentByUserId(userId);
  if (!studentRecord) {
    return null;
  }

  const { data: applicationRecords, error } = await supabase
    .from('applications')
    .select(
      'application_id, student_id, program_id, opening_id, application_status, document_status, submission_date, is_disqualified'
    )
    .eq('student_id', studentRecord.student_id)
    .not('opening_id', 'is', null)
    .order('submission_date', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const applicationRecord =
    Array.isArray(applicationRecords) && applicationRecords.length > 0
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

async function resolveActiveOpeningApplicationForUser(userId) {
  const studentRecord = await resolveStudentByUserId(userId);
  if (!studentRecord) {
    return null;
  }

  const [scholarRecord, applicationResult] = await Promise.all([
    resolveScholarRecordForStudent(studentRecord.student_id),
    supabase
      .from('applications')
      .select(
        'application_id, student_id, program_id, opening_id, application_status, document_status, submission_date, is_disqualified'
      )
      .eq('student_id', studentRecord.student_id)
      .not('opening_id', 'is', null)
      .order('submission_date', { ascending: false, nullsFirst: false })
      .limit(25),
  ]);

  if (applicationResult.error) {
    throw applicationResult.error;
  }

  const activeApplication = (applicationResult.data || []).find((application) => {
    if (
      scholarRecord?.application_id &&
      scholarRecord.application_id === application.application_id
    ) {
      return false;
    }

    return isActiveApplicationRecord(application);
  });

  if (!activeApplication) {
    return null;
  }

  return {
    student: studentRecord,
    application: activeApplication,
  };
}

async function fetchVisibleProgramOpeningsForUser(userId) {
  const studentRecord = await resolveStudentByUserId(userId);
  const scholarRecord = studentRecord?.student_id
    ? await resolveScholarRecordForStudent(studentRecord.student_id)
    : null;

  const { data, error } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
      opening_title,
      announcement_text,
      posting_status,
      created_at,
      updated_at,
      scholarship_program (
        program_id,
        program_name
      )
    `)
    .eq('posting_status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const visibleOpenings = (data || []).filter((opening) => {
    if (!scholarRecord) {
      return true;
    }

    return isTesProgramName(opening.scholarship_program?.program_name || '');
  });

  return {
    items: visibleOpenings,
    scholarRecord,
  };
}

function mapApplicantOpening(opening, {
  activeApplication = null,
  draft = null,
} = {}) {
  const isTes = isTesProgramName(opening.scholarship_program?.program_name || '');
  const isActiveOpening = activeApplication?.opening_id === opening.opening_id;
  const isDraftOpening = draft?.opening_id === opening.opening_id;

  let canApply = true;
  let applyLabel = 'Start Application';

  if (isActiveOpening) {
    applyLabel = 'Open Documents';
  } else if (activeApplication?.application_id) {
    canApply = false;
    applyLabel = 'Application In Progress';
  } else if (isDraftOpening) {
    applyLabel = 'Continue Draft';
  }

  return {
    opening_id: opening.opening_id,
    program_id: opening.program_id,
    opening_title: opening.opening_title || 'Scholarship Opening',
    program_name: opening.scholarship_program?.program_name || 'Scholarship Program',
    application_start: '',
    application_end: '',
    posting_status: opening.posting_status || 'open',
    announcement_text: opening.announcement_text || '',
    is_tes: isTes,
    has_applied: !!isActiveOpening,
    can_reapply: false,
    can_apply: canApply,
    apply_label: applyLabel,
    benefactor_name: null,
    existing_application_id: isActiveOpening
      ? activeApplication.application_id
      : null,
  };
}

async function buildApplicantOpeningsPayload(userId) {
  const [draft, activeApplicationResult, visibleOpeningsResult] = await Promise.all([
    resolveApplicantDraftByUserId(userId),
    resolveActiveOpeningApplicationForUser(userId),
    fetchVisibleProgramOpeningsForUser(userId),
  ]);

  const items = [...visibleOpeningsResult.items];
  const existingIds = new Set(items.map((opening) => opening.opening_id));

  if (
    activeApplicationResult?.application?.opening_id &&
    !existingIds.has(activeApplicationResult.application.opening_id)
  ) {
    const activeOpening = await resolveOpeningById(
      activeApplicationResult.application.opening_id
    );

    if (activeOpening) {
      items.unshift(activeOpening);
    }
  }

  const mappedItems = items.map((opening) =>
    mapApplicantOpening(opening, {
      activeApplication: activeApplicationResult?.application || null,
      draft,
    })
  );

  const draftOpening = draft?.opening_id
    ? await resolveOpeningById(draft.opening_id)
    : null;

  return {
    hasSavedDraft: !!draft,
    draftOpeningId: draft?.opening_id || '',
    draftOpeningTitle: draftOpening?.opening_title || '',
    draftProgramName: draftOpening?.scholarship_program?.program_name || '',
    activeApplicationId:
      activeApplicationResult?.application?.application_id || '',
    activeOpeningId: activeApplicationResult?.application?.opening_id || '',
    isApprovedScholar: !!visibleOpeningsResult.scholarRecord,
    items: mappedItems,
  };
}

async function fetchLatestVisibleProgramOpeningForUser(userId) {
  const { items } = await fetchVisibleProgramOpeningsForUser(userId);
  const latestOpening = items.length > 0 ? items[0] : null;

  if (!latestOpening) {
    return null;
  }

  return {
    opening_id: latestOpening.opening_id,
    program_id: latestOpening.program_id,
    opening_title: latestOpening.opening_title || 'Scholarship Opening',
    announcement_text: latestOpening.announcement_text || '',
    created_at: latestOpening.created_at || null,
    program_name: latestOpening.scholarship_program?.program_name || null,
  };
}

async function fetchAvailableOpeningsForMobile(userId) {
  const context = await loadStudentProfileContextByUserId(userId);
  const latestApplication = await resolveLatestBaseApplicationForUser(userId);

  const { data, error } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
      opening_title,
      announcement_text,
      posting_status,
      allocated_slots,
      financial_allocation,
      per_scholar_amount,
      created_at,
      scholarship_program (
        program_id,
        program_name,
        benefactor_id
      )
    `)
    .eq('posting_status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];

  const benefactorIds = rows
    .map((row) => row?.scholarship_program?.benefactor_id)
    .filter(Boolean);

  let benefactorMap = {};
  if (benefactorIds.length > 0) {
    const { data: benefactors, error: benefactorError } = await supabase
      .from('benefactors')
      .select('benefactor_id, benefactor_name')
      .in('benefactor_id', benefactorIds);

    if (benefactorError) {
      throw benefactorError;
    }

    benefactorMap = Object.fromEntries(
      (benefactors || []).map((item) => [item.benefactor_id, item.benefactor_name])
    );
  }

  const existingProgramId = latestApplication?.application?.program_id ?? null;
  const existingApplicationId = latestApplication?.application?.application_id ?? null;

  const items = rows.map((row) => {
    const program = row.scholarship_program || {};
    const hasApplied =
      existingProgramId && String(existingProgramId) === String(row.program_id);

    return {
      opening_id: row.opening_id,
      program_id: row.program_id,
      opening_title: row.opening_title || 'Scholarship Opening',
      program_name: program.program_name || 'Scholarship Program',
      posting_status: row.posting_status || '',
      announcement_text: row.announcement_text || '',
      allocated_slots: row.allocated_slots ?? 0,
      financial_allocation: row.financial_allocation ?? 0,
      per_scholar_amount: row.per_scholar_amount ?? 0,
      benefactor_name: benefactorMap[program.benefactor_id] || null,
      has_applied: !!hasApplied,
      can_reapply: false,
      can_apply: !hasApplied,
      apply_label: hasApplied ? 'Already Applied' : 'Apply Now',
      existing_application_id: hasApplied ? existingApplicationId : null,
      created_at: row.created_at || null,
    };
  });

  return {
    hasBaseApplicationProfile: !!context?.student?.student_id,
    items,
  };
}

async function buildSavedFormDataForMobile(userId) {
  const context = await loadStudentProfileContextByUserId(userId);

  if (!context) {
    return {
      has_saved_form: false,
      account: {},
      personal: {},
      address: {},
      contact: {},
      family: {},
      academic: {},
      support: {},
      discipline: {},
      essays: {},
    };
  }

  const user = context.user || {};
  const student = context.student || {};
  const profile = context.student_profile || {};
  const course = context.course || {};

  return {
    has_saved_form: true,
    account: {
      user_id: user.user_id || '',
      student_id: student.pdm_id || user.username || '',
    },
    personal: {
      first_name: student.first_name || '',
      middle_name: student.middle_name || '',
      last_name: student.last_name || '',
      maiden_name: profile.maiden_name || '',
      age: '',
      date_of_birth: profile.date_of_birth || '',
      sex: profile.sex || '',
      place_of_birth: profile.place_of_birth || '',
      citizenship: profile.citizenship || '',
      civil_status: profile.civil_status || '',
      religion: profile.religion || '',
    },
    address: {
      street: profile.street_address || '',
      subdivision: profile.subdivision || '',
      barangay: student.barangay || '',
      city_municipality: profile.city || '',
      province: profile.province || '',
      zip_code: profile.zip_code || '',
    },
    contact: {
      landline: profile.landline_number || '',
      mobile_number: user.phone_number || '',
      email: user.email || '',
    },
    family: {
      father: {},
      mother: {},
      sibling: {},
      guardian: {},
    },
    academic: {
      current_course: course.course_code || '',
      current_course_code: course.course_code || '',
      student_number: student.pdm_id || '',
      lrn: profile.learners_reference_number || '',
    },
    support: {},
    discipline: {},
    essays: {},
  };
}

async function buildCurrentRenewalForMobile(userId) {
  const studentRecord = await resolveStudentByUserId(userId);

  if (!studentRecord?.student_id) {
    return {
      renewal: {
        renewal_id: '',
        scholar_id: '',
        student_id: '',
        program_id: '',
        semester_label: '',
        school_year_label: '',
        renewal_status: 'Pending Submission',
        document_status: 'Missing Docs',
        admin_comment: null,
        submitted_at: null,
        reviewed_at: null,
      },
      documents: [],
      scholar: {
        program_name: 'Scholarship',
        benefactor_name: null,
      },
      student: {
        name: 'Scholar',
        pdm_id: '',
      },
      cycle: {
        semester_label: '',
        school_year_label: '',
      },
    };
  }

  const { data: scholarRecord, error: scholarError } = await supabase
    .from('scholars')
    .select(`
      scholar_id,
      program_id,
      scholarship_program (
        program_name,
        benefactor_id
      )
    `)
    .eq('student_id', studentRecord.student_id)
    .maybeSingle();

  if (scholarError) {
    throw scholarError;
  }

  let benefactorName = null;
  const benefactorId = scholarRecord?.scholarship_program?.benefactor_id;
  if (benefactorId) {
    const { data: benefactorRow, error: benefactorError } = await supabase
      .from('benefactors')
      .select('benefactor_name')
      .eq('benefactor_id', benefactorId)
      .maybeSingle();

    if (benefactorError) {
      throw benefactorError;
    }

    benefactorName = benefactorRow?.benefactor_name || null;
  }

  const now = new Date();
  const semesterLabel = now.getMonth() < 6 ? 'Second Semester' : 'First Semester';
  const schoolYearLabel =
    now.getMonth() < 6
      ? `${now.getFullYear() - 1}-${now.getFullYear()}`
      : `${now.getFullYear()}-${now.getFullYear() + 1}`;

  return {
    renewal: {
      renewal_id: '',
      scholar_id: scholarRecord?.scholar_id || '',
      student_id: studentRecord.student_id || '',
      program_id: scholarRecord?.program_id || '',
      semester_label: semesterLabel,
      school_year_label: schoolYearLabel,
      renewal_status: 'Pending Submission',
      document_status: 'Missing Docs',
      admin_comment: null,
      submitted_at: null,
      reviewed_at: null,
    },
    documents: [],
    scholar: {
      program_name: scholarRecord?.scholarship_program?.program_name || 'Scholarship',
      benefactor_name: benefactorName,
    },
    student: {
      name: `${studentRecord.first_name || ''} ${studentRecord.last_name || ''}`.trim() || 'Scholar',
      pdm_id: studentRecord.pdm_id || '',
    },
    cycle: {
      semester_label: semesterLabel,
      school_year_label: schoolYearLabel,
    },
  };
}

async function fetchMyPayoutSchedules(userId) {
  const studentRecord = await resolveStudentByUserId(userId);

  if (!studentRecord?.student_id) {
    return { items: [] };
  }

  const { data: scholarRecord, error: scholarError } = await supabase
    .from('scholars')
    .select('scholar_id')
    .eq('student_id', studentRecord.student_id)
    .maybeSingle();

  if (scholarError) {
    throw scholarError;
  }

  if (!scholarRecord?.scholar_id) {
    return { items: [] };
  }

  const { data, error } = await supabase
    .from('payout_batch_scholars')
    .select(`
      payout_entry_id,
      amount_received,
      release_status,
      payout_batches (
        payout_batch_id,
        payout_title,
        payout_date,
        semester,
        school_year,
        payment_mode,
        batch_status,
        program_id
      )
    `)
    .eq('scholar_id', scholarRecord.scholar_id);

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const programIds = rows
    .map((row) => row?.payout_batches?.program_id)
    .filter(Boolean);

  let programMap = {};
  if (programIds.length > 0) {
    const { data: programs, error: programError } = await supabase
      .from('scholarship_program')
      .select('program_id, program_name, benefactor_id')
      .in('program_id', programIds);

    if (programError) {
      throw programError;
    }

    const benefactorIds = (programs || [])
      .map((item) => item.benefactor_id)
      .filter(Boolean);

    let benefactorMap = {};
    if (benefactorIds.length > 0) {
      const { data: benefactors, error: benefactorError } = await supabase
        .from('benefactors')
        .select('benefactor_id, benefactor_name')
        .in('benefactor_id', benefactorIds);

      if (benefactorError) {
        throw benefactorError;
      }

      benefactorMap = Object.fromEntries(
        (benefactors || []).map((item) => [item.benefactor_id, item.benefactor_name])
      );
    }

    programMap = Object.fromEntries(
      (programs || []).map((item) => [
        item.program_id,
        {
          program_name: item.program_name,
          benefactor_name: benefactorMap[item.benefactor_id] || null,
        },
      ])
    );
  }

  const items = rows
    .map((row) => {
      const batch = row.payout_batches || {};
      const programInfo = programMap[batch.program_id] || {};

      return {
        payout_entry_id: row.payout_entry_id,
        payout_batch_id: batch.payout_batch_id || '',
        title: batch.payout_title || 'Scholarship Payout',
        amount: row.amount_received || 0,
        status: row.release_status || 'Pending',
        payout_date: batch.payout_date || '',
        semester: batch.semester || '',
        school_year: batch.school_year || '',
        payment_mode: batch.payment_mode || '',
        batch_status: batch.batch_status || '',
        program_name: programInfo.program_name || 'Scholarship Program',
        benefactor_name: programInfo.benefactor_name || null,
        reference: batch.payout_batch_id || '',
      };
    })
    .sort((a, b) => {
      const aDate = a.payout_date || '';
      const bDate = b.payout_date || '';
      return bDate.localeCompare(aDate);
    });

  return { items };
}

async function buildSavedFormDataForMobile(userId) {
  const context = await loadStudentProfileContextByUserId(userId);

  if (!context) {
    return {
      has_saved_form: false,
      account: {},
      personal: {},
      address: {},
      contact: {},
      family: {},
      academic: {},
      support: {},
      discipline: {},
      essays: {},
    };
  }

  const user = context.user || {};
  const student = context.student || {};
  const profile = context.student_profile || {};
  const course = context.course || {};

  return {
    has_saved_form: true,
    account: {
      user_id: user.user_id || '',
      student_id: student.pdm_id || user.username || '',
    },
    personal: {
      first_name: student.first_name || '',
      middle_name: student.middle_name || '',
      last_name: student.last_name || '',
      maiden_name: profile.maiden_name || '',
      age: '',
      date_of_birth: profile.date_of_birth || '',
      sex: profile.sex || '',
      place_of_birth: profile.place_of_birth || '',
      citizenship: profile.citizenship || '',
      civil_status: profile.civil_status || '',
      religion: profile.religion || '',
    },
    address: {
      street: profile.street_address || '',
      subdivision: profile.subdivision || '',
      barangay: student.barangay || '',
      city_municipality: profile.city || '',
      province: profile.province || '',
      zip_code: profile.zip_code || '',
    },
    contact: {
      landline: profile.landline_number || '',
      mobile_number: user.phone_number || '',
      email: user.email || '',
    },
    family: {
      father: {},
      mother: {},
      sibling: {},
      guardian: {},
    },
    academic: {
      current_course: course.course_code || '',
      student_number: student.pdm_id || '',
      lrn: profile.learners_reference_number || '',
    },
    support: {},
    discipline: {},
    essays: {},
  };
}

async function buildCurrentRenewalForMobile(userId) {
  const studentRecord = await resolveStudentByUserId(userId);

  if (!studentRecord?.student_id) {
    return {
      renewal: {
        renewal_id: '',
        scholar_id: '',
        student_id: '',
        program_id: '',
        semester_label: '',
        school_year_label: '',
        renewal_status: 'Pending Submission',
        document_status: 'Missing Docs',
        admin_comment: null,
        submitted_at: null,
        reviewed_at: null,
      },
      documents: [],
      scholar: {
        program_name: 'Scholarship',
        benefactor_name: null,
      },
      student: {
        name: 'Scholar',
        pdm_id: '',
      },
      cycle: {
        semester_label: '',
        school_year_label: '',
      },
    };
  }

  const { data: scholarRecord, error: scholarError } = await supabase
    .from('scholars')
    .select(`
      scholar_id,
      program_id,
      scholarship_program (
        program_name,
        benefactor_id
      )
    `)
    .eq('student_id', studentRecord.student_id)
    .maybeSingle();

  if (scholarError) {
    throw scholarError;
  }

  let benefactorName = null;
  const benefactorId = scholarRecord?.scholarship_program?.benefactor_id;
  if (benefactorId) {
    const { data: benefactorRow } = await supabase
      .from('benefactors')
      .select('benefactor_name')
      .eq('benefactor_id', benefactorId)
      .maybeSingle();

    benefactorName = benefactorRow?.benefactor_name || null;
  }

  const now = new Date();
  const semesterLabel = now.getMonth() < 6 ? 'Second Semester' : 'First Semester';
  const schoolYearLabel =
    now.getMonth() < 6
      ? `${now.getFullYear() - 1}-${now.getFullYear()}`
      : `${now.getFullYear()}-${now.getFullYear() + 1}`;

  return {
    renewal: {
      renewal_id: '',
      scholar_id: scholarRecord?.scholar_id || '',
      student_id: studentRecord.student_id || '',
      program_id: scholarRecord?.program_id || '',
      semester_label: semesterLabel,
      school_year_label: schoolYearLabel,
      renewal_status: 'Pending Submission',
      document_status: 'Missing Docs',
      admin_comment: null,
      submitted_at: null,
      reviewed_at: null,
    },
    documents: [],
    scholar: {
      program_name: scholarRecord?.scholarship_program?.program_name || 'Scholarship',
      benefactor_name: benefactorName,
    },
    student: {
      name: `${studentRecord.first_name || ''} ${studentRecord.last_name || ''}`.trim() || 'Scholar',
      pdm_id: studentRecord.pdm_id || '',
    },
    cycle: {
      semester_label: semesterLabel,
      school_year_label: schoolYearLabel,
    },
  };
}

async function fetchMyPayoutSchedules(userId) {
  const studentRecord = await resolveStudentByUserId(userId);

  if (!studentRecord?.student_id) {
    return { items: [] };
  }

  const { data: scholarRecord, error: scholarError } = await supabase
    .from('scholars')
    .select('scholar_id')
    .eq('student_id', studentRecord.student_id)
    .maybeSingle();

  if (scholarError) {
    throw scholarError;
  }

  if (!scholarRecord?.scholar_id) {
    return { items: [] };
  }

  const { data, error } = await supabase
    .from('payout_batch_scholars')
    .select(`
      payout_entry_id,
      amount_received,
      release_status,
      payout_batches (
        payout_batch_id,
        payout_title,
        payout_date,
        semester,
        school_year,
        payment_mode,
        batch_status,
        program_id
      )
    `)
    .eq('scholar_id', scholarRecord.scholar_id);

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const programIds = rows
    .map((row) => row?.payout_batches?.program_id)
    .filter(Boolean);

  let programMap = {};
  if (programIds.length > 0) {
    const { data: programs, error: programError } = await supabase
      .from('scholarship_program')
      .select('program_id, program_name, benefactor_id')
      .in('program_id', programIds);

    if (programError) {
      throw programError;
    }

    const benefactorIds = (programs || [])
      .map((item) => item.benefactor_id)
      .filter(Boolean);

    let benefactorMap = {};
    if (benefactorIds.length > 0) {
      const { data: benefactors, error: benefactorError } = await supabase
        .from('benefactors')
        .select('benefactor_id, benefactor_name')
        .in('benefactor_id', benefactorIds);

      if (benefactorError) {
        throw benefactorError;
      }

      benefactorMap = Object.fromEntries(
        (benefactors || []).map((item) => [item.benefactor_id, item.benefactor_name])
      );
    }

    programMap = Object.fromEntries(
      (programs || []).map((item) => [
        item.program_id,
        {
          program_name: item.program_name,
          benefactor_name: benefactorMap[item.benefactor_id] || null,
        },
      ])
    );
  }

  const items = rows
    .map((row) => {
      const batch = row.payout_batches || {};
      const programInfo = programMap[batch.program_id] || {};

      return {
        payout_entry_id: row.payout_entry_id,
        payout_batch_id: batch.payout_batch_id || '',
        title: batch.payout_title || 'Scholarship Payout',
        amount: row.amount_received || 0,
        status: row.release_status || 'Pending',
        payout_date: batch.payout_date || '',
        semester: batch.semester || '',
        school_year: batch.school_year || '',
        payment_mode: batch.payment_mode || '',
        batch_status: batch.batch_status || '',
        program_name: programInfo.program_name || 'Scholarship Program',
        benefactor_name: programInfo.benefactor_name || null,
        reference: batch.payout_batch_id || '',
      };
    })
    .sort((a, b) => String(b.payout_date).compareTo(String(a.payout_date)));

  return { items };
}

async function buildApplicantDocumentPackage({
  applicationId,
  context = {},
}) {
  const details = await buildApplicationDetails(applicationId);

  return {
    application: details.application,
    context: {
      opening_id:
        context.opening_id ??
        details.application?.opening_id ??
        '',
      opening_title:
        context.opening_title ??
        details.application?.opening_title ??
        'Scholarship Requirements',
      program_name:
        context.program_name ||
        details.student?.program_name ||
        'Unassigned Application',
    },
    documents: details.documents ?? [],
  };
}

async function buildApplicantStatusSummaryForUser(userId) {
  const latestApplication = await resolveLatestOpeningApplicationForUser(userId);

  if (!latestApplication?.application?.application_id) {
    return { has_application: false };
  }

  const details = await buildApplicationDetails(
    latestApplication.application.application_id
  );

  return {
    has_application: true,
    application: {
      application_id: details.application?.application_id ?? null,
      application_status: details.application?.application_status ?? null,
      document_status: details.application?.document_status ?? null,
      submission_date: details.application?.submission_date ?? null,
      program_id: details.application?.program_id ?? null,
      opening_id: details.application?.opening_id ?? null,
      opening_title: details.application?.opening_title ?? null,
      program_name: details.student?.program_name ?? 'Unassigned Application',
    },
  };
}

async function uploadApplicationDocumentFile({
  applicationId,
  uploadedBy,
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

  await ensureApplicationDocumentPlaceholders(applicationId, uploadedBy);

  const sanitizedFileName = (file.originalname || 'document')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
  const fileScope = applicationId || uploadedBy;
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
      file_name: sanitizedFileName,
      file_path: fileName,
      file_url: fileUrl,
      submitted_at: new Date().toISOString(),
      remarks: null,
      notes: null,
    })
    .eq('uploaded_by', uploadedBy)
    .eq('application_id', applicationId)
    .eq('document_type', definition.name);

  if (documentUpdateError) {
    throw documentUpdateError;
  }

  await refreshApplicationDocumentStatus(applicationId, uploadedBy);

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
      opening_id,
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
  const openingRecord = applicationRecord.opening_id
    ? await resolveOpeningById(applicationRecord.opening_id)
    : null;

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
      opening_id: applicationRecord.opening_id ?? null,
      opening_title: openingRecord?.opening_title ?? null,
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

async function resolveUserAccountRecord(userId) {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('user_id, username, email, phone_number')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function resolveCourseIdByCode(courseCode) {
  if (!courseCode) {
    return null;
  }

  const { data: courseData, error: courseError } = await supabase
    .from('academic_course')
    .select('course_id, course_code')
    .eq('course_code', courseCode)
    .maybeSingle();

  if (courseError) {
    throw courseError;
  }

  if (!courseData) {
    const error = new Error('Selected course is invalid.');
    error.statusCode = 400;
    throw error;
  }

  return courseData.course_id;
}

async function persistApplicantProfileSubmission(payload = {}) {
  const {
    account = {},
    personal = {},
    address = {},
    contact = {},
    family = {},
    academic = {},
    support = {},
    discipline = {},
    essays = {},
  } = payload;

  if (!account.user_id || !account.student_id || !contact.email) {
    const error = new Error('Missing required account details.');
    error.statusCode = 400;
    throw error;
  }

  if (
    academic.student_number &&
    academic.student_number.trim() &&
    academic.student_number.trim() !== account.student_id
  ) {
    const error = new Error(
      'Student number must match the logged-in student ID.'
    );
    error.statusCode = 400;
    throw error;
  }

  const courseId = await resolveCourseIdByCode(academic.current_course_code);

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
    throw studentFetchError;
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
      throw studentUpdateError;
    }

    studentRecord = updatedStudent;
  } else {
    const { data: insertedStudent, error: studentInsertError } = await supabase
      .from('students')
      .insert([studentPayload])
      .select('student_id')
      .single();

    if (studentInsertError) {
      throw studentInsertError;
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
    throw userUpdateError;
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

  const { data: profileRecord, error: profileError } = await supabase
    .from('student_profiles')
    .upsert([studentProfilePayload], { onConflict: 'student_id' })
    .select('profile_id, student_id')
    .single();

  if (profileError) {
    throw profileError;
  }

  if (!profileRecord?.profile_id) {
    const error = new Error(
      'Failed to resolve the saved student profile for this application.'
    );
    error.statusCode = 500;
    throw error;
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

  const familyRecordsByRelation = {};

  for (const row of familyRows) {
    const { data: existingFamilyRows, error: familyFetchError } = await supabase
      .from('student_family')
      .select('family_id')
      .eq('student_id', studentRecord.student_id)
      .eq('relation', row.relation);

    if (familyFetchError) {
      throw familyFetchError;
    }

    if ((existingFamilyRows || []).length > 0) {
      const existingFamilyRecord = existingFamilyRows[0];
      const { data: updatedFamilyRecord, error: familyUpdateError } = await supabase
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
        .eq('relation', row.relation)
        .select('family_id, relation')
        .single();

      if (familyUpdateError) {
        throw familyUpdateError;
      }

      familyRecordsByRelation[row.relation] =
        updatedFamilyRecord || existingFamilyRecord;
    } else {
      const { data: insertedFamilyRecord, error: familyInsertError } = await supabase
        .from('student_family')
        .insert([
          {
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
          },
        ])
        .select('family_id, relation')
        .single();

      if (familyInsertError) {
        throw familyInsertError;
      }

      familyRecordsByRelation[row.relation] = insertedFamilyRecord;
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

  const { data: educationRecords, error: educationError } = await supabase
    .from('student_education')
    .upsert(educationRows, { onConflict: 'student_id,education_level' })
    .select('education_id, education_level');

  if (educationError) {
    throw educationError;
  }

  const familyRecord =
    familyRecordsByRelation.Guardian ||
    familyRecordsByRelation.Father ||
    familyRecordsByRelation.Mother ||
    familyRecordsByRelation.Sibling ||
    null;

  if (!familyRecord?.family_id) {
    const error = new Error(
      'Failed to resolve the saved family record for this application.'
    );
    error.statusCode = 500;
    throw error;
  }

  const educationRecord =
    (educationRecords || []).find(
      (row) => String(row.education_level || '').toLowerCase() === 'college'
    ) ||
    (educationRecords || []).find(
      (row) =>
        String(row.education_level || '').toLowerCase() === 'senior high school'
    ) ||
    (educationRecords || [])[0] ||
    null;

  return {
    studentRecord,
    profileRecord,
    familyRecord,
    educationRecord,
    account,
    contact,
    studentProfilePayload,
    familyRows,
    educationRows,
  };
}

async function buildApplicationSubmissionResponse({
  applicationId,
  studentRecord,
  account,
  contact,
  studentProfilePayload,
  familyRows,
  educationRows,
  message,
}) {
  const detailedApplication = await buildApplicationDetails(applicationId);

  return {
    message,
    application: detailedApplication.application ?? null,
    student: detailedApplication.student ?? {
      id: studentRecord.student_id,
      pdm_id: account.student_id,
      email: contact.email,
      phone: contact.mobile_number ?? null,
    },
    student_profile: detailedApplication.student_profile ?? studentProfilePayload,
    family_members: detailedApplication.family_members ?? familyRows,
    education_records: detailedApplication.education_records ?? educationRows,
    documents: detailedApplication.documents ?? [],
  };
}

async function submitApplicantOpeningApplication({
  userId,
  openingId,
  incomingPayload = {},
}) {
  const opening = await resolveOpeningById(openingId);

  if (!opening) {
    throw createHttpError(404, 'Scholarship opening not found.');
  }

  if ((opening.posting_status || '').toLowerCase() !== 'open') {
    throw createHttpError(
      409,
      'This scholarship opening is no longer accepting applications.'
    );
  }

  const studentRecord = await resolveStudentByUserId(userId);
  const scholarRecord = studentRecord?.student_id
    ? await resolveScholarRecordForStudent(studentRecord.student_id)
    : null;

  if (
    scholarRecord &&
    !isTesProgramName(opening.scholarship_program?.program_name || '')
  ) {
    throw createHttpError(
      403,
      'Approved scholars can only apply to TES scholarship openings.'
    );
  }

  const activeApplication = await resolveActiveOpeningApplicationForUser(userId);
  if (activeApplication?.application?.application_id) {
    throw createHttpError(
      409,
      'You already have an active scholarship application. Finish that application before starting a new one.'
    );
  }

  const userRecord = await resolveUserAccountRecord(userId);
  const normalizedPayload = {
    ...incomingPayload,
    account: {
      ...(incomingPayload.account ?? {}),
      user_id: userId,
      student_id: incomingPayload.account?.student_id || userRecord?.username || '',
    },
    contact: {
      ...(incomingPayload.contact ?? {}),
      email:
        incomingPayload.contact?.email ||
        incomingPayload.account?.email ||
        userRecord?.email ||
        '',
    },
  };

  if (
    incomingPayload.account?.user_id &&
    incomingPayload.account.user_id !== userId
  ) {
    throw createHttpError(
      403,
      'The submitted account does not match the logged-in user.'
    );
  }

  const persisted = await persistApplicantProfileSubmission(normalizedPayload);
  const submissionDate = new Date().toISOString();

  const { data: applicationRecord, error: applicationInsertError } =
    await supabase
      .from('applications')
      .insert([
        {
          student_id: persisted.studentRecord.student_id,
          profile_id: persisted.profileRecord.profile_id,
          family_id: persisted.familyRecord.family_id,
          education_id: persisted.educationRecord?.education_id ?? null,
          opening_id: opening.opening_id,
          program_id: opening.program_id,
          application_status: 'Pending Review',
          submission_date: submissionDate,
          document_status: 'Missing Docs',
          is_disqualified: false,
        },
      ])
      .select('application_id')
      .single();

  if (applicationInsertError) {
    throw applicationInsertError;
  }

  await ensureApplicationDocumentPlaceholders(
    applicationRecord.application_id,
    persisted.studentRecord.student_id
  );
  await clearApplicantDraftByUserId(userId);

  return buildApplicationSubmissionResponse({
    applicationId: applicationRecord.application_id,
    studentRecord: persisted.studentRecord,
    account: persisted.account,
    contact: persisted.contact,
    studentProfilePayload: persisted.studentProfilePayload,
    familyRows: persisted.familyRows,
    educationRows: persisted.educationRows,
    message:
      'Application submitted successfully. You can now upload your scholarship requirements.',
  });
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
  let { email, password, student_id } = req.body;

  console.log('DEBUG (Backend): Received registration request body:', req.body);

  try {
    email = (email || '').toString().trim().toLowerCase();
    student_id = (student_id || '').toString().trim();

    if (!email || !password || !student_id) {
      return res.status(400).json({ error: 'Email, password, and Student ID are required' });
    }

    const studentIdRegex = /^PDM-\d{4}-\d{6}$/;
    if (!studentIdRegex.test(student_id)) {
      return res.status(400).json({
        error: 'Student ID must be in the format PDM-YYYY-NNNNNN (e.g. PDM-2023-000001)',
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
      barangay,
      phone_number,
    } = req.body;

    if (!first_name || !last_name || !course_code) {
      return res.status(400).json({
        error: 'First name, last name, and course code are required.',
      });
    }

    const courseId = await resolveCourseIdByCode(course_code);

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

    const studentPayload = {
      user_id: userId,
      pdm_id: accountStudentId,
      first_name: String(first_name).trim(),
      middle_name: middle_name ? String(middle_name).trim() : null,
      last_name: String(last_name).trim(),
      barangay: barangay ? String(barangay).trim() : null,
      year_level: year_level ?? null,
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
      const { data: courseData, error: courseError } = await supabase
        .from('academic_course')
        .select('course_id, course_code')
        .eq('course_code', courseCode)
        .maybeSingle();

      if (courseError) {
        console.error('Profile course lookup error:', courseError);
        return res.status(500).json({ error: 'Failed to validate course.' });
      }

      if (!courseData) {
        return res.status(400).json({ error: 'Selected course is invalid.' });
      }

      courseId = courseData.course_id;
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

    const isProfileComplete =
      !!firstName &&
      !!lastName &&
      !!email &&
      !!courseCode;

    nextStudentPayload.is_profile_complete = isProfileComplete;

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
      sex: payload.sex ?? context.student_profile?.sex ?? null,
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

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
