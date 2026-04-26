const supabase = require('../config/supabase');

const APPLICATION_DRAFT_TABLE = 'application_form_drafts';

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function firstNonEmpty(...values) {
    for (const value of values) {
        const text = safeText(value);
        if (text) return text;
    }
    return '';
}

function normalizeFamilyRelation(value) {
    const text = safeText(value).toLowerCase();

    if (text === 'father') return 'Father';
    if (text === 'mother') return 'Mother';
    if (text === 'guardian') return 'Guardian';
    if (text === 'sibling') return 'Sibling';

    return safeText(value);
}

function splitFamilyName(row = {}) {
    return [
        safeText(row.first_name),
        safeText(row.middle_name),
        safeText(row.last_name),
    ]
        .filter(Boolean)
        .join(' ');
}

function mapFamilyMember(row = {}, fallbackRelation = '') {
    return {
        relation: safeText(row.relation || fallbackRelation),
        full_name: splitFamilyName(row),
        first_name: safeText(row.first_name),
        middle_name: safeText(row.middle_name),
        last_name: safeText(row.last_name),
        mobile: safeText(row.mobile_number || row.mobile),
        mobile_number: safeText(row.mobile_number || row.mobile),
        address: safeText(row.address),
        occupation: safeText(row.occupation),
        educational_attainment: safeText(
            row.highest_educational_attainment || row.educational_attainment
        ),
        highest_educational_attainment: safeText(
            row.highest_educational_attainment || row.educational_attainment
        ),
        company_name_and_address: safeText(
            row.company_name_address || row.company_name_and_address
        ),
        company_name_address: safeText(
            row.company_name_address || row.company_name_and_address
        ),
    };
}

async function getUser(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('user_id, username, email, phone_number, role')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

async function getStudent(userId) {
    const { data, error } = await supabase
        .from('students')
        .select(`
      student_id,
      master_student_id,
      user_id,
      pdm_id,
      registrar_student_number,
      learners_reference_number,
      course_id,
      first_name,
      middle_name,
      last_name,
      year_level,
      gwa,
      sex_at_birth,
      email_address,
      phone_number,
      sequence_number,
      is_profile_complete,
      is_active_scholar,
      scholarship_status
    `)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

async function getMasterStudent(masterStudentId) {
    if (!masterStudentId) return null;

    const { data, error } = await supabase
        .from('student_master_records')
        .select(`
  master_student_id,
  student_number,
  pdm_id,
  learners_reference_number,
  first_name,
  middle_name,
  last_name,
  sex_at_birth,
  religion,
  email_address,
  phone_number,
  course_id,
  year_level,
  sequence_number
`)
        .eq('master_student_id', masterStudentId)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

async function getStudentProfile(studentId) {
    if (!studentId) return null;

    const { data, error } = await supabase
        .from('student_profiles')
        .select(`
      profile_id,
      student_id,
      date_of_birth,
      place_of_birth,
      civil_status,
      maiden_name,
      religion,
      citizenship,
      street_address,
      subdivision,
      barangay,
      city,
      province,
      zip_code,
      landline_number,
      financial_support_type,
      financial_support_other,
      has_prior_scholarship,
      prior_scholarship_details,
      has_disciplinary_record,
      disciplinary_details,
      self_description,
      aims_and_ambitions
    `)
        .eq('student_id', studentId)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

async function getCourse(courseId) {
    if (!courseId) return null;

    const { data, error } = await supabase
        .from('academic_course')
        .select('course_id, course_code, course_name')
        .eq('course_id', courseId)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

async function getFamilyRows(studentId) {
    if (!studentId) return [];

    const { data, error } = await supabase
        .from('student_family')
        .select('*')
        .eq('student_id', studentId);

    if (error) {
        const message = String(error.message || '').toLowerCase();

        if (
            error.code === 'PGRST205' ||
            error.code === '42P01' ||
            message.includes('could not find the table') ||
            message.includes('does not exist')
        ) {
            return [];
        }

        throw error;
    }

    return data || [];
}

async function getEducationRows(studentId) {
    if (!studentId) return [];

    const { data, error } = await supabase
        .from('student_education')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

    if (error) {
        const message = String(error.message || '').toLowerCase();

        if (
            error.code === 'PGRST205' ||
            error.code === '42P01' ||
            message.includes('could not find the table') ||
            message.includes('does not exist')
        ) {
            return [];
        }

        throw error;
    }

    return data || [];
}

async function getDraft(userId) {
    const { data, error } = await supabase
        .from(APPLICATION_DRAFT_TABLE)
        .select('draft_id, user_id, opening_id, payload, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        const message = String(error.message || '').toLowerCase();

        if (
            error.code === 'PGRST205' ||
            error.code === '42P01' ||
            message.includes('could not find the table') ||
            message.includes('does not exist')
        ) {
            return null;
        }

        throw error;
    }

    return data || null;
}

async function getOpening(openingId) {
    if (!openingId) return null;

    const { data, error } = await supabase
        .from('program_openings')
        .select(`
      opening_id,
      opening_title,
      program_id,
      scholarship_program (
        program_id,
        program_name
      )
    `)
        .eq('opening_id', openingId)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

async function getMyFormData(userId) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const user = await getUser(userId);
    if (!user) {
        throw createHttpError(404, 'User account not found.');
    }

    const student = await getStudent(userId);
    const draft = await getDraft(userId);
    const draftPayload = draft?.payload && typeof draft.payload === 'object'
        ? draft.payload
        : {};

    if (!student) {
        return {
            has_saved_form: !!draft,
            opening: draftPayload.opening || {},
            account: {
                user_id: user.user_id,
                student_id: user.username || '',
                student_uuid: '',
            },
            personal: draftPayload.personal || {},
            address: draftPayload.address || {},
            contact: {
                ...(draftPayload.contact || {}),
                email: draftPayload.contact?.email || user.email || '',
                mobile_number:
                    draftPayload.contact?.mobile_number || user.phone_number || '',
            },
            family: draftPayload.family || {
                father: {},
                mother: {},
                sibling: {},
                guardian: {},
            },
            academic: draftPayload.academic || {
                student_number: user.username || '',
            },
            support: draftPayload.support || {},
            discipline: draftPayload.discipline || {},
            essays: draftPayload.essays || {},
            certification: draftPayload.certification || {},
        };
    }

    const [master, profile, course, familyRows, educationRows, opening] =
        await Promise.all([
            getMasterStudent(student.master_student_id),
            getStudentProfile(student.student_id),
            getCourse(student.course_id),
            getFamilyRows(student.student_id),
            getEducationRows(student.student_id),
            getOpening(draft?.opening_id || draftPayload.opening?.opening_id),
        ]);

    const father =
        familyRows.find((row) => normalizeFamilyRelation(row.relation) === 'Father') ||
        {};
    const mother =
        familyRows.find((row) => normalizeFamilyRelation(row.relation) === 'Mother') ||
        {};
    const sibling =
        familyRows.find((row) => normalizeFamilyRelation(row.relation) === 'Sibling') ||
        {};
    const guardian =
        familyRows.find((row) => normalizeFamilyRelation(row.relation) === 'Guardian') ||
        {};

    const latestEducation = educationRows[0] || {};

    const firstName = firstNonEmpty(master?.first_name, student.first_name);
    const middleName = firstNonEmpty(master?.middle_name, student.middle_name);
    const lastName = firstNonEmpty(master?.last_name, student.last_name);

    const studentNumber = firstNonEmpty(
        student.pdm_id,
        student.registrar_student_number,
        master?.student_number,
        master?.pdm_id,
        user.username
    );

    const email = firstNonEmpty(
        master?.email_address,
        student.email_address,
        user.email
    );

    const phoneNumber = firstNonEmpty(
        master?.phone_number,
        student.phone_number,
        user.phone_number
    );

    const basePayload = {
        has_saved_form: !!draft,
        opening: opening
            ? {
                opening_id: opening.opening_id,
                opening_title: opening.opening_title || '',
                program_name: opening.scholarship_program?.program_name || '',
            }
            : draftPayload.opening || {},

        account: {
            user_id: user.user_id,
            student_id: studentNumber,
            student_uuid: student.student_id,
        },

        personal: {
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            maiden_name: safeText(profile?.maiden_name),
            age: '',
            date_of_birth: profile?.date_of_birth || '',
            sex: firstNonEmpty(student.sex_at_birth, master?.sex_at_birth),
            place_of_birth: safeText(profile?.place_of_birth),
            citizenship: firstNonEmpty(profile?.citizenship, 'Filipino'),
            civil_status: safeText(profile?.civil_status),
            religion: firstNonEmpty(
                profile?.religion,
                master?.religion,
                student.religion
            ),
        },

        address: {
            street: safeText(profile?.street_address),
            subdivision: safeText(profile?.subdivision),
            barangay: safeText(profile?.barangay),
            city_municipality: safeText(profile?.city),
            province: safeText(profile?.province),
            zip_code: safeText(profile?.zip_code),
        },

        contact: {
            landline: safeText(profile?.landline_number),
            mobile_number: phoneNumber,
            email,
        },

        family: {
            parent_guardian_address:
                draftPayload.family?.parent_guardian_address || '',

            same_address_as_applicant:
                draftPayload.family?.same_address_as_applicant === true,

            father_present:
                draftPayload.family?.father_present !== false, // default true

            mother_present:
                draftPayload.family?.mother_present !== false, // default true

            guardian_only:
                draftPayload.family?.guardian_only === true,

            father: mapFamilyMember(father, 'Father'),
            mother: mapFamilyMember(mother, 'Mother'),
            sibling: mapFamilyMember(sibling, 'Sibling'),
            guardian: mapFamilyMember(guardian, 'Guardian'),
        },
        academic: {
            current_course: safeText(course?.course_code),
            current_course_code: safeText(course?.course_code),
            current_course_name: safeText(course?.course_name),
            current_year_level: String(firstNonEmpty(master?.year_level, student.year_level)),
            year_level: String(firstNonEmpty(master?.year_level, student.year_level)),
            student_number: studentNumber,
            lrn: firstNonEmpty(
                student.learners_reference_number,
                master?.learners_reference_number
            ),
            gwa:
                student.gwa === null || student.gwa === undefined
                    ? ''
                    : String(student.gwa),
            college_school: safeText(latestEducation.college_school),
            college_address: safeText(latestEducation.college_address),
            college_honors: safeText(latestEducation.college_honors),
            college_club: safeText(latestEducation.college_club),
            college_year_graduated: safeText(latestEducation.college_year_graduated),
            high_school_school: safeText(latestEducation.high_school_school),
            high_school_address: safeText(latestEducation.high_school_address),
            high_school_honors: safeText(latestEducation.high_school_honors),
            high_school_club: safeText(latestEducation.high_school_club),
            high_school_year_graduated: safeText(
                latestEducation.high_school_year_graduated
            ),
            senior_high_school: safeText(latestEducation.senior_high_school),
            senior_high_address: safeText(latestEducation.senior_high_address),
            senior_high_honors: safeText(latestEducation.senior_high_honors),
            senior_high_club: safeText(latestEducation.senior_high_club),
            senior_high_year_graduated: safeText(
                latestEducation.senior_high_year_graduated
            ),
            elementary_school: safeText(latestEducation.elementary_school),
            elementary_address: safeText(latestEducation.elementary_address),
            elementary_honors: safeText(latestEducation.elementary_honors),
            elementary_club: safeText(latestEducation.elementary_club),
            elementary_year_graduated: safeText(
                latestEducation.elementary_year_graduated
            ),
            current_section: safeText(latestEducation.current_section),
        },

        support: {
            financial_support:
                safeText(profile?.financial_support_type) || 'Parents',
            financial_support_type: safeText(profile?.financial_support_type),
            financial_support_other: safeText(profile?.financial_support_other),
            scholarship_history: profile?.has_prior_scholarship === true,
            has_prior_scholarship: profile?.has_prior_scholarship === true,
            scholarship_details: safeText(profile?.prior_scholarship_details),
            prior_scholarship_details: safeText(profile?.prior_scholarship_details),
            scholarship_others_specify: safeText(profile?.financial_support_other),
        },

        discipline: {
            disciplinary_action: profile?.has_disciplinary_record === true,
            has_disciplinary_record: profile?.has_disciplinary_record === true,
            disciplinary_explanation: safeText(profile?.disciplinary_details),
            disciplinary_details: safeText(profile?.disciplinary_details),
        },

        essays: {
            describe_yourself_essay: safeText(profile?.self_description),
            self_description: safeText(profile?.self_description),
            aims_and_ambition_essay: safeText(profile?.aims_and_ambitions),
            aims_and_ambitions: safeText(profile?.aims_and_ambitions),
        },

        certification: {
            certification_read: false,
            agree: false,
        },
    };

    if (!draftPayload || Object.keys(draftPayload).length === 0) {
        return basePayload;
    }

    return {
        ...basePayload,
        ...draftPayload,
        has_saved_form: !!draft,

        account: {
            ...basePayload.account,
            ...(draftPayload.account || {}),
        },
        personal: {
            ...basePayload.personal,
            ...(draftPayload.personal || {}),
        },
        address: {
            ...basePayload.address,
            ...(draftPayload.address || {}),
        },
        contact: {
            ...basePayload.contact,
            ...(draftPayload.contact || {}),
        },
        family: {
            ...basePayload.family,
            ...(draftPayload.family || {}),
        },
        academic: {
            ...basePayload.academic,
            ...(draftPayload.academic || {}),
        },
        support: {
            ...basePayload.support,
            ...(draftPayload.support || {}),
        },
        discipline: {
            ...basePayload.discipline,
            ...(draftPayload.discipline || {}),
        },
        essays: {
            ...basePayload.essays,
            ...(draftPayload.essays || {}),
        },
        certification: {
            ...basePayload.certification,
            ...(draftPayload.certification || {}),
        },
    };
}

async function saveMyFormData(userId, payload = {}) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const openingId =
        safeText(payload.opening_id) ||
        safeText(payload.openingId) ||
        safeText(payload.opening?.opening_id) ||
        null;

    const draftPayload = {
        opening: payload.opening || {},
        account: payload.account || {},
        personal: payload.personal || {},
        address: payload.address || {},
        contact: payload.contact || {},
        family: payload.family || {},
        academic: payload.academic || {},
        support: payload.support || {},
        discipline: payload.discipline || {},
        essays: payload.essays || {},
        certification: payload.certification || {},
    };

    const { data, error } = await supabase
        .from(APPLICATION_DRAFT_TABLE)
        .upsert(
            {
                user_id: userId,
                opening_id: openingId,
                payload: draftPayload,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
        )
        .select('draft_id, user_id, opening_id, payload, created_at, updated_at')
        .single();

    if (error) throw error;

    return {
        message: 'Application form draft saved.',
        draft: data,
    };
}

async function getMyDocuments(userId) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const student = await getStudent(userId);

    if (!student?.student_id) {
        return {
            hasApplication: false,
            application: null,
            documents: [],
            message: 'Submit an application first.',
        };
    }

    const { data: applications, error: appError } = await supabase
        .from('applications')
        .select(`
      application_id,
      student_id,
      opening_id,
      program_id,
      application_status,
      document_status,
      verification_status,
      submission_date,
      created_at
    `)
        .eq('student_id', student.student_id)
        .order('submission_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(1);

    if (appError) throw appError;

    const application =
        Array.isArray(applications) && applications.length > 0
            ? applications[0]
            : null;

    if (!application) {
        return {
            hasApplication: false,
            application: null,
            documents: [],
            message: 'Submit an application first.',
        };
    }

    const requiredDocuments = [
        'Certificate of Registration',
        'Certificate of Indigency',
        'Grade Report',
        'Letter of Request',
    ];

    const { data: existingDocuments, error: existingDocsError } = await supabase
        .from('application_documents')
        .select(`
      document_id,
      application_id,
      document_type,
      is_submitted,
      file_url,
      file_name,
      file_path,
      source_type,
      notes,
      remarks,
      review_status,
      submitted_at,
      created_at,
      updated_at
    `)
        .eq('application_id', application.application_id);

    if (existingDocsError) throw existingDocsError;

    const existingTypes = new Set(
        (existingDocuments || []).map((doc) =>
            String(doc.document_type || '').trim().toLowerCase()
        )
    );

    const missingDocuments = requiredDocuments
        .filter((type) => !existingTypes.has(type.toLowerCase()))
        .map((type) => ({
            application_id: application.application_id,
            uploaded_by: student.student_id,
            document_type: type,
            is_submitted: false,
            review_status: 'pending',
            source_type: 'upload',
            remarks: null,
            notes: null,
        }));

    if (missingDocuments.length > 0) {
        const { error: insertDocsError } = await supabase
            .from('application_documents')
            .insert(missingDocuments);

        if (insertDocsError) throw insertDocsError;
    }

    const { data: documents, error: docsError } = await supabase
        .from('application_documents')
        .select(`
      document_id,
      application_id,
      document_type,
      is_submitted,
      file_url,
      file_name,
      file_path,
      source_type,
      notes,
      remarks,
      review_status,
      submitted_at,
      created_at,
      updated_at
    `)
        .eq('application_id', application.application_id)
        .in('document_type', requiredDocuments)
        .order('created_at', { ascending: true });

    if (docsError) throw docsError;

    const uploadedCount = (documents || []).filter(
        (doc) => doc.is_submitted === true
    ).length;

    return {
        hasApplication: true,
        contextTitle: 'Scholarship Requirements',
        programName: 'Current Application',
        applicationStatus: application.application_status || 'Pending Review',
        documentStatus:
            uploadedCount >= requiredDocuments.length
                ? 'Documents Ready'
                : 'Missing Docs',
        uploadedCount,
        allRequiredUploaded: uploadedCount >= requiredDocuments.length,
        application,
        documents: documents || [],
    };
}

async function uploadMyDocument(userId, file, body = {}, params = {}) {
    if (!userId) throw createHttpError(401, 'Authentication required.');
    if (!file) throw createHttpError(400, 'File is required.');

    const documentId = params.documentId || null;

    if (!documentId) {
        throw createHttpError(400, 'Document ID is required.');
    }

    const student = await getStudent(userId);

    if (!student?.student_id) {
        throw createHttpError(400, 'Student not found.');
    }

    const allowedExtensions = new Set([
        'pdf',
        'doc',
        'docx',
        'jpg',
        'jpeg',
        'png',
        'webp',
        'heic',
        'heif',
    ]);

    const originalName = file.originalname || '';
    const extension = originalName.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.has(extension)) {
        throw createHttpError(
            400,
            'Invalid file type. Allowed files: PDF, DOC, DOCX, JPG, JPEG, PNG, WEBP, HEIC, HEIF.'
        );
    }

    const { data: targetDocument, error: targetDocumentError } = await supabase
        .from('application_documents')
        .select('document_id, application_id, document_type')
        .eq('document_id', documentId)
        .maybeSingle();

    if (targetDocumentError) throw targetDocumentError;

    if (!targetDocument) {
        throw createHttpError(404, 'Document slot not found.');
    }

    const { data: application, error: appError } = await supabase
        .from('applications')
        .select('application_id, student_id, opening_id, program_id')
        .eq('application_id', targetDocument.application_id)
        .eq('student_id', student.student_id)
        .maybeSingle();

    if (appError) throw appError;

    if (!application) {
        throw createHttpError(403, 'You are not allowed to upload to this document.');
    }

    const normalizedType = normalizeRequiredDocumentType(targetDocument.document_type);
    const safeFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');

    const filePath = `applications/${application.application_id}/${normalizedType.replace(
        /[^a-zA-Z0-9]/g,
        '_'
    )}_${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file.buffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: true,
        });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

    const fileUrl = publicUrlData?.publicUrl || null;

    const { error: updateError } = await supabase
        .from('application_documents')
        .update({
            uploaded_by: student.student_id,
            is_submitted: true,
            file_url: fileUrl,
            file_name: originalName,
            file_path: filePath,
            source_type: 'upload',
            review_status: 'pending',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('document_id', documentId);

    if (updateError) throw updateError;

    await supabase
        .from('applications')
        .update({
            document_status: 'Under Review',
        })
        .eq('application_id', application.application_id);

    return getMyDocuments(userId);
}

function normalizeRequiredDocumentType(value) {
    const text = String(value || '').trim().toLowerCase();

    if (text === 'cor' || text.includes('registration')) {
        return 'Certificate of Registration';
    }

    if (text.includes('indigency')) {
        return 'Certificate of Indigency';
    }

    if (text.includes('grade')) {
        return 'Grade Report';
    }

    if (text.includes('request') || text.includes('letter')) {
        return 'Letter of Request';
    }

    return value;
}

function boolValue(value, fallback = false) {
    if (value === true || value === 'true' || value === 1 || value === '1') {
        return true;
    }

    if (value === false || value === 'false' || value === 0 || value === '0') {
        return false;
    }

    return fallback;
}

function intOrNull(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function normalizeDate(value) {
    const raw = safeText(value);

    if (!raw) return null;

    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const month = slashMatch[1].padStart(2, '0');
        const day = slashMatch[2].padStart(2, '0');
        const year = slashMatch[3];
        return `${year}-${month}-${day}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toISOString().slice(0, 10);
}

function educationPayload(studentId, level, data = {}) {
    return {
        student_id: studentId,
        education_level: level,
        school_name: safeText(data.school),
        school_address: safeText(data.address),
        honors_awards: safeText(data.honors),
        club_organization: safeText(data.club),
        year_graduated: safeText(data.year_graduated),
        updated_at: new Date().toISOString(),
    };
}

function familyPayload(studentId, relation, data = {}, extra = {}) {
    return {
        student_id: studentId,
        relation,
        last_name: safeText(data.last_name),
        first_name: safeText(data.first_name),
        middle_name: safeText(data.middle_name),
        mobile_number: safeText(data.mobile_number || data.mobile),
        address: safeText(data.address || extra.parent_guardian_address),
        highest_educational_attainment: safeText(
            data.highest_educational_attainment || data.educational_attainment
        ) || null,
        occupation: safeText(data.occupation),
        company_name_address: safeText(
            data.company_name_address || data.company_name_and_address
        ),
        is_marilao_native: extra.is_marilao_native,
        years_as_resident: extra.years_as_resident,
        origin_province: extra.origin_province,
        updated_at: new Date().toISOString(),
    };
}

async function createRequiredDocumentSlots(applicationId, studentId) {
    const requiredDocuments = [
        'Certificate of Registration',
        'Certificate of Indigency',
        'Grade Report',
        'Letter of Request',
    ];

    const { data: existing, error: existingError } = await supabase
        .from('application_documents')
        .select('document_type')
        .eq('application_id', applicationId);

    if (existingError) throw existingError;

    const existingTypes = new Set(
        (existing || []).map((row) =>
            String(row.document_type || '').trim().toLowerCase()
        )
    );

    const missingRows = requiredDocuments
        .filter((type) => !existingTypes.has(type.toLowerCase()))
        .map((type) => ({
            application_id: applicationId,
            uploaded_by: studentId,
            document_type: type,
            is_submitted: false,
            review_status: 'pending',
            source_type: 'upload',
            ocr: {},
        }));

    if (missingRows.length === 0) return;

    const { error } = await supabase
        .from('application_documents')
        .insert(missingRows);

    if (error) throw error;
}

async function submitMyApplicationForm(userId, payload = {}) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const student = await getStudent(userId);

    if (!student?.student_id) {
        throw createHttpError(400, 'Student profile is required.');
    }

    const openingId =
        safeText(payload.opening_id) ||
        safeText(payload.openingId) ||
        safeText(payload.opening?.opening_id) ||
        safeText(payload.account?.opening_id);

    if (!openingId) {
        throw createHttpError(400, 'Opening ID is required.');
    }

    const { data: opening, error: openingError } = await supabase
        .from('program_openings')
        .select('opening_id, program_id, posting_status, is_archived')
        .eq('opening_id', openingId)
        .maybeSingle();

    if (openingError) throw openingError;

    if (!opening) {
        throw createHttpError(404, 'Opening not found.');
    }

    if (opening.is_archived || opening.posting_status !== 'open') {
        throw createHttpError(400, 'This opening is not accepting applications.');
    }

    const personal = payload.personal || {};
    const address = payload.address || {};
    const contact = payload.contact || {};
    const family = payload.family || {};
    const academic = payload.academic || {};
    const support = payload.support || {};
    const discipline = payload.discipline || {};
    const essays = payload.essays || {};

    const profilePayload = {
        student_id: student.student_id,

        date_of_birth: normalizeDate(
            personal.date_of_birth || personal.dateOfBirth
        ),
        place_of_birth: safeText(personal.place_of_birth || personal.placeOfBirth),
        civil_status: safeText(personal.civil_status || personal.civilStatus) || null,
        maiden_name: safeText(personal.maiden_name || personal.maidenName),
        religion: safeText(personal.religion),
        citizenship: safeText(personal.citizenship) || 'Filipino',

        unit_bldg_no: safeText(address.unit_bldg_no || address.unitBldgNo),
        house_lot_block_no: safeText(
            address.house_lot_block_no || address.houseLotBlockNo
        ),
        street_address: safeText(address.street || address.street_address),
        subdivision: safeText(address.subdivision),
        barangay: safeText(address.barangay),
        city: safeText(address.city_municipality || address.city),
        province: safeText(address.province),
        zip_code: safeText(address.zip_code || address.zipCode),
        landline_number: safeText(contact.landline || contact.landline_number),

        parent_guardian_address: safeText(family.parent_guardian_address),
        same_address_as_applicant: boolValue(family.same_address_as_applicant),
        father_present: boolValue(family.father_present, true),
        mother_present: boolValue(family.mother_present, true),
        guardian_only: boolValue(family.guardian_only),

        financial_support_type:
            safeText(support.financial_support_type || support.financial_support) ||
            null,
        financial_support_other: safeText(
            support.financial_support_other || support.scholarship_others_specify
        ),

        has_prior_scholarship: boolValue(
            support.has_prior_scholarship || support.scholarship_history
        ),
        prior_scholarship_details: safeText(
            support.prior_scholarship_details || support.scholarship_details
        ),

        scholarship_elementary: boolValue(support.scholarship_elementary),
        scholarship_high_school: boolValue(support.scholarship_high_school),
        scholarship_college: boolValue(support.scholarship_college),
        scholarship_others: boolValue(support.scholarship_others),
        scholarship_others_specify: safeText(support.scholarship_others_specify),

        has_disciplinary_record: boolValue(
            discipline.has_disciplinary_record || discipline.disciplinary_action
        ),
        disciplinary_details: safeText(
            discipline.disciplinary_details || discipline.disciplinary_explanation
        ),

        self_description: safeText(
            essays.self_description || essays.describe_yourself_essay
        ),
        aims_and_ambitions: safeText(
            essays.aims_and_ambitions || essays.aims_and_ambition_essay
        ),

        updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase
        .from('student_profiles')
        .upsert(profilePayload, { onConflict: 'student_id' });

    if (profileError) throw profileError;

    const nativeStatus = safeText(family.parent_native_status);
    const isNative =
        nativeStatus.toLowerCase().includes('yes') ? true :
            nativeStatus.toLowerCase() === 'no' ? false :
                null;

    const familyExtra = {
        parent_guardian_address: safeText(family.parent_guardian_address),
        is_marilao_native: isNative,
        years_as_resident: intOrNull(family.parent_marilao_residency_duration),
        origin_province: safeText(family.parent_previous_town_province),
    };

    const familyRows = [
        familyPayload(student.student_id, 'Father', family.father || {}, familyExtra),
        familyPayload(student.student_id, 'Mother', family.mother || {}, familyExtra),
        familyPayload(student.student_id, 'Sibling', family.sibling || {}, familyExtra),
        familyPayload(student.student_id, 'Guardian', family.guardian || {}, familyExtra),
    ];

    const { error: familyError } = await supabase
        .from('student_family')
        .upsert(familyRows, { onConflict: 'student_id,relation' });

    if (familyError) throw familyError;

    const educationRows = [
        educationPayload(student.student_id, 'College', {
            school: academic.college_school,
            address: academic.college_address,
            honors: academic.college_honors,
            club: academic.college_club,
            year_graduated: academic.college_year_graduated,
        }),
        educationPayload(student.student_id, 'High School', {
            school: academic.high_school_school,
            address: academic.high_school_address,
            honors: academic.high_school_honors,
            club: academic.high_school_club,
            year_graduated: academic.high_school_year_graduated,
        }),
        educationPayload(student.student_id, 'Senior High School', {
            school: academic.senior_high_school,
            address: academic.senior_high_address,
            honors: academic.senior_high_honors,
            club: academic.senior_high_club,
            year_graduated: academic.senior_high_year_graduated,
        }),
        educationPayload(student.student_id, 'Elementary', {
            school: academic.elementary_school,
            address: academic.elementary_address,
            honors: academic.elementary_honors,
            club: academic.elementary_club,
            year_graduated: academic.elementary_year_graduated,
        }),
    ];

    const { error: educationError } = await supabase
        .from('student_education')
        .upsert(educationRows, { onConflict: 'student_id,education_level' });

    if (educationError) throw educationError;

    const { data: existingApplication, error: existingApplicationError } =
        await supabase
            .from('applications')
            .select('application_id')
            .eq('student_id', student.student_id)
            .eq('opening_id', opening.opening_id)
            .maybeSingle();

    if (existingApplicationError) throw existingApplicationError;

    let application;

    if (existingApplication?.application_id) {
        const { data, error } = await supabase
            .from('applications')
            .update({
                program_id: opening.program_id,
                application_payload: payload,
                application_status: 'Pending Review',
                document_status: 'Missing Docs',
                verification_status: 'pending',
                updated_at: new Date().toISOString(),
            })
            .eq('application_id', existingApplication.application_id)
            .select('*')
            .single();

        if (error) throw error;
        application = data;
    } else {
        const { data, error } = await supabase
            .from('applications')
            .insert([
                {
                    student_id: student.student_id,
                    opening_id: opening.opening_id,
                    program_id: opening.program_id,
                    application_status: 'Pending Review',
                    document_status: 'Missing Docs',
                    verification_status: 'pending',
                    application_payload: payload,
                },
            ])
            .select('*')
            .single();

        if (error) throw error;
        application = data;
    }

    await createRequiredDocumentSlots(application.application_id, student.student_id);

    await supabase
        .from('students')
        .update({
            is_profile_complete: true,
            updated_at: new Date().toISOString(),
        })
        .eq('student_id', student.student_id);

    await supabase
        .from(APPLICATION_DRAFT_TABLE)
        .delete()
        .eq('user_id', userId);

    return {
        message: 'Application submitted successfully.',
        application,
        next: 'documents',
    };
}

module.exports = {
    getMyFormData,
    saveMyFormData,
    getMyDocuments,
    uploadMyDocument,
    submitMyApplicationForm,
};