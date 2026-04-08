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
const APPLICATION_UPLOADS_BUCKET =
  process.env.APPLICATION_UPLOADS_BUCKET || 'application-documents';
const RENEWAL_UPLOADS_BUCKET =
  process.env.RENEWAL_UPLOADS_BUCKET || 'renewal-documents';
notificationService.configureNotificationService({ io, supabase });
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

function normalizeApplicationDocumentDefinition(value) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) return null;

  return (
    APPLICATION_DOCUMENT_DEFINITIONS.find((definition) => {
      const candidates = [
        definition.id,
        definition.name,
        ...definition.aliases,
      ].map((candidate) => normalizeLookupValue(candidate));

      return candidates.includes(normalized);
    }) || null
  );
}

const RENEWAL_DOCUMENT_DEFINITIONS = [
  {
    id: 'certificate_of_registration',
    routeParam: 'certificate-of-registration',
    name: 'Certificate of Registration',
    aliases: ['certificate of registration', 'cor', 'registration'],
  },
  {
    id: 'grade_form_transcript',
    routeParam: 'grade-form-transcript',
    name: 'Grade Form / Transcript',
    aliases: ['grade form', 'transcript', 'grade form transcript', 'grades'],
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

function deriveScholarRenewalDocumentReviewStatus(document = {}) {
  const preferredStatus = normalizeLookupValue(document.review_status);

  if (preferredStatus === 'verified') return 'verified';
  if (preferredStatus === 'rejected' || preferredStatus === 're upload') {
    return 'rejected';
  }
  if (document.is_submitted && document.file_url) return 'uploaded';
  return 'pending';
}

function deriveScholarRenewalDocumentStatus(documents = [], renewalStatus = 'Draft') {
  const normalizedRenewalStatus = normalizeLookupValue(renewalStatus);
  const uploadedCount = documents.filter(
    (document) => document.is_submitted || !!document.file_url
  ).length;
  const rejectedCount = documents.filter(
    (document) => deriveScholarRenewalDocumentReviewStatus(document) === 'rejected'
  ).length;

  if (rejectedCount > 0 || normalizedRenewalStatus === 'failed') {
    return 'Needs Reupload';
  }

  if (
    normalizedRenewalStatus === 'submitted' ||
    normalizedRenewalStatus === 'under review'
  ) {
    return 'Under Review';
  }

  if (normalizedRenewalStatus === 'approved') {
    return 'Documents Ready';
  }

  if (uploadedCount >= RENEWAL_DOCUMENT_DEFINITIONS.length) {
    return 'Documents Ready';
  }

  return 'Missing Docs';
}

function normalizeRenewalDocumentType(value) {
  const normalizedValue = normalizeLookupValue(value);

  for (const definition of RENEWAL_DOCUMENT_DEFINITIONS) {
    if (
      normalizedValue === normalizeLookupValue(definition.routeParam) ||
      normalizedValue === normalizeLookupValue(definition.name) ||
      definition.aliases.some((alias) => normalizedValue.includes(alias))
    ) {
      return definition;
    }
  }

  return null;
}

async function fetchActiveAcademicPeriod() {
  const { data, error } = await supabase
    .from('academic_period')
    .select(
      'period_id, current_academic_year, current_semester, is_active, activated_at'
    )
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

function ensureScholarRenewalDocumentCoverage(documents = []) {
  const documentMap = new Map(
    documents.map((document) => [
      normalizeLookupValue(document.document_type),
      document,
    ])
  );

  return RENEWAL_DOCUMENT_DEFINITIONS.map((definition) => {
    const existingDocument =
      documentMap.get(normalizeLookupValue(definition.name)) || null;

    return (
      existingDocument || {
        renewal_document_id: null,
        document_type: definition.name,
        is_submitted: false,
        file_url: null,
        review_status: 'pending',
        admin_comment: null,
        submitted_at: null,
        reviewed_at: null,
        remarks: null,
      }
    );
  });
}

function getTodayLocalISO() {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offsetMinutes * 60 * 1000);
  return local.toISOString().split('T')[0];
}

function isTesProgramName(programName) {
  return /(^|\b)tes(\b|$)/i.test((programName || '').toString());
}

async function fetchOpeningWithProgram(openingId) {
  const { data, error } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
      opening_title,
      application_start,
      application_end,
      posting_status,
      announcement_text,
      allocated_slots,
      financial_allocation,
      scholarship_program (
        program_id,
        organization_name,
        program_name
      )
    `)
    .eq('opening_id', openingId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

function validateOpeningAvailability(opening) {
  if (!opening) {
    return 'Selected scholarship opening does not exist.';
  }

  if ((opening.posting_status || '').toLowerCase() !== 'open') {
    return 'This scholarship opening is not currently accepting applications.';
  }

  const today = getTodayLocalISO();
  if (opening.application_start && today < opening.application_start) {
    return 'This scholarship opening is not yet accepting applications.';
  }

  if (opening.application_end && today > opening.application_end) {
    return 'This scholarship opening is already closed.';
  }

  return null;
}

async function loadStudentContextByUserId(userId) {
  const { data: studentRecord, error: studentError } = await supabase
    .from('students')
    .select('student_id, user_id, pdm_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (studentError) {
    throw studentError;
  }

  if (!studentRecord?.student_id) {
    return {
      student: null,
      studentProfile: null,
    };
  }

  const { data: studentProfile, error: profileError } = await supabase
    .from('student_profiles')
    .select('student_id')
    .eq('student_id', studentRecord.student_id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  return {
    student: studentRecord,
    studentProfile: studentProfile ?? null,
  };
}

async function loadScholarContextByUserId(userId) {
  const { data: studentRecord, error: studentError } = await supabase
    .from('students')
    .select('student_id, user_id, pdm_id, first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (studentError) {
    throw studentError;
  }

  if (!studentRecord?.student_id) {
    return {
      student: null,
      scholar: null,
    };
  }

  const { data: scholarRecord, error: scholarError } = await supabase
    .from('scholars')
    .select(`
      scholar_id,
      student_id,
      program_id,
      status,
      batch_year,
      date_awarded
    `)
    .eq('student_id', studentRecord.student_id)
    .eq('status', 'Active')
    .maybeSingle();

  if (scholarError) {
    throw scholarError;
  }

  let scholarshipProgram = null;
  if (scholarRecord?.program_id) {
    const { data: programRecord, error: programError } = await supabase
      .from('scholarship_programs')
      .select('program_id, program_name, organization_name')
      .eq('program_id', scholarRecord.program_id)
      .maybeSingle();

    if (programError) {
      throw programError;
    }

    scholarshipProgram = programRecord ?? null;
  }

  return {
    student: studentRecord,
    scholar: scholarRecord
      ? {
          ...scholarRecord,
          scholarship_programs: scholarshipProgram,
        }
      : null,
  };
}

async function ensureCurrentScholarRenewalForUser(userId) {
  const { student, scholar } = await loadScholarContextByUserId(userId);
  const period = await fetchActiveAcademicPeriod();

  if (!student?.student_id || !scholar?.scholar_id) {
    return {
      student,
      scholar,
      renewal: null,
      documents: [],
      period,
    };
  }

  if (!period?.period_id) {
    return {
      student,
      scholar,
      renewal: null,
      documents: [],
      period: null,
    };
  }

  const { data: existingRenewal, error: renewalLookupError } = await supabase
    .from('renewals')
    .select('*')
    .eq('scholar_id', scholar.scholar_id)
    .eq('period_id', period.period_id)
    .maybeSingle();

  if (renewalLookupError) {
    throw renewalLookupError;
  }

  let renewal = existingRenewal;
  if (!renewal) {
    const { data: insertedRenewal, error: insertError } = await supabase
      .from('renewals')
      .insert({
        scholar_id: scholar.scholar_id,
        period_id: period.period_id,
        status: 'Pending Submission',
        deadline_date: null,
        submitted_on: null,
      })
      .select('*')
      .single();

    if (insertError) {
      throw insertError;
    }

    renewal = insertedRenewal;
  }

  const placeholderDocuments = RENEWAL_DOCUMENT_DEFINITIONS.map((definition) => ({
    renewal_id: renewal.renewal_id,
    document_type: definition.name,
    is_submitted: false,
    file_url: null,
    review_status: 'pending',
    admin_comment: null,
    submitted_at: null,
    reviewed_at: null,
    remarks: null,
  }));

  const { error: documentUpsertError } = await supabase
    .from('renewal_documents')
    .upsert(placeholderDocuments, { onConflict: 'renewal_id,document_type' });

  if (documentUpsertError) {
    throw documentUpsertError;
  }

  const { data: savedDocuments, error: savedDocumentsError } = await supabase
    .from('renewal_documents')
    .select('*')
    .eq('renewal_id', renewal.renewal_id)
    .order('document_type', { ascending: true });

  if (savedDocumentsError) {
    throw savedDocumentsError;
  }

  const documents = ensureScholarRenewalDocumentCoverage(savedDocuments || []);
  const nextDocumentStatus = deriveScholarRenewalDocumentStatus(
    documents,
    renewal.status
  );

  return {
    student,
    scholar,
    renewal,
    documents,
    period,
    documentStatus: nextDocumentStatus,
  };
}

function buildScholarRenewalPayload({
  student,
  scholar,
  renewal,
  documents,
  period,
  documentStatus = 'Missing Docs',
}) {
  const normalizedDocuments = ensureScholarRenewalDocumentCoverage(documents).map(
    (document) => {
      const definition = normalizeRenewalDocumentType(document.document_type);
      const status = deriveScholarRenewalDocumentReviewStatus(document);

      return {
        renewal_document_id: document.renewal_document_id ?? null,
        id: definition?.id ?? normalizeLookupValue(document.document_type),
        route_param: definition?.routeParam ?? null,
        document_type: document.document_type,
        name: document.document_type,
        is_submitted: !!document.is_submitted,
        file_url: document.file_url ?? null,
        status,
        review_status: document.review_status ?? 'pending',
        admin_comment: document.admin_comment ?? '',
        submitted_at: document.submitted_at ?? null,
        reviewed_at: document.reviewed_at ?? null,
        remarks: document.remarks ?? null,
      };
    }
  );

  return {
    renewal: renewal
      ? {
          renewal_id: renewal.renewal_id,
          scholar_id: renewal.scholar_id,
          student_id: student?.student_id ?? null,
          program_id: scholar?.program_id ?? null,
          period_id: renewal.period_id,
          semester_label: period?.current_semester ?? '',
          school_year_label: period?.current_academic_year ?? '',
          renewal_status: renewal.status,
          document_status: documentStatus,
          admin_comment: null,
          submitted_at: renewal.submitted_on ?? null,
          reviewed_at: null,
        }
      : null,
    scholar: scholar
      ? {
          scholar_id: scholar.scholar_id,
          student_id: scholar.student_id,
          program_id: scholar.program_id,
          program_name: scholar.scholarship_programs?.program_name ?? 'Scholarship',
          benefactor_name:
            scholar.scholarship_programs?.organization_name ?? null,
          status: scholar.status ?? 'Active',
          batch_year: scholar.batch_year ?? null,
          date_awarded: scholar.date_awarded ?? null,
        }
      : null,
    student: student
      ? {
          student_id: student.student_id,
          pdm_id: student.pdm_id ?? null,
          name:
            `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() ||
            'Unknown Student',
        }
      : null,
    cycle: {
      period_id: period?.period_id ?? null,
      semester_label: period?.current_semester ?? '',
      school_year_label: period?.current_academic_year ?? '',
    },
    documents: normalizedDocuments,
  };
}

function buildOpeningCard(opening, applicationByOpeningId = new Map()) {
  const appliedApplication = applicationByOpeningId.get(opening.opening_id) || null;
  const programName = opening.scholarship_program?.program_name || 'Unknown Program';
  const isTes = isTesProgramName(programName);
  const hasApplied = !!appliedApplication;
  const needsRequirements =
    hasApplied && appliedApplication?.document_status !== 'Documents Ready';
  const canReapply = isTes && hasApplied && !needsRequirements;
  const canApply = !hasApplied || canReapply || needsRequirements;

  return {
    opening_id: opening.opening_id,
    program_id: opening.program_id,
    opening_title: opening.opening_title,
    program_name: programName,
    benefactor_name: opening.scholarship_program?.organization_name || null,
    application_start: opening.application_start,
    application_end: opening.application_end,
    posting_status: opening.posting_status,
    announcement_text: opening.announcement_text,
    allocated_slots: opening.allocated_slots ?? 0,
    financial_allocation: opening.financial_allocation ?? null,
    is_tes: isTes,
    has_applied: hasApplied,
    can_reapply: canReapply,
    can_apply: canApply,
    apply_label: needsRequirements
      ? 'Upload Requirements'
      : hasApplied && canReapply
        ? 'Re-apply'
        : hasApplied
          ? 'Already Applied'
          : 'Apply Now',
    existing_application_id: appliedApplication?.application_id ?? null,
  };
}

async function ensureApplicationDocumentPlaceholders(applicationId, studentId) {
  const placeholderDocuments = APPLICATION_DOCUMENT_DEFINITIONS.map(
    (documentDefinition) => ({
      application_id: applicationId,
      student_id: studentId,
      document_type: documentDefinition.name,
      is_submitted: false,
      file_url: null,
      submitted_at: null,
      remarks: null,
    })
  );

  const { error } = await supabase
    .from('application_documents')
    .upsert(placeholderDocuments, { onConflict: 'application_id,document_type' });

  if (error) {
    throw error;
  }
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
      opening_id,
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
      opening_id: applicationRecord.opening_id ?? null,
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

<<<<<<< HEAD
<<<<<<< HEAD
=======
app.get('/api/benefactors', async (req, res) => {
=======
>>>>>>> 57c5c7debab1a3c3ca63fa03dc989a49f713cd11
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

app.get('/api/renewals/me/current', protect, async (req, res) => {
  try {
    const payload = await ensureCurrentScholarRenewalForUser(req.user.user_id);

    if (!payload.student?.student_id || !payload.scholar?.scholar_id) {
      return res.status(403).json({
        error: 'Only approved scholars can access renewal uploads.',
      });
    }

    if (!payload.period?.period_id) {
      return res.status(400).json({
        error: 'No active academic period is configured for renewals.',
      });
    }

    res.status(200).json(buildScholarRenewalPayload(payload));
  } catch (error) {
    console.error('RENEWAL CURRENT ROUTE ERROR:', error);
    res.status(500).json({
      error: error.message || 'Failed to load current renewal package.',
    });
  }
});

app.post(
  '/api/renewals/me/documents/:documentType/upload',
  protect,
  upload.single('document'),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'A renewal document file is required.' });
      }

      const documentDefinition = normalizeRenewalDocumentType(
        req.params.documentType
      );
      if (!documentDefinition) {
        return res.status(400).json({ error: 'Invalid renewal document type.' });
      }

      const payload = await ensureCurrentScholarRenewalForUser(req.user.user_id);
      if (!payload.student?.student_id || !payload.scholar?.scholar_id || !payload.renewal) {
        return res.status(403).json({
          error: 'Only approved scholars can access renewal uploads.',
        });
      }

      if (
        ['under review', 'approved'].includes(
          normalizeLookupValue(payload.renewal.status)
        )
      ) {
        return res.status(409).json({
          error: 'This renewal package is currently locked while awaiting admin review.',
        });
      }

      const sanitizedOriginalName = file.originalname.replace(/\s+/g, '_');
      const fileName = `${payload.scholar.scholar_id}/${payload.renewal.renewal_id}/${documentDefinition.id}_${Date.now()}_${sanitizedOriginalName}`;
      const { error: storageError } = await supabase.storage
        .from(RENEWAL_UPLOADS_BUCKET)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (storageError) {
        console.error('RENEWAL DOCUMENT UPLOAD ERROR:', storageError);
        return res.status(500).json({
          error:
            storageError.message ||
            `Failed to upload the renewal document to ${RENEWAL_UPLOADS_BUCKET}.`,
        });
      }

      const { data: publicUrlData } = supabase.storage
        .from(RENEWAL_UPLOADS_BUCKET)
        .getPublicUrl(fileName);
      const fileUrl = publicUrlData?.publicUrl ?? null;

      const uploadTimestamp = new Date().toISOString();
      const { error: documentUpdateError } = await supabase
        .from('renewal_documents')
        .update({
          is_submitted: true,
          file_url: fileUrl,
          review_status: 'uploaded',
          admin_comment: null,
          submitted_at: uploadTimestamp,
          reviewed_at: null,
          remarks: `Uploaded from scholar renewal module on ${uploadTimestamp}.`,
        })
        .eq('renewal_id', payload.renewal.renewal_id)
        .eq('document_type', documentDefinition.name);

      if (documentUpdateError) {
        console.error('RENEWAL DOCUMENT SAVE ERROR:', documentUpdateError);
        return res.status(500).json({
          error: documentUpdateError.message || 'Failed to save renewal document.',
        });
      }

      const { data: refreshedDocuments, error: refreshedDocumentsError } = await supabase
        .from('renewal_documents')
        .select('*')
        .eq('renewal_id', payload.renewal.renewal_id);

      if (refreshedDocumentsError) {
        throw refreshedDocumentsError;
      }

      const nextDocumentStatus = deriveScholarRenewalDocumentStatus(
        refreshedDocuments || [],
        'Pending Submission'
      );

      res.status(200).json(
        buildScholarRenewalPayload({
          ...payload,
          renewal: payload.renewal,
          documents: refreshedDocuments || [],
          documentStatus: nextDocumentStatus,
        })
      );
    } catch (error) {
      console.error('RENEWAL DOCUMENT ROUTE ERROR:', error);
      res.status(500).json({
        error: error.message || 'Failed to upload renewal document.',
      });
    }
  }
);

app.post('/api/renewals/me/submit', protect, async (req, res) => {
  try {
    const payload = await ensureCurrentScholarRenewalForUser(req.user.user_id);

    if (!payload.student?.student_id || !payload.scholar?.scholar_id || !payload.renewal) {
      return res.status(403).json({
        error: 'Only approved scholars can access renewal uploads.',
      });
    }

    const normalizedStatus = normalizeLookupValue(payload.renewal.status);
    if (['under review', 'approved'].includes(normalizedStatus)) {
      return res.status(409).json({
        error: 'This renewal package has already been submitted for review.',
      });
    }

    const documents = ensureScholarRenewalDocumentCoverage(payload.documents);
    const missingDocuments = documents.filter(
      (document) => !document.is_submitted || !document.file_url
    );

    if (missingDocuments.length > 0) {
      return res.status(400).json({
        error: `Please upload all required renewal documents first. Missing: ${missingDocuments
          .map((document) => document.document_type)
          .join(', ')}.`,
      });
    }

    const submittedAt = new Date().toISOString();
    const { data: updatedRenewal, error: renewalUpdateError } = await supabase
      .from('renewals')
      .update({
        status: 'Under Review',
        submitted_on: submittedAt,
      })
      .eq('renewal_id', payload.renewal.renewal_id)
      .select('*')
      .single();

    if (renewalUpdateError) {
      throw renewalUpdateError;
    }

    res.status(200).json({
      message: 'Renewal requirements submitted successfully.',
      ...buildScholarRenewalPayload({
        ...payload,
        renewal: updatedRenewal,
        documentStatus: 'Under Review',
      }),
    });
  } catch (error) {
    console.error('RENEWAL SUBMIT ROUTE ERROR:', error);
    res.status(500).json({
      error: error.message || 'Failed to submit renewal requirements.',
    });
  }
});

app.get('/api/openings', protect, async (req, res) => {
  try {
    const openingResult = await supabase
      .from('program_openings')
      .select(`
        opening_id,
        program_id,
        opening_title,
        application_start,
        application_end,
        posting_status,
        announcement_text,
        allocated_slots,
        financial_allocation,
        created_at,
        scholarship_program (
          program_id,
          organization_name,
          program_name
        )
      `)
      .eq('posting_status', 'open')
      .order('created_at', { ascending: false });

    if (openingResult.error) {
      console.error('Openings fetch error:', openingResult.error);
      return res.status(500).json({ error: 'Failed to fetch scholarship openings.' });
    }

    const today = getTodayLocalISO();
    const visibleOpenings = (openingResult.data || []).filter(
      (opening) =>
        (!opening.application_start || opening.application_start <= today) &&
        (!opening.application_end || opening.application_end >= today)
    );

    const { student, studentProfile } = await loadStudentContextByUserId(req.user.user_id);

    let applicationByOpeningId = new Map();
    if (student?.student_id && visibleOpenings.length > 0) {
      const openingIds = visibleOpenings.map((opening) => opening.opening_id);
      const { data: existingApplications, error: applicationError } = await supabase
        .from('applications')
        .select(
          'application_id, opening_id, application_status, document_status, is_disqualified'
        )
        .eq('student_id', student.student_id)
        .in('opening_id', openingIds)
        .eq('is_disqualified', false);

      if (applicationError) {
        console.error('Opening applications fetch error:', applicationError);
        return res.status(500).json({ error: 'Failed to load your application history.' });
      }

      applicationByOpeningId = new Map(
        (existingApplications || []).map((application) => [application.opening_id, application])
      );
    }

    res.status(200).json({
      hasBaseApplicationProfile: !!student?.student_id && !!studentProfile?.student_id,
      items: visibleOpenings.map((opening) => buildOpeningCard(opening, applicationByOpeningId)),
    });
  } catch (error) {
    console.error('Openings route error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch scholarship openings.' });
  }
});

app.post('/api/openings/:openingId/apply', protect, upload.single('indigency'), async (req, res) => {
  try {
    const { openingId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Certificate of Indigency file is required.' });
    }

    const { student, studentProfile } = await loadStudentContextByUserId(req.user.user_id);
    if (!student?.student_id || !studentProfile?.student_id) {
      return res.status(400).json({
        error: 'Please complete your application form first before applying to an opening.',
      });
    }

    const opening = await fetchOpeningWithProgram(openingId);
    const openingAvailabilityError = validateOpeningAvailability(opening);
    if (openingAvailabilityError) {
      return res.status(400).json({ error: openingAvailabilityError });
    }

    const programName = opening.scholarship_program?.program_name || '';
    const isTesOpening = isTesProgramName(programName);

    const { data: existingApplication, error: existingApplicationError } = await supabase
      .from('applications')
      .select('application_id, opening_id, program_id, application_status, document_status')
      .eq('student_id', student.student_id)
      .eq('opening_id', openingId)
      .eq('is_disqualified', false)
      .maybeSingle();

    if (existingApplicationError) {
      console.error('Opening application lookup error:', existingApplicationError);
      return res.status(500).json({ error: 'Failed to check existing application.' });
    }

    if (existingApplication && !isTesOpening) {
      return res.status(409).json({
        error: 'You have already applied to this scholarship opening.',
        code: 'ALREADY_APPLIED',
      });
    }

    let savedApplication = existingApplication;
    if (existingApplication && isTesOpening) {
      const { data: updatedApplication, error: updateError } = await supabase
        .from('applications')
        .update({
          program_id: opening.program_id,
          opening_id: openingId,
          application_status: 'Pending Review',
          submission_date: new Date().toISOString(),
        })
        .eq('application_id', existingApplication.application_id)
        .select('application_id, opening_id, program_id, application_status, document_status')
        .single();

      if (updateError) {
        console.error('TES application update error:', updateError);
        return res.status(500).json({ error: updateError.message || 'Failed to re-apply to opening.' });
      }

      savedApplication = updatedApplication;
    } else if (!existingApplication) {
      const { data: insertedApplication, error: insertError } = await supabase
        .from('applications')
        .insert([
          {
            student_id: student.student_id,
            opening_id: openingId,
            program_id: opening.program_id,
            application_status: 'Pending Review',
            submission_date: new Date().toISOString(),
            document_status: 'Missing Docs',
          },
        ])
        .select('application_id, opening_id, program_id, application_status, document_status')
        .single();

      if (insertError) {
        console.error('Opening application insert error:', insertError);
        return res.status(500).json({ error: insertError.message || 'Failed to apply to opening.' });
      }

      savedApplication = insertedApplication;
    }

    const applicationId = savedApplication.application_id;

    try {
      await ensureApplicationDocumentPlaceholders(
        applicationId,
        student.student_id
      );
    } catch (placeholderDocumentError) {
      console.error(
        'Opening placeholder document error:',
        placeholderDocumentError
      );
      return res.status(500).json({ error: 'Failed to prepare application documents.' });
    }

    const sanitizedOriginalName = file.originalname.replace(/\s+/g, '_');
    const fileName = `${student.student_id}/${applicationId}/certificate_of_indigency_${Date.now()}_${sanitizedOriginalName}`;
    const { error: storageError } = await supabase.storage
      .from(APPLICATION_UPLOADS_BUCKET)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (storageError) {
      console.error('Opening document upload error:', storageError);
      return res.status(500).json({
        error:
          storageError.message ||
          `Failed to upload the certificate of indigency to ${APPLICATION_UPLOADS_BUCKET}.`,
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from(APPLICATION_UPLOADS_BUCKET)
      .getPublicUrl(fileName);
    const fileUrl = publicUrlData?.publicUrl ?? null;

    const { error: documentUpdateError } = await supabase
      .from('application_documents')
      .update({
        is_submitted: true,
        file_url: fileUrl,
        submitted_at: new Date().toISOString(),
        remarks: 'Submitted from opening apply flow.',
      })
      .eq('application_id', applicationId)
      .eq('document_type', 'Certificate of Indigency');

    if (documentUpdateError) {
      console.error('Opening document save error:', documentUpdateError);
      return res.status(500).json({ error: 'Failed to save indigency document.' });
    }

    const { data: savedDocuments, error: savedDocumentsError } = await supabase
      .from('application_documents')
      .select('*')
      .eq('application_id', applicationId);

    if (savedDocumentsError) {
      console.error('Opening documents refresh error:', savedDocumentsError);
      return res.status(500).json({ error: 'Failed to refresh application documents.' });
    }

    const nextDocumentStatus = deriveApplicationDocumentStatus(savedDocuments || []);
    const { error: applicationStatusError } = await supabase
      .from('applications')
      .update({ document_status: nextDocumentStatus })
      .eq('application_id', applicationId);

    if (applicationStatusError) {
      console.error('Opening application status error:', applicationStatusError);
      return res.status(500).json({ error: 'Failed to update application status.' });
    }

    const detailedApplication = await buildApplicationDetails(applicationId);

    res.status(200).json({
      message: existingApplication && isTesOpening
        ? 'TES application re-submitted successfully.'
        : 'Application submitted successfully.',
      is_reapply: !!existingApplication && isTesOpening,
      opening: buildOpeningCard(opening, new Map([[opening.opening_id, { application_id: applicationId }]])),
      application: detailedApplication.application,
      student: detailedApplication.student,
      student_profile: detailedApplication.student_profile,
      family_members: detailedApplication.family_members,
      education_records: detailedApplication.education_records,
      documents: detailedApplication.documents,
    });
  } catch (error) {
    console.error('Opening apply route error:', error);
    res.status(500).json({ error: error.message || 'Failed to apply to scholarship opening.' });
  }
});

app.get('/api/openings/:openingId/application', protect, async (req, res) => {
  try {
    const { openingId } = req.params;
    const { student, studentProfile } = await loadStudentContextByUserId(
      req.user.user_id
    );

    if (!student?.student_id || !studentProfile?.student_id) {
      return res.status(400).json({
        error:
          'Please complete your application form first before continuing this opening application.',
      });
    }

    const opening = await fetchOpeningWithProgram(openingId);
    if (!opening) {
      return res.status(404).json({ error: 'Scholarship opening not found.' });
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select(
        'application_id, opening_id, program_id, application_status, document_status'
      )
      .eq('student_id', student.student_id)
      .eq('opening_id', openingId)
      .eq('is_disqualified', false)
      .maybeSingle();

    if (applicationError) {
      console.error('Opening application detail lookup error:', applicationError);
      return res.status(500).json({
        error: 'Failed to load your scholarship opening application.',
      });
    }

    if (!application?.application_id) {
      return res.status(404).json({
        error:
          'No application was found for this scholarship opening yet. Please use Apply Now first.',
      });
    }

    try {
      await ensureApplicationDocumentPlaceholders(
        application.application_id,
        student.student_id
      );
    } catch (placeholderDocumentError) {
      console.error(
        'Opening application placeholder refresh error:',
        placeholderDocumentError
      );
      return res.status(500).json({
        error: 'Failed to prepare your scholarship requirements.',
      });
    }

    const detailedApplication = await buildApplicationDetails(
      application.application_id
    );

    return res.status(200).json({
      opening: buildOpeningCard(
        opening,
        new Map([[opening.opening_id, application]])
      ),
      application: detailedApplication.application,
      student: detailedApplication.student,
      student_profile: detailedApplication.student_profile,
      family_members: detailedApplication.family_members,
      education_records: detailedApplication.education_records,
      documents: detailedApplication.documents,
    });
  } catch (error) {
    console.error('Opening application detail route error:', error);
    return res.status(500).json({
      error:
        error.message || 'Failed to load the scholarship opening application.',
    });
  }
});

app.post(
  '/api/openings/:openingId/documents/:documentType/upload',
  protect,
  upload.single('document'),
  async (req, res) => {
    try {
      const { openingId, documentType } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'A document file is required.' });
      }

      const documentDefinition =
        normalizeApplicationDocumentDefinition(documentType);
      if (!documentDefinition) {
        return res
          .status(400)
          .json({ error: 'Unsupported scholarship requirement selected.' });
      }

      const { student, studentProfile } = await loadStudentContextByUserId(
        req.user.user_id
      );
      if (!student?.student_id || !studentProfile?.student_id) {
        return res.status(400).json({
          error:
            'Please complete your application form first before continuing this opening application.',
        });
      }

      const opening = await fetchOpeningWithProgram(openingId);
      if (!opening) {
        return res.status(404).json({ error: 'Scholarship opening not found.' });
      }

      const { data: application, error: applicationError } = await supabase
        .from('applications')
        .select(
          'application_id, opening_id, program_id, application_status, document_status'
        )
        .eq('student_id', student.student_id)
        .eq('opening_id', openingId)
        .eq('is_disqualified', false)
        .maybeSingle();

      if (applicationError) {
        console.error('Opening document upload lookup error:', applicationError);
        return res.status(500).json({
          error: 'Failed to load the target opening application.',
        });
      }

      if (!application?.application_id) {
        return res.status(404).json({
          error:
            'No application was found for this scholarship opening yet. Please use Apply Now first.',
        });
      }

      try {
        await ensureApplicationDocumentPlaceholders(
          application.application_id,
          student.student_id
        );
      } catch (placeholderDocumentError) {
        console.error(
          'Opening document placeholder refresh error:',
          placeholderDocumentError
        );
        return res.status(500).json({
          error: 'Failed to prepare your scholarship requirements.',
        });
      }

      const sanitizedOriginalName = file.originalname.replace(/\s+/g, '_');
      const fileName = `${student.student_id}/${application.application_id}/${documentDefinition.id}_${Date.now()}_${sanitizedOriginalName}`;
      const { error: storageError } = await supabase.storage
        .from(APPLICATION_UPLOADS_BUCKET)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (storageError) {
        console.error('Opening requirement upload error:', storageError);
        return res.status(500).json({
          error:
            storageError.message ||
            `Failed to upload the document to ${APPLICATION_UPLOADS_BUCKET}.`,
        });
      }

      const { data: publicUrlData } = supabase.storage
        .from(APPLICATION_UPLOADS_BUCKET)
        .getPublicUrl(fileName);
      const fileUrl = publicUrlData?.publicUrl ?? null;

      const { error: documentUpdateError } = await supabase
        .from('application_documents')
        .update({
          is_submitted: true,
          file_url: fileUrl,
          submitted_at: new Date().toISOString(),
          remarks: 'Uploaded from scholarship opening requirements.',
        })
        .eq('application_id', application.application_id)
        .eq('document_type', documentDefinition.name);

      if (documentUpdateError) {
        console.error(
          'Opening requirement document save error:',
          documentUpdateError
        );
        return res.status(500).json({
          error: 'Failed to save the uploaded scholarship requirement.',
        });
      }

      const { data: savedDocuments, error: savedDocumentsError } = await supabase
        .from('application_documents')
        .select('*')
        .eq('application_id', application.application_id);

      if (savedDocumentsError) {
        console.error(
          'Opening requirement documents refresh error:',
          savedDocumentsError
        );
        return res.status(500).json({
          error: 'Failed to refresh the scholarship requirements.',
        });
      }

      const nextDocumentStatus = deriveApplicationDocumentStatus(
        savedDocuments || []
      );
      const { error: applicationStatusError } = await supabase
        .from('applications')
        .update({ document_status: nextDocumentStatus })
        .eq('application_id', application.application_id);

      if (applicationStatusError) {
        console.error(
          'Opening requirement application status error:',
          applicationStatusError
        );
        return res.status(500).json({
          error: 'Failed to update your scholarship document status.',
        });
      }

      const detailedApplication = await buildApplicationDetails(
        application.application_id
      );

      return res.status(200).json({
        message: `${documentDefinition.name} uploaded successfully.`,
        opening: buildOpeningCard(
          opening,
          new Map([
            [
              opening.opening_id,
              {
                ...application,
                document_status: nextDocumentStatus,
              },
            ],
          ])
        ),
        application: detailedApplication.application,
        student: detailedApplication.student,
        student_profile: detailedApplication.student_profile,
        family_members: detailedApplication.family_members,
        education_records: detailedApplication.education_records,
        documents: detailedApplication.documents,
      });
    } catch (error) {
      console.error('Opening requirement upload route error:', error);
      return res.status(500).json({
        error:
          error.message ||
          'Failed to upload the scholarship opening requirement.',
      });
    }
  }
);

app.get('/api/scholarship-programs', async (req, res) => {
<<<<<<< HEAD
=======
app.get('/api/benefactors', async (req, res) => {
>>>>>>> 567d41ff (fixed)
=======
>>>>>>> ad108ed3d1f33af68bd48179113950f8ff0f5b75
>>>>>>> 57c5c7debab1a3c3ca63fa03dc989a49f713cd11
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

  if (
    academic.student_number &&
    academic.student_number.trim() &&
    academic.student_number.trim() !== account.student_id
  ) {
    return res.status(400).json({ error: 'Student number must match the logged-in student ID.' });
  }

  if (application.program_id) {
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
  const isProgramSpecificSubmission = !!application.program_id;

  let existingApplicationQuery = supabase
    .from('applications')
    .select('application_id, application_status, document_status, evaluator_id')
    .eq('student_id', studentRecord.student_id)
    .in('application_status', ['Pending Review', 'Interview', 'Review'])
    .eq('is_disqualified', false);

  if (isProgramSpecificSubmission) {
    existingApplicationQuery = existingApplicationQuery.eq(
      'program_id',
      application.program_id
    );
  } else {
    existingApplicationQuery = existingApplicationQuery
      .is('program_id', null)
      .is('opening_id', null);
  }

  const { data: existingApplication, error: existingApplicationError } =
    await existingApplicationQuery.maybeSingle();

  if (existingApplicationError) {
    console.error('Existing application lookup error:', existingApplicationError);
    return res.status(500).json({ error: 'Failed to load existing application.' });
  }

  if (existingApplication) {
    const { data: updatedApplication, error: updateError } = await supabase
      .from('applications')
      .update({
        student_id: studentRecord.student_id,
        program_id: application.program_id ?? null,
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
        program_id: application.program_id ?? null,
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
    const placeholderDocuments = APPLICATION_DOCUMENT_DEFINITIONS.map((documentDefinition) => ({
      application_id: applicationId,
      student_id: studentRecord.student_id,
      document_type: documentDefinition.name,
      is_submitted: false,
      file_url: null,
      submitted_at: null,
      remarks: null,
    }));

    const { error: placeholderDocumentError } = await supabase
      .from('application_documents')
      .upsert(placeholderDocuments, { onConflict: 'application_id,document_type' });

    if (placeholderDocumentError) {
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

      const { data: savedDocuments, error: savedDocumentsError } = await supabase
        .from('application_documents')
        .select('*')
        .eq('application_id', applicationId);

      if (savedDocumentsError) {
        console.error('Application documents fetch error:', savedDocumentsError);
        return res.status(500).json({ error: savedDocumentsError.message || 'Failed to refresh application documents.' });
      }

      const nextDocumentStatus = deriveApplicationDocumentStatus(savedDocuments || []);
      const { error: applicationStatusError } = await supabase
        .from('applications')
        .update({ document_status: nextDocumentStatus })
        .eq('application_id', applicationId);

      if (applicationStatusError) {
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
    message: 'Application submitted successfully.',
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
  if (socket.user?.user_id) {
    socket.join(`user:${socket.user.user_id}`);
  }

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

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
