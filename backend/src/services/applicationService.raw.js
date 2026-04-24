// Extracted application submission/details helpers
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

function normalizeStudentProfileSex(value) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) {
    return null;
  }

  const lookup = {
    m: 'Male',
    male: 'Male',
    f: 'Female',
    female: 'Female',
    'prefer not to say': 'Prefer not to say',
    other: 'Other',
  };

  return lookup[normalized] || normalizeNullableText(value);
}

function normalizeBoolean(value) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = normalizeLookupValue(value);
  if (!normalized) {
    return null;
  }

  if (['true', 'yes', '1', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', 'no', '0', 'n'].includes(normalized)) {
    return false;
  }

  return null;
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
      rejection_reason,
      evaluator_id,
      students (
        user_id,
        first_name,
        middle_name,
        last_name,
        pdm_id,
        gwa,
        year_level,
        course_id
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
      rejection_reason: applicationRecord.rejection_reason,
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

  const normalizedCourseCode = normalizeLookupValue(courseCode);
  const { data: courseData, error: courseError } = await supabase
    .from('academic_course')
    .select('course_id, course_code, course_name, is_archived')
    .eq('is_archived', false);

  if (courseError) {
    throw courseError;
  }

  const matchingCourse = (courseData || []).find((course) => {
    if (course.is_archived) {
      return false;
    }

    const courseCodeValue = normalizeLookupValue(course.course_code);
    const courseNameValue = normalizeLookupValue(course.course_name);
    const courseIdValue = normalizeLookupValue(course.course_id);

    return (
      courseIdValue === normalizedCourseCode ||
      courseCodeValue === normalizedCourseCode ||
      courseNameValue === normalizedCourseCode
    );
  });

  if (!matchingCourse) {
    const error = new Error('Selected course is invalid.');
    error.statusCode = 400;
    throw error;
  }

  return matchingCourse.course_id;
}

async function resolveCourseById(courseId) {
  if (!courseId) {
    return null;
  }

  const normalizedCourseId = String(courseId).trim();
  if (!normalizedCourseId) {
    return null;
  }

  const { data, error } = await supabase
    .from('academic_course')
    .select('course_id, course_code, course_name, is_archived')
    .eq('course_id', normalizedCourseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.is_archived) {
    return null;
  }

  return data;
}

function normalizeStudentNumber(value = '') {
  return String(value || '').trim().toUpperCase();
}

function normalizeYearLevel(value) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  const match = text.match(/\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0], 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 6) {
    return null;
  }

  return parsed;
}

function buildRegistrarStudentRecord(row = {}) {
  return {
    pdm_id: normalizeStudentNumber(row.pdm_id || row.student_number),
    learners_reference_number: String(row.learners_reference_number || '').trim() || null,
    last_name: String(row.last_name || '').trim() || null,
    first_name: String(row.first_name || '').trim() || null,
    middle_name: String(row.middle_name || row.middle_initial || '').trim() || null,
    course_id: String(row.course_id || row.course_code || row.degree_program || '').trim() || null,
    year_level: normalizeYearLevel(row.year_level),
    gwa: row.gwa ?? null,
    profile_photo_url: String(row.profile_photo_url || '').trim() || null,
    is_active_scholar: normalizeBoolean(row.is_active_scholar) ?? false,
    account_status: String(row.account_status || 'Pending').trim() || 'Pending',
    sdo_status: String(row.sdo_status || 'Clear').trim() || 'Clear',
    is_archived: normalizeBoolean(row.is_archived) ?? false,
    sex_at_birth: String(row.sex_at_birth || '').trim() || null,
    email_address: String(row.email_address || '').trim().toLowerCase() || null,
    phone_number: String(row.phone_number || '').trim() || null,
    source_filename: String(row.source_filename || '').trim() || null,
    source_row_number: row.source_row_number ?? null,
  };
}

async function resolveRegistrarStudentByStudentNumber(studentNumber) {
  const normalizedStudentNumber = normalizeStudentNumber(studentNumber);
  if (!normalizedStudentNumber) {
    return null;
  }

  const { data, error } = await supabase
    .from(STUDENT_REGISTRY_TABLE)
    .select(`
      registry_id,
      student_number,
      learners_reference_number,
      last_name,
      given_name,
      middle_name,
      course_id,
      year_level,
      sex_at_birth,
      email_address,
      phone_number,
      sequence_number,
      imported_at,
      is_archived
    `)
    .eq('student_number', normalizedStudentNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    data.first_name = data.given_name;
  }

  return data || null;
}

async function resolveStudentEligibilityByStudentNumber(studentNumber) {
  const registryStudent = await resolveRegistrarStudentByStudentNumber(studentNumber);

  if (!registryStudent) {
    return {
      isRegistrarMatch: false,
      hasApplication: false,
      hasScholarAccess: false,
      status: 'non-PDM / not registered',
      registryStudent: null,
      studentRecord: null,
      scholarRecord: null,
    };
  }

  const studentNumberValue = normalizeStudentNumber(registryStudent.student_number);
  const { data: studentRecord, error: studentError } = await supabase
    .from('students')
    .select('student_id, user_id, pdm_id')
    .eq('pdm_id', studentNumberValue)
    .maybeSingle();

  if (studentError) {
    throw studentError;
  }

  if (!studentRecord?.student_id) {
    return {
      isRegistrarMatch: true,
      hasApplication: false,
      hasScholarAccess: false,
      status: 'eligible student',
      registryStudent,
      studentRecord: null,
      scholarRecord: null,
    };
  }

  const scholarRecord = await resolveScholarRecordForStudent(studentRecord.student_id);
  const { data: applicationRecords, error: applicationError } = await supabase
    .from('applications')
    .select('application_id, application_status, is_disqualified')
    .eq('student_id', studentRecord.student_id);

  if (applicationError) {
    throw applicationError;
  }

  const hasApplication = (applicationRecords || []).length > 0;
  const hasScholarAccess = !!scholarRecord;
  const status = hasScholarAccess
    ? 'existing scholar'
    : hasApplication
      ? 'applicant'
      : 'eligible student';

  return {
    isRegistrarMatch: true,
    hasApplication,
    hasScholarAccess,
    status,
    registryStudent,
    studentRecord,
    scholarRecord,
  };
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

  const registrarStudent = await resolveRegistrarStudentByStudentNumber(
    account.student_id
  );

  if (!registrarStudent) {
    const error = new Error(
      'Student ID is not registered in the registrar records.'
    );
    error.statusCode = 403;
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

  const courseId = await resolveCourseIdByCode(
    academic.current_course_code || registrarStudent.course_id
  );
  const derivedFirstName = String(
    personal.first_name || registrarStudent.first_name || ''
  ).trim();
  const derivedLastName = String(
    personal.last_name || registrarStudent.last_name || ''
  ).trim();
  const derivedMiddleName = personal.middle_name
    ? String(personal.middle_name).trim()
    : registrarStudent.middle_name
      ? String(registrarStudent.middle_name).trim()
      : null;
  const derivedYearLevel =
    academic.current_year_level ?? registrarStudent.year_level ?? null;

  const studentPayload = {
    user_id: account.user_id,
    pdm_id: account.student_id,
    first_name: derivedFirstName,
    middle_name: derivedMiddleName,
    last_name: derivedLastName,
    year_level: derivedYearLevel,
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
    sex: normalizeStudentProfileSex(
      personal.sex ?? registrarStudent.sex_at_birth ?? null
    ),
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
    learners_reference_number:
      academic.lrn ?? registrarStudent.learners_reference_number ?? null,
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

  const userRecord = await resolveUserAccountRecord(userId);
  const studentRecord = await resolveStudentByUserId(userId);
  const studentNumber =
    studentRecord?.pdm_id || userRecord?.username || '';
  const registrarStudent = await resolveRegistrarStudentByStudentNumber(
    studentNumber
  );

  if (!registrarStudent) {
    throw createHttpError(
      403,
      'This account is not registered in the registrar records.'
    );
  }

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

  const normalizedPayload = {
    ...incomingPayload,
    account: {
      ...(incomingPayload.account ?? {}),
      user_id: userId,
      student_id: incomingPayload.account?.student_id || userRecord?.username || '',
      email:
        incomingPayload.account?.email ||
        userRecord?.email ||
        registrarStudent.email_address ||
        '',
    },
    contact: {
      ...(incomingPayload.contact ?? {}),
      email:
        incomingPayload.contact?.email ||
        incomingPayload.account?.email ||
        userRecord?.email ||
        registrarStudent.email_address ||
        '',
      mobile_number:
        incomingPayload.contact?.mobile_number ||
        userRecord?.phone_number ||
        registrarStudent.phone_number ||
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

