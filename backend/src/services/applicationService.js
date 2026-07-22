const supabase = require('../config/supabase');
const { ensureStudentForUser } = require('./studentAccountService');

const APPLICATION_DRAFT_TABLE = 'application_form_drafts';
const ENDORSEMENT_SLIP_BUCKET =
    process.env.SUPABASE_APPLICATION_DOCUMENT_BUCKET || 'documents';

const REQUIRED_REVIEW_DOCUMENT_KEYS = Object.freeze([
    'birth_certificate',
    'certificate_of_registration',
    'student_grade_forms',
    'certificate_of_indigency',
    'letter_of_request',
    'application_form',
]);

const REQUIRED_UPLOAD_DOCUMENT_TYPES = Object.freeze([
    'birth certificate / psa',
    'certificate of registration',
    'grade report',
    'certificate of indigency',
    'letter of request',
]);

const WORKFLOW_STAGE_LABELS = Object.freeze({
    application_submitted: 'Application Submitted',
    requirements_review: 'Requirements Review',
    endorsement_review: 'Endorsement Review',
    ready_for_selection: 'Ready for Final Selection',
    waitlisted: 'Waiting List',
    not_selected: 'Not Selected',
    selected_for_activation: 'Selected for Activation',
    scholar_activated: 'Scholar Activated',
});

const REQUIREMENTS_LABELS = Object.freeze({
    verified: 'Verified',
    rejected: 'Rejected',
    reupload_required: 'Re-upload Required',
    missing: 'Missing Requirements',
    under_review: 'Under Review',
});

const ENDORSEMENT_LABELS = Object.freeze({
    pending_sdo: 'Pending SDO',
    pending_guidance: 'Pending Guidance',
    pending_pd: 'Pending Program Director',
    completed: 'Completed',
    rejected: 'Rejected',
    held: 'Held by Guidance',
    major_offense: 'Major Offense',
});

const BLOCKER_MESSAGES = Object.freeze({
    'requirements.rejected':
        'Your requirements review was rejected. Check the remarks from OSFA for the reason.',
    'endorsement.major_offense':
        'Your endorsement review stopped because SDO recorded a major offense.',
    'endorsement.rejected':
        'Your endorsement review was rejected by a reviewing office.',
    'endorsement.held':
        'Your endorsement review is on hold with Guidance.',
    'requirements.reupload_required':
        'One or more requirements need to be re-uploaded before review can continue.',
    'requirements.missing':
        'Upload all required scholarship documents to continue review.',
    'endorsement.grade_document_missing':
        'Upload your current grades PDF before the Program Director can approve your endorsement slip.',
    'requirements.under_review':
        'Your submitted requirements are still under OSFA review.',
    pending_sdo: 'Your endorsement slip is waiting for SDO review.',
    pending_guidance: 'Your endorsement slip is waiting for Guidance review.',
    pending_pd: 'Your endorsement slip is waiting for Program Director review.',
    ready_for_selection:
        'Requirements and endorsement are complete. Your application is waiting for the final FCFS selection list.',
    waitlisted:
        'You are on the finalized waiting list and will be notified if a scholarship slot becomes available.',
    not_selected:
        'You were not selected for this application period. You may apply again in a future eligible application period.',
    selected_for_activation:
        'You were selected. Scholar activation is being completed by OSFA.',
    activated: 'Your scholar access has been activated.',
});

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

function normalizeEducationalAttainment(value) {
    const normalized = normalizeLookupKey(value);

    if (!normalized) return null;

    if (normalized.includes('elementary')) return 'Elementary';
    if (normalized.includes('senior high')) return 'Senior High School';
    if (normalized.includes('high school')) return 'High School';
    if (normalized.includes('college')) return 'College';
    if (normalized.includes('vocational')) return 'Vocational';
    if (normalized.includes('post graduate') || normalized.includes('postgraduate')) {
        return 'Post-Graduate';
    }
    if (normalized === 'none') return 'None';

    const lookup = {
        none: 'None',
    };

    return lookup[normalized] || null;
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

function parseIsoDate(value) {
    const text = safeText(value);
    if (!text) return null;

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed;
}

function calculateAgeFromDate(value) {
    const parsed = parseIsoDate(value);
    if (!parsed) return '';

    const today = new Date();
    let years = today.getFullYear() - parsed.getFullYear();
    const hadBirthday =
        today.getMonth() > parsed.getMonth() ||
        (
            today.getMonth() === parsed.getMonth() &&
            today.getDate() >= parsed.getDate()
        );

    if (!hadBirthday) {
        years -= 1;
    }

    return years >= 0 ? String(years) : '';
}

function educationRowByLevel(rows = [], level = '') {
    const normalizedLevel = safeText(level).toLowerCase();

    return (
        rows.find(
            (row) => safeText(row.education_level).toLowerCase() === normalizedLevel
        ) || {}
    );
}

function familyNativeStatusFromRows(rows = []) {
    const father = rows.find(
        (row) => normalizeFamilyRelation(row.relation) === 'Father'
    );
    const mother = rows.find(
        (row) => normalizeFamilyRelation(row.relation) === 'Mother'
    );

    const fatherNative = father?.is_marilao_native;
    const motherNative = mother?.is_marilao_native;

    if (fatherNative === true && motherNative === true) {
        return 'Yes, both parents';
    }

    if (fatherNative === true && motherNative !== true) {
        return 'Yes, father only';
    }

    if (motherNative === true && fatherNative !== true) {
        return 'Yes, mother only';
    }

    if (fatherNative === false && motherNative === false) {
        return 'No';
    }

    return '';
}

function firstNonEmptyFamilyValue(rows = [], field) {
    for (const row of rows) {
        const text = safeText(row?.[field]);
        if (text) return text;
    }

    return '';
}

function normalizeLookupKey(value) {
    return safeText(value)
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function rawSnapshotValue(snapshot = {}, keys = []) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        return '';
    }

    const normalizedEntries = Object.entries(snapshot).map(([key, value]) => [
        normalizeLookupKey(key),
        value,
    ]);

    for (const key of keys) {
        const normalizedKey = normalizeLookupKey(key);
        const match = normalizedEntries.find(([entryKey]) => entryKey === normalizedKey);
        const text = safeText(match?.[1]);
        if (text) return text;
    }

    return '';
}

function splitFullName(value) {
    const parts = safeText(value).split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return { first_name: '', middle_name: '', last_name: '' };
    }
    if (parts.length === 1) {
        return { first_name: parts[0], middle_name: '', last_name: '' };
    }
    if (parts.length === 2) {
        return { first_name: parts[0], middle_name: '', last_name: parts[1] };
    }
    return {
        first_name: parts[0],
        middle_name: parts.slice(1, -1).join(' '),
        last_name: parts[parts.length - 1],
    };
}

function rawFamilyMember(snapshot = {}, relation = '') {
    const prefix = normalizeLookupKey(relation);
    if (!prefix) return {};

    const keys = (field) => [
        `${relation} ${field}`,
        `${relation}'s ${field}`,
        `${relation}_${field}`,
        `${prefix}_${field}`,
    ];
    const fullName = splitFullName(rawSnapshotValue(snapshot, keys('name')));

    return {
        relation,
        last_name: firstNonEmpty(
            rawSnapshotValue(snapshot, keys('last name')),
            fullName.last_name
        ),
        first_name: firstNonEmpty(
            rawSnapshotValue(snapshot, keys('first name')),
            fullName.first_name
        ),
        middle_name: firstNonEmpty(
            rawSnapshotValue(snapshot, keys('middle name')),
            fullName.middle_name
        ),
        mobile_number: rawSnapshotValue(snapshot, [
            ...keys('mobile no'),
            ...keys('mobile number'),
            ...keys('contact number'),
            ...keys('phone number'),
        ]),
        highest_educational_attainment: rawSnapshotValue(snapshot, [
            ...keys('highest educational attainment'),
            ...keys('educational attainment'),
        ]),
        occupation: rawSnapshotValue(snapshot, keys('occupation')),
        company_name_address: rawSnapshotValue(snapshot, [
            ...keys('company name address'),
            ...keys('company name and address'),
            ...keys('company address'),
        ]),
        address: rawSnapshotValue(snapshot, keys('address')),
    };
}

function addressFromRawSnapshot(snapshot = {}) {
    const permanentAddress = rawSnapshotValue(snapshot, ['Permanent Address']);
    const presentAddress = rawSnapshotValue(snapshot, ['Present Address']);
    const permanentZip = rawSnapshotValue(snapshot, ['Permanent ZIP Code']);
    const presentZip = rawSnapshotValue(snapshot, ['Present ZIP Code']);

    return {
        street: firstNonEmpty(permanentAddress, presentAddress),
        zip_code: firstNonEmpty(permanentZip, presentZip),
    };
}

function hasFamilyName(row = {}) {
    return Boolean(safeText(row.first_name) || safeText(row.last_name));
}

function deriveFinancialSupport(master = {}, profile = {}) {
    const profileSupport = safeText(profile?.financial_support_type);
    if (profileSupport) return profileSupport;

    if (master?.financial_support_parents === true) return 'Parents';
    if (master?.financial_support_scholarship === true) return 'Scholarship';
    if (master?.financial_support_loan === true) return 'Loan';
    if (master?.financial_support_other === true) return 'Other';

    return 'Parents';
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
      scholarship_status,
      current_application_id,
      current_program_id,
      date_awarded
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
  sequence_number,
  age,
  date_of_birth,
  place_of_birth,
  civil_status,
  sibling_last_name,
  sibling_first_name,
  sibling_middle_name,
  sibling_mobile_no,
  financial_support_parents,
  financial_support_scholarship,
  financial_support_loan,
  financial_support_other,
  has_been_scholar,
  has_disciplinary_action,
  raw_snapshot
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
      unit_bldg_no,
      house_lot_block_no,
      street_address,
      subdivision,
      barangay,
      city,
      province,
      zip_code,
      landline_number,
      parent_guardian_address,
      same_address_as_applicant,
      father_present,
      mother_present,
      guardian_only,
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

    let student = await getStudent(userId);
    if (!student) {
        try {
            await ensureStudentForUser(userId);
            student = await getStudent(userId);
        } catch (error) {
            if (![400, 404].includes(Number(error?.statusCode))) {
                throw error;
            }
        }
    }
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
        rawFamilyMember(master?.raw_snapshot, 'Father');
    const mother =
        familyRows.find((row) => normalizeFamilyRelation(row.relation) === 'Mother') ||
        rawFamilyMember(master?.raw_snapshot, 'Mother');
    const sibling =
        familyRows.find((row) => normalizeFamilyRelation(row.relation) === 'Sibling') ||
        {
            relation: 'Sibling',
            last_name: safeText(master?.sibling_last_name),
            first_name: safeText(master?.sibling_first_name),
            middle_name: safeText(master?.sibling_middle_name),
            mobile_number: safeText(master?.sibling_mobile_no),
        };
    const guardian =
        familyRows.find((row) => normalizeFamilyRelation(row.relation) === 'Guardian') ||
        rawFamilyMember(master?.raw_snapshot, 'Guardian');
    const collegeEducation = educationRowByLevel(educationRows, 'College');
    const highSchoolEducation = educationRowByLevel(educationRows, 'High School');
    const seniorHighEducation = educationRowByLevel(
        educationRows,
        'Senior High School'
    );
    const elementaryEducation = educationRowByLevel(educationRows, 'Elementary');

    const firstName = firstNonEmpty(master?.first_name, student.first_name);
    const middleName = firstNonEmpty(master?.middle_name, student.middle_name);
    const lastName = firstNonEmpty(master?.last_name, student.last_name);
    const dateOfBirth = firstNonEmpty(profile?.date_of_birth, master?.date_of_birth);
    const age = firstNonEmpty(
        profile?.date_of_birth ? calculateAgeFromDate(profile.date_of_birth) : '',
        master?.age,
        calculateAgeFromDate(master?.date_of_birth)
    );

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
    const rawAddress = addressFromRawSnapshot(master?.raw_snapshot);

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
            age,
            date_of_birth: dateOfBirth,
            sex: firstNonEmpty(student.sex_at_birth, master?.sex_at_birth),
            place_of_birth: firstNonEmpty(
                profile?.place_of_birth,
                master?.place_of_birth
            ),
            citizenship: firstNonEmpty(profile?.citizenship, 'Filipino'),
            civil_status: firstNonEmpty(profile?.civil_status, master?.civil_status),
            religion: firstNonEmpty(
                profile?.religion,
                master?.religion,
                student.religion
            ),
        },

        address: {
            unit_bldg_no: safeText(profile?.unit_bldg_no),
            house_lot_block_no: safeText(profile?.house_lot_block_no),
            street: firstNonEmpty(profile?.street_address, rawAddress.street),
            subdivision: safeText(profile?.subdivision),
            barangay: safeText(profile?.barangay),
            city_municipality: safeText(profile?.city),
            province: safeText(profile?.province),
            zip_code: firstNonEmpty(profile?.zip_code, rawAddress.zip_code),
        },

        contact: {
            landline: safeText(profile?.landline_number),
            mobile_number: phoneNumber,
            email,
        },

        family: {
            parent_guardian_address:
                firstNonEmpty(
                    draftPayload.family?.parent_guardian_address,
                    profile?.parent_guardian_address,
                    guardian?.address,
                    father?.address,
                    mother?.address
                ),

            same_address_as_applicant:
                draftPayload.family?.same_address_as_applicant === true
                    ? true
                    : draftPayload.family?.same_address_as_applicant === false
                        ? false
                        : profile?.same_address_as_applicant === true,

            father_present:
                draftPayload.family?.father_present === false
                    ? false
                    : draftPayload.family?.father_present === true
                        ? true
                        : profile?.father_present === false
                            ? false
                            : profile?.father_present === true
                            ? true
                            : Boolean(
                                    hasFamilyName(father)
                                ),

            mother_present:
                draftPayload.family?.mother_present === false
                    ? false
                    : draftPayload.family?.mother_present === true
                        ? true
                        : profile?.mother_present === false
                            ? false
                            : profile?.mother_present === true
                            ? true
                            : Boolean(
                                    hasFamilyName(mother)
                                ),

            guardian_only:
                draftPayload.family?.guardian_only === true
                    ? true
                    : draftPayload.family?.guardian_only === false
                        ? false
                        : profile?.guardian_only === true,

            father: mapFamilyMember(father, 'Father'),
            mother: mapFamilyMember(mother, 'Mother'),
            sibling: mapFamilyMember(sibling, 'Sibling'),
            guardian: mapFamilyMember(guardian, 'Guardian'),

            parent_native_status: firstNonEmpty(
                draftPayload.family?.parent_native_status,
                familyNativeStatusFromRows(familyRows)
            ),
            parent_marilao_residency_duration: firstNonEmpty(
                draftPayload.family?.parent_marilao_residency_duration,
                firstNonEmptyFamilyValue(familyRows, 'years_as_resident')
            ),
            parent_previous_town_province: firstNonEmpty(
                draftPayload.family?.parent_previous_town_province,
                firstNonEmptyFamilyValue(familyRows, 'origin_province')
            ),
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
            college_school: safeText(collegeEducation.school_name),
            college_address: safeText(collegeEducation.school_address),
            college_honors: safeText(collegeEducation.honors_awards),
            college_club: safeText(collegeEducation.club_organization),
            college_year_graduated: safeText(collegeEducation.year_graduated),
            high_school_school: safeText(highSchoolEducation.school_name),
            high_school_address: safeText(highSchoolEducation.school_address),
            high_school_honors: safeText(highSchoolEducation.honors_awards),
            high_school_club: safeText(highSchoolEducation.club_organization),
            high_school_year_graduated: safeText(
                highSchoolEducation.year_graduated
            ),
            senior_high_school: safeText(seniorHighEducation.school_name),
            senior_high_address: safeText(seniorHighEducation.school_address),
            senior_high_honors: safeText(seniorHighEducation.honors_awards),
            senior_high_club: safeText(seniorHighEducation.club_organization),
            senior_high_year_graduated: safeText(
                seniorHighEducation.year_graduated
            ),
            elementary_school: safeText(elementaryEducation.school_name),
            elementary_address: safeText(elementaryEducation.school_address),
            elementary_honors: safeText(elementaryEducation.honors_awards),
            elementary_club: safeText(elementaryEducation.club_organization),
            elementary_year_graduated: safeText(
                elementaryEducation.year_graduated
            ),
            current_section: safeText(draftPayload.academic?.current_section),
        },

        support: {
            financial_support:
                deriveFinancialSupport(master, profile),
            financial_support_type: safeText(profile?.financial_support_type),
            financial_support_other: safeText(profile?.financial_support_other),
            scholarship_history:
                profile?.has_prior_scholarship === true ||
                master?.has_been_scholar === true,
            has_prior_scholarship:
                profile?.has_prior_scholarship === true ||
                master?.has_been_scholar === true,
            scholarship_details: safeText(profile?.prior_scholarship_details),
            prior_scholarship_details: safeText(profile?.prior_scholarship_details),
            scholarship_others_specify: safeText(profile?.financial_support_other),
            scholarship_elementary:
                draftPayload.support?.scholarship_elementary === true,
            scholarship_high_school:
                draftPayload.support?.scholarship_high_school === true,
            scholarship_college:
                draftPayload.support?.scholarship_college === true,
            scholarship_others: master?.financial_support_other === true,
        },

        discipline: {
            disciplinary_action:
                profile?.has_disciplinary_record === true ||
                master?.has_disciplinary_action === true,
            has_disciplinary_record:
                profile?.has_disciplinary_record === true ||
                master?.has_disciplinary_action === true,
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
            father: {
                ...(basePayload.family?.father || {}),
                ...(draftPayload.family?.father || {}),
            },
            mother: {
                ...(basePayload.family?.mother || {}),
                ...(draftPayload.family?.mother || {}),
            },
            sibling: {
                ...(basePayload.family?.sibling || {}),
                ...(draftPayload.family?.sibling || {}),
            },
            guardian: {
                ...(basePayload.family?.guardian || {}),
                ...(draftPayload.family?.guardian || {}),
            },
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
        .eq('is_archived', false)
        .neq('application_status', 'Rejected')
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
        'Birth Certificate / PSA',
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

function isMissingSchemaError(error) {
    const message = String(error?.message || '').toLowerCase();

    return (
        error?.code === 'PGRST205' ||
        error?.code === '42P01' ||
        message.includes('could not find the table') ||
        message.includes('does not exist') ||
        message.includes('schema cache')
    );
}

function normalizeWorkflowKey(value) {
    return safeText(value)
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeDocumentReviewKey(value) {
    const normalized = normalizeWorkflowKey(value).replace(/\s+/g, '_');

    if (normalized === 'cor' || normalized === 'registration') {
        return 'certificate_of_registration';
    }

    if (
        normalized === 'grade_form' ||
        normalized === 'grade_forms' ||
        normalized === 'grades' ||
        normalized === 'grade_report'
    ) {
        return 'student_grade_forms';
    }

    if (normalized === 'indigency') {
        return 'certificate_of_indigency';
    }

    if (normalized === 'lor' || normalized === 'request_letter') {
        return 'letter_of_request';
    }

    if (normalized === 'application') {
        return 'application_form';
    }

    return normalized;
}

function normalizeUploadDocumentType(value) {
    const normalized = normalizeWorkflowKey(value);

    if (
        normalized.includes('birth certificate') ||
        normalized.includes('certificate of live birth') ||
        normalized === 'psa' ||
        normalized === 'nso'
    ) {
        return 'birth certificate / psa';
    }

    if (normalized === 'cor' || normalized.includes('registration')) {
        return 'certificate of registration';
    }

    if (normalized.includes('grade')) {
        return 'grade report';
    }

    if (normalized.includes('indigency')) {
        return 'certificate of indigency';
    }

    if (normalized.includes('request') || normalized.includes('letter')) {
        return 'letter of request';
    }

    return normalized;
}

function normalizeReviewDecision(value) {
    const normalized = normalizeWorkflowKey(value);

    if (normalized === 'verified' || normalized === 'approved') {
        return 'verified';
    }

    if (
        normalized === 'requires reupload' ||
        normalized === 'requires re upload' ||
        normalized === 'reupload' ||
        normalized === 're upload' ||
        normalized === 'needs reupload' ||
        normalized === 'needs re upload'
    ) {
        return 'reupload_required';
    }

    if (normalized === 'rejected' || normalized === 'denied' || normalized === 'declined') {
        return 'rejected';
    }

    if (normalized === 'uploaded' || normalized === 'under review') {
        return 'under_review';
    }

    return normalized || 'pending';
}

function isSubmittedDocument(document = {}) {
    return (
        document.is_submitted === true &&
        Boolean(safeText(document.file_path) || safeText(document.file_url))
    );
}

function pickLatestRemark(...rows) {
    for (const row of rows) {
        const text = safeText(row?.admin_comment || row?.remarks || row?.notes);
        if (text) return text;
    }

    return '';
}

async function fetchLatestApplication(studentId) {
    const { data, error } = await supabase
        .from('applications')
        .select(`
      application_id,
      student_id,
      opening_id,
      program_id,
      application_status,
      document_status,
      verification_status,
      requirements_completed_at,
      requirements_verified_at,
      selection_status,
      queue_position,
      waitlist_position,
      selection_batch_id,
      selected_at,
      waitlisted_at,
      finalized_at,
      activation_status,
      activated_at,
      can_reapply,
      reapplication_reason,
      rejection_reason,
      remarks,
      is_disqualified,
      submission_date,
      created_at,
      updated_at
    `)
        .eq('student_id', studentId)
        .order('submission_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(1);

    if (error) throw error;

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function fetchApplicationStatusRows(applicationId) {
    const [documentsResult, reviewsResult, slipResult] = await Promise.all([
        supabase
            .from('application_documents')
            .select(`
        document_id,
        application_id,
        document_type,
        is_submitted,
        file_url,
        file_name,
        file_path,
        review_status,
        remarks,
        notes,
        submitted_at,
        updated_at
      `)
            .eq('application_id', applicationId),
        supabase
            .from('application_document_reviews')
            .select(`
        review_id,
        application_id,
        document_key,
        document_name,
        review_status,
        admin_comment,
        reviewed_at,
        updated_at
      `)
            .eq('application_id', applicationId),
        supabase
            .from('endorsement_slips')
            .select(`
        slip_id,
        application_id,
        student_id,
        opening_id,
        current_stage,
        overall_status,
        pd_status,
        pd_acted_by_user_id,
        pd_acted_at,
        pd_remarks,
        guidance_status,
        guidance_acted_by_user_id,
        guidance_acted_at,
        guidance_remarks,
        sdo_status,
        sdo_acted_by_user_id,
        sdo_acted_at,
        sdo_remarks,
        sdo_offense_type,
        sdo_incident_date,
        sdo_case_reference_number,
        final_pdf_path,
        final_pdf_url,
        completed_at,
        updated_at
      `)
            .eq('application_id', applicationId)
            .maybeSingle(),
    ]);

    if (documentsResult.error) throw documentsResult.error;
    if (reviewsResult.error && !isMissingSchemaError(reviewsResult.error)) {
        throw reviewsResult.error;
    }
    if (slipResult.error && !isMissingSchemaError(slipResult.error)) {
        throw slipResult.error;
    }

    return {
        documents: documentsResult.data || [],
        reviews: reviewsResult.error ? [] : reviewsResult.data || [],
        slip: slipResult.error ? null : slipResult.data || null,
    };
}

async function enrichSlipActorNames(slip) {
    if (!slip) return null;

    const actorUserIds = [
        slip.sdo_acted_by_user_id,
        slip.guidance_acted_by_user_id,
        slip.pd_acted_by_user_id,
    ].filter(Boolean);

    if (!actorUserIds.length) {
        return slip;
    }

    const { data, error } = await supabase
        .from('admin_profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', [...new Set(actorUserIds)]);

    if (error) throw error;

    const nameMap = new Map(
        (data || []).map((row) => [
            row.user_id,
            [row.first_name, row.last_name].filter(Boolean).join(' ').trim(),
        ])
    );

    return {
        ...slip,
        sdo_acted_by_name: nameMap.get(slip.sdo_acted_by_user_id) || null,
        guidance_acted_by_name: nameMap.get(slip.guidance_acted_by_user_id) || null,
        pd_acted_by_name: nameMap.get(slip.pd_acted_by_user_id) || null,
    };
}

async function fetchApplicationProgramContext(application = {}) {
    const [openingResult, programResult] = await Promise.all([
        application.opening_id
            ? supabase
                .from('program_openings')
                .select('opening_id, opening_title, allocated_slots, filled_slots, waiting_list_enabled, selection_status, selection_finalized_at')
                .eq('opening_id', application.opening_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        application.program_id
            ? supabase
                .from('scholarship_program')
                .select('program_id, program_name')
                .eq('program_id', application.program_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ]);

    if (openingResult.error) throw openingResult.error;
    if (programResult.error) throw programResult.error;

    return {
        opening: openingResult.data || null,
        program: programResult.data || null,
    };
}

function buildRequirementsStatus(application = {}, documents = [], reviews = []) {
    const requiredReviewKeys = new Set(REQUIRED_REVIEW_DOCUMENT_KEYS);
    const requiredUploadTypes = new Set(REQUIRED_UPLOAD_DOCUMENT_TYPES);
    const applicationStatus = normalizeWorkflowKey(application.application_status);
    const verificationStatus = normalizeWorkflowKey(application.verification_status);
    const documentStatus = normalizeWorkflowKey(application.document_status);
    const reviewRows = Array.isArray(reviews) ? reviews : [];
    const documentRows = Array.isArray(documents) ? documents : [];
    const uploadedRequiredTypes = new Set();
    const verifiedReviewKeys = new Set();
    const rejectedReviews = [];
    const reuploadReviews = [];

    documentRows.forEach((document) => {
        const type = normalizeUploadDocumentType(document.document_type);

        if (requiredUploadTypes.has(type) && isSubmittedDocument(document)) {
            uploadedRequiredTypes.add(type);
        }
    });

    reviewRows.forEach((review) => {
        const key = normalizeDocumentReviewKey(
            review.document_key || review.document_name
        );

        if (!requiredReviewKeys.has(key)) {
            return;
        }

        const decision = normalizeReviewDecision(review.review_status);
        if (decision === 'verified') verifiedReviewKeys.add(key);
        if (decision === 'rejected') rejectedReviews.push(review);
        if (decision === 'reupload_required') reuploadReviews.push(review);
    });

    const uploadedCount = uploadedRequiredTypes.size;
    const verifiedCount = verifiedReviewKeys.size;
    const requiredUploadCount = REQUIRED_UPLOAD_DOCUMENT_TYPES.length;
    const requiredReviewCount = REQUIRED_REVIEW_DOCUMENT_KEYS.length;
    const applicationRejected =
        application.is_disqualified === true ||
        applicationStatus === 'rejected' ||
        applicationStatus === 'disqualified' ||
        verificationStatus === 'rejected';
    const applicationReupload =
        applicationStatus === 'requires reupload' ||
        applicationStatus === 'requires re upload' ||
        documentStatus === 'requires reupload' ||
        documentStatus === 'requires re upload';

    if (applicationRejected) {
        return {
            status: 'rejected',
            status_label: REQUIREMENTS_LABELS.rejected,
            uploaded_count: uploadedCount,
            required_upload_count: requiredUploadCount,
            verified_count: verifiedCount,
            required_review_count: requiredReviewCount,
            remarks: firstNonEmpty(
                application.rejection_reason,
                application.remarks,
                pickLatestRemark(...rejectedReviews)
            ) || null,
        };
    }

    if (reuploadReviews.length > 0 || applicationReupload) {
        return {
            status: 'reupload_required',
            status_label: REQUIREMENTS_LABELS.reupload_required,
            uploaded_count: uploadedCount,
            required_upload_count: requiredUploadCount,
            verified_count: verifiedCount,
            required_review_count: requiredReviewCount,
            remarks: pickLatestRemark(...reuploadReviews, ...rejectedReviews) || null,
        };
    }

    if (uploadedCount < requiredUploadCount) {
        return {
            status: 'missing',
            status_label: REQUIREMENTS_LABELS.missing,
            uploaded_count: uploadedCount,
            required_upload_count: requiredUploadCount,
            verified_count: verifiedCount,
            required_review_count: requiredReviewCount,
            remarks: null,
        };
    }

    if (verifiedCount >= requiredReviewCount) {
        return {
            status: 'verified',
            status_label: REQUIREMENTS_LABELS.verified,
            uploaded_count: uploadedCount,
            required_upload_count: requiredUploadCount,
            verified_count: verifiedCount,
            required_review_count: requiredReviewCount,
            remarks: null,
        };
    }

    return {
        status: 'under_review',
        status_label: REQUIREMENTS_LABELS.under_review,
        uploaded_count: uploadedCount,
        required_upload_count: requiredUploadCount,
        verified_count: verifiedCount,
        required_review_count: requiredReviewCount,
        remarks: null,
    };
}

function deriveSlipCode(slipId) {
    const base = safeText(slipId).split('-')[0].toUpperCase();
    return base ? `ES-${base}` : 'ES-PENDING';
}

function buildOfficeReview({
    office,
    decision,
    actedAt,
    actedByName,
    remarks,
    offenseDetail = null,
}) {
    return {
        office,
        decision: decision || null,
        acted_at: actedAt || null,
        acted_by_name: safeText(actedByName) || null,
        remarks: safeText(remarks) || null,
        offense_detail: offenseDetail,
    };
}

function buildEndorsementStatus(slip = null) {
    if (!slip) {
        return {
            status: 'pending_sdo',
            status_label: ENDORSEMENT_LABELS.pending_sdo,
            current_stage: 'pending_sdo',
            current_office: 'SDO',
            slip: {
                available: false,
                slip_id: null,
                slip_code: null,
                download_url: null,
                file_name: null,
                completed_at: null,
            },
            office_reviews: {
                sdo: buildOfficeReview({ office: 'SDO' }),
                guidance: buildOfficeReview({ office: 'Guidance' }),
                pd: buildOfficeReview({ office: 'Program Director' }),
            },
            remarks: null,
        };
    }

    const overall = normalizeWorkflowKey(slip.overall_status).replace(/\s+/g, '_');
    const currentStage = normalizeWorkflowKey(slip.current_stage).replace(/\s+/g, '_');
    let status = currentStage || overall || 'pending_sdo';

    if (overall === 'completed') {
        status = 'completed';
    } else if (overall === 'disqualified_major' || slip.sdo_status === 'disqualified_major') {
        status = 'major_offense';
    } else if (
        overall === 'rejected' ||
        overall === 'guidance_rejected' ||
        overall === 'disqualified_minor'
    ) {
        status = 'rejected';
    } else if (overall === 'held') {
        status = 'held';
    }

    const currentOffice =
        status === 'pending_sdo'
            ? 'SDO'
            : status === 'pending_guidance' || status === 'held'
                ? 'Guidance'
                : status === 'pending_pd'
                    ? 'Program Director'
                    : null;
    const remarks = firstNonEmpty(
        status === 'major_offense' ? slip.sdo_remarks : '',
        status === 'held' || overall === 'guidance_rejected' ? slip.guidance_remarks : '',
        overall === 'rejected' ? slip.pd_remarks : '',
        slip.guidance_remarks,
        slip.pd_remarks,
        slip.sdo_remarks
    );
    const slipReady = status === 'completed' && Boolean(safeText(slip.final_pdf_path));
    const slipCode = deriveSlipCode(slip.slip_id);

    return {
        status,
        status_label: ENDORSEMENT_LABELS[status] || ENDORSEMENT_LABELS[currentStage] || status,
        current_stage: currentStage || status,
        current_office: currentOffice,
        completed_at: slip.completed_at || null,
        remarks: remarks || null,
        slip: {
            available: slipReady,
            slip_id: slip.slip_id || null,
            slip_code: slipCode,
            download_url: slipReady ? '/api/applications/me/endorsement-slip/pdf' : null,
            file_name: slipReady ? `endorsement-slip-${slipCode}.pdf` : null,
            completed_at: slip.completed_at || null,
        },
        office_reviews: {
            sdo: buildOfficeReview({
                office: 'SDO',
                decision: slip.sdo_status,
                actedAt: slip.sdo_acted_at,
                actedByName: slip.sdo_acted_by_name,
                remarks: slip.sdo_remarks,
                offenseDetail: {
                    offense_type: slip.sdo_offense_type || null,
                    incident_date: slip.sdo_incident_date || null,
                    case_reference_number: slip.sdo_case_reference_number || null,
                },
            }),
            guidance: buildOfficeReview({
                office: 'Guidance',
                decision: slip.guidance_status,
                actedAt: slip.guidance_acted_at,
                actedByName: slip.guidance_acted_by_name,
                remarks: slip.guidance_remarks,
            }),
            pd: buildOfficeReview({
                office: 'Program Director',
                decision: slip.pd_status,
                actedAt: slip.pd_acted_at,
                actedByName: slip.pd_acted_by_name,
                remarks: slip.pd_remarks,
            }),
        },
    };
}

function buildWorkflowBlocker(code, source) {
    return {
        code,
        source,
        message: BLOCKER_MESSAGES[code] || code,
    };
}

function buildWorkflowSummary({
    student,
    application,
    requirements,
    endorsement,
    documents = [],
}) {
    const applicationStatus = normalizeWorkflowKey(application.application_status);
    const selectionStatus = normalizeWorkflowKey(application.selection_status);
    const explicitActivationSucceeded =
        applicationStatus === 'approved' &&
        student.is_active_scholar === true &&
        safeText(student.scholarship_status).toLowerCase() === 'active' &&
        safeText(student.current_application_id) === safeText(application.application_id);
    const activated =
        explicitActivationSucceeded &&
        requirements.status === 'verified' &&
        endorsement.status === 'completed';
    const isWaitlisted = selectionStatus === 'waitlisted';
    const isNotSelected = selectionStatus === 'not selected';
    const isSelected = selectionStatus === 'selected' || selectionStatus === 'promoted';
    const readyForSelection =
        !activated &&
        !isWaitlisted &&
        !isNotSelected &&
        !isSelected &&
        requirements.status === 'verified' &&
        endorsement.status === 'completed';
    const selectedForActivation = !activated && isSelected;
    const gradeDocumentUploaded = (documents || []).some((document) => {
        const type = safeText(document?.document_type).toLowerCase();
        return (
            type === 'grade report' &&
            document?.is_submitted === true &&
            (safeText(document?.file_path) || safeText(document?.file_url))
        );
    });
    const candidates = [];

    if (requirements.status === 'rejected') {
        candidates.push(buildWorkflowBlocker('requirements.rejected', 'requirements'));
    }
    if (endorsement.status === 'major_offense') {
        candidates.push(buildWorkflowBlocker('endorsement.major_offense', 'endorsement'));
    }
    if (endorsement.status === 'rejected') {
        candidates.push(buildWorkflowBlocker('endorsement.rejected', 'endorsement'));
    }
    if (endorsement.status === 'held') {
        candidates.push(buildWorkflowBlocker('endorsement.held', 'endorsement'));
    }
    if (
        endorsement.current_office === 'Program Director' &&
        !gradeDocumentUploaded
    ) {
        candidates.push(
            buildWorkflowBlocker(
                'endorsement.grade_document_missing',
                'endorsement'
            )
        );
    }
    if (requirements.status === 'reupload_required') {
        candidates.push(buildWorkflowBlocker('requirements.reupload_required', 'requirements'));
    }
    if (requirements.status === 'missing') {
        candidates.push(buildWorkflowBlocker('requirements.missing', 'requirements'));
    }
    if (requirements.status === 'under_review') {
        candidates.push(buildWorkflowBlocker('requirements.under_review', 'requirements'));
    }
    if (['pending_sdo', 'pending_guidance', 'pending_pd'].includes(endorsement.status)) {
        candidates.push(buildWorkflowBlocker(endorsement.status, 'endorsement'));
    }
    if (isWaitlisted) {
        candidates.push(buildWorkflowBlocker('waitlisted', 'selection'));
    } else if (isNotSelected) {
        candidates.push(buildWorkflowBlocker('not_selected', 'selection'));
    } else if (selectedForActivation) {
        candidates.push(buildWorkflowBlocker('selected_for_activation', 'selection'));
    } else if (readyForSelection) {
        candidates.push(buildWorkflowBlocker('ready_for_selection', 'selection'));
    }
    if (activated) {
        candidates.push(buildWorkflowBlocker('activated', 'scholar_activation'));
    }

    const primary = candidates[0] || null;
    const stage = activated
        ? 'scholar_activated'
        : isWaitlisted
            ? 'waitlisted'
            : isNotSelected
                ? 'not_selected'
                : selectedForActivation
                    ? 'selected_for_activation'
                    : readyForSelection
                        ? 'ready_for_selection'
                        : primary?.source === 'requirements'
                            ? 'requirements_review'
                            : primary?.source === 'endorsement'
                                ? 'endorsement_review'
                                : 'application_submitted';

    const activationStatus = activated
        ? 'activated'
        : selectedForActivation
            ? 'selected_for_activation'
            : isWaitlisted
                ? 'waitlisted'
                : isNotSelected
                    ? 'not_selected'
                    : readyForSelection
                        ? 'ready_for_selection'
                        : 'not_ready';

    return {
        stage,
        stage_label: WORKFLOW_STAGE_LABELS[stage] || stage,
        requirements,
        endorsement,
        scholar_activation: {
            status: activationStatus,
            status_label: activated
                ? 'Activated'
                : selectedForActivation
                    ? 'Selected for Activation'
                    : isWaitlisted
                        ? 'Waiting List'
                        : isNotSelected
                            ? 'Not Selected'
                            : readyForSelection
                                ? 'Ready for Final Selection'
                                : 'Not Ready',
            activated_at: activated ? student.date_awarded || application.activated_at || null : null,
            explicit_activation_succeeded: explicitActivationSucceeded,
            active_current_application:
                safeText(student.current_application_id) === safeText(application.application_id),
        },
        blockers: candidates,
        primary_blocker: primary,
    };
}

async function getMyApplicationStatusSummary(userId) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const student = await getStudent(userId);

    if (!student?.student_id) {
        return {
            has_application: false,
            hasApplication: false,
            application: null,
            workflow: null,
            message: 'Submit an application first.',
        };
    }

    const application = await fetchLatestApplication(student.student_id);

    if (!application) {
        return {
            has_application: false,
            hasApplication: false,
            application: null,
            workflow: null,
            message: 'Submit an application first.',
        };
    }

    const [{ documents, reviews, slip: rawSlip }, context] = await Promise.all([
        fetchApplicationStatusRows(application.application_id),
        fetchApplicationProgramContext(application),
    ]);
    const slip = await enrichSlipActorNames(rawSlip);
    const requirements = buildRequirementsStatus(application, documents, reviews);
    const endorsement = buildEndorsementStatus(slip);
    const workflow = buildWorkflowSummary({
        student,
        application,
        requirements,
        endorsement,
        documents,
    });

    return {
        has_application: true,
        hasApplication: true,
        application: {
            application_id: application.application_id,
            student_id: application.student_id,
            opening_id: application.opening_id,
            opening_title: context.opening?.opening_title || null,
            program_id: application.program_id,
            program_name: context.program?.program_name || null,
            application_status: application.application_status || null,
            document_status: application.document_status || null,
            verification_status: application.verification_status || null,
            submission_date: application.submission_date || null,
            created_at: application.created_at || null,
            updated_at: application.updated_at || null,
            requirements_completed_at: application.requirements_completed_at || null,
            requirements_verified_at: application.requirements_verified_at || null,
            selection_status: application.selection_status || 'Unranked',
            queue_position: application.queue_position ?? null,
            waitlist_position: application.waitlist_position ?? null,
            selection_batch_id: application.selection_batch_id || null,
            selected_at: application.selected_at || null,
            waitlisted_at: application.waitlisted_at || null,
            finalized_at: application.finalized_at || null,
            activation_status: application.activation_status || 'Not Activated',
            activated_at: application.activated_at || null,
            can_reapply: application.can_reapply === true,
            reapplication_reason: application.reapplication_reason || null,
        },
        selection: {
            status: application.selection_status || 'Unranked',
            queue_position: application.queue_position ?? null,
            waitlist_position: application.waitlist_position ?? null,
            requirements_completed_at: application.requirements_completed_at || null,
            requirements_verified_at: application.requirements_verified_at || null,
            selected_at: application.selected_at || null,
            waitlisted_at: application.waitlisted_at || null,
            finalized_at: application.finalized_at || null,
            activation_status: application.activation_status || 'Not Activated',
            activated_at: application.activated_at || null,
            can_reapply: application.can_reapply === true,
            reapplication_reason: application.reapplication_reason || null,
            allocated_slots: Number(context.opening?.allocated_slots || 0),
            filled_slots: Number(context.opening?.filled_slots || 0),
            available_slots: Math.max(
                Number(context.opening?.allocated_slots || 0) -
                Number(context.opening?.filled_slots || 0),
                0
            ),
            waiting_list_enabled: context.opening?.waiting_list_enabled !== false,
            application_period_status: context.opening?.selection_status || 'Not Started',
            selection_finalized_at: context.opening?.selection_finalized_at || null,
        },
        workflow,
    };
}

async function downloadMyEndorsementSlipPdf(userId) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const student = await getStudent(userId);

    if (!student?.student_id) {
        throw createHttpError(404, 'Student profile not found.');
    }

    const application = await fetchLatestApplication(student.student_id);

    if (!application) {
        throw createHttpError(404, 'Application not found.');
    }

    const { documents, reviews, slip: rawSlip } = await fetchApplicationStatusRows(
        application.application_id
    );
    const slip = await enrichSlipActorNames(rawSlip);
    const requirements = buildRequirementsStatus(application, documents, reviews);
    const endorsement = buildEndorsementStatus(slip);

    if (requirements.status !== 'verified' || endorsement.status !== 'completed') {
        throw createHttpError(
            409,
            'Endorsement slip PDF is only available after verified requirements and completed endorsement.'
        );
    }

    if (!safeText(slip?.final_pdf_path)) {
        throw createHttpError(404, 'Final endorsement slip PDF is not available yet.');
    }

    const { data, error } = await supabase.storage
        .from(ENDORSEMENT_SLIP_BUCKET)
        .download(slip.final_pdf_path);

    if (error) {
        throw createHttpError(500, error.message || 'Failed to download endorsement slip PDF.');
    }

    let buffer;
    if (Buffer.isBuffer(data)) {
        buffer = data;
    } else if (data instanceof ArrayBuffer) {
        buffer = Buffer.from(data);
    } else if (data?.arrayBuffer) {
        buffer = Buffer.from(await data.arrayBuffer());
    } else {
        throw createHttpError(500, 'Unexpected endorsement slip PDF payload.');
    }

    return {
        fileName: `endorsement-slip-${deriveSlipCode(slip.slip_id)}.pdf`,
        contentType: data?.type || 'application/pdf',
        buffer,
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
        'jpg',
        'jpeg',
        'png',
        'webp',
    ]);

    const originalName = file.originalname || '';
    const extension = originalName.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.has(extension)) {
        throw createHttpError(
            400,
            'Invalid file type. Use PDF, JPG, JPEG, PNG, or WEBP.'
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

    const { data: previousDocument, error: previousDocumentError } = await supabase
        .from('application_documents')
        .select('file_path')
        .eq('document_id', documentId)
        .maybeSingle();

    if (previousDocumentError) throw previousDocumentError;

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

    if (previousDocument?.file_path && previousDocument.file_path !== filePath) {
        await supabase.storage.from('documents').remove([previousDocument.file_path]);
    }

    const { data: submittedDocuments, error: submittedDocumentsError } = await supabase
        .from('application_documents')
        .select('document_type, is_submitted, file_path, file_url')
        .eq('application_id', application.application_id);

    if (submittedDocumentsError) throw submittedDocumentsError;

    const completedTypes = new Set(
        (submittedDocuments || [])
            .filter((row) => row.is_submitted === true && (safeText(row.file_path) || safeText(row.file_url)))
            .map((row) => normalizeRequiredDocumentType(row.document_type).toLowerCase())
    );
    const allRequiredUploaded = REQUIRED_UPLOAD_DOCUMENT_TYPES.every((type) =>
        completedTypes.has(type.toLowerCase())
    );

    await supabase
        .from('applications')
        .update({
            document_status: allRequiredUploaded ? 'Documents Ready' : 'Missing Docs',
        })
        .eq('application_id', application.application_id);

    return getMyDocuments(userId);
}

function normalizeRequiredDocumentType(value) {
    const text = String(value || '').trim().toLowerCase();

    if (
        text.includes('birth certificate') ||
        text.includes('certificate of live birth') ||
        text === 'psa' ||
        text === 'nso'
    ) {
        return 'Birth Certificate / PSA';
    }

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

function numericOrNull(value) {
    const text = safeText(value).replace(',', '.');
    if (!text) return null;

    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalGwa(value) {
    const parsed = numericOrNull(value);
    if (parsed === null) return null;
    if (parsed < 1 || parsed > 5) {
        throw createHttpError(400, 'GWA must be between 1.00 and 5.00.');
    }
    return parsed;
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
    const highestEducationalAttainment = normalizeEducationalAttainment(
        data.highest_educational_attainment || data.educational_attainment
    );

    return {
        student_id: studentId,
        relation,
        last_name: safeText(data.last_name),
        first_name: safeText(data.first_name),
        middle_name: safeText(data.middle_name),
        mobile_number: safeText(data.mobile_number || data.mobile),
        address: safeText(data.address || extra.parent_guardian_address),
        highest_educational_attainment: highestEducationalAttainment,
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
        'Birth Certificate / PSA',
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

async function ensureApplicationEndorsementSlip(application = {}) {
    if (!application?.application_id || !application?.student_id) return;

    const { error } = await supabase
        .from('endorsement_slips')
        .insert({
            application_id: application.application_id,
            student_id: application.student_id,
            opening_id: application.opening_id || null,
            current_stage: 'pending_sdo',
            overall_status: 'pending_sdo',
        });

    if (!error) return;

    if (error.code === '23505') {
        return;
    }

    if (isMissingSchemaError(error)) {
        throw createHttpError(
            500,
            'Endorsement slip schema is not installed for application tracking.'
        );
    }

    throw error;
}


function isBlankSubmissionValue(value) {
    return (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '')
    );
}

function mergeMissingSubmissionValues(primary, fallback) {
    if (
        fallback === null ||
        fallback === undefined ||
        typeof fallback !== 'object' ||
        Array.isArray(fallback)
    ) {
        return isBlankSubmissionValue(primary) ? fallback : primary;
    }

    const primaryObject =
        primary && typeof primary === 'object' && !Array.isArray(primary)
            ? primary
            : {};
    const merged = { ...primaryObject };

    Object.entries(fallback).forEach(([key, fallbackValue]) => {
        const primaryValue = primaryObject[key];

        if (
            fallbackValue &&
            typeof fallbackValue === 'object' &&
            !Array.isArray(fallbackValue)
        ) {
            merged[key] = mergeMissingSubmissionValues(
                primaryValue,
                fallbackValue
            );
            return;
        }

        if (isBlankSubmissionValue(primaryValue)) {
            merged[key] = fallbackValue;
        }
    });

    return merged;
}

function collectMissingSubmissionFields(payload = {}) {
    const personal = payload.personal || {};
    const address = payload.address || {};
    const contact = payload.contact || {};
    const academic = payload.academic || {};
    const essays = payload.essays || {};

    const requiredFields = [
        {
            label: 'First name',
            value: personal.first_name || personal.firstName,
        },
        {
            label: 'Last name',
            value: personal.last_name || personal.lastName,
        },
        {
            label: 'Date of birth',
            value: personal.date_of_birth || personal.dateOfBirth,
        },
        {
            label: 'Place of birth',
            value: personal.place_of_birth || personal.placeOfBirth,
        },
        {
            label: 'Sex',
            value: personal.sex || personal.sex_at_birth,
        },
        {
            label: 'Civil status',
            value: personal.civil_status || personal.civilStatus,
        },
        {
            label: 'Religion',
            value: personal.religion,
        },
        {
            label: 'Mobile number',
            value:
                contact.mobile_number ||
                contact.mobile ||
                contact.phone_number,
        },
        {
            label: 'Barangay',
            value:
                address.barangay ||
                address.barangay_name ||
                address.current_barangay,
        },
        {
            label: 'City or municipality',
            value:
                address.city_municipality ||
                address.city ||
                address.municipality,
        },
        {
            label: 'Province',
            value: address.province,
        },
        {
            label: 'Course',
            value:
                academic.course ||
                academic.course_code ||
                academic.course_name ||
                academic.current_course ||
                academic.current_course_code ||
                academic.current_course_name,
        },
        {
            label: 'Year level',
            value:
                academic.year_level ||
                academic.current_year_level,
        },
        {
            label: 'Self-description',
            value:
                essays.self_description ||
                essays.describe_yourself_essay,
        },
        {
            label: 'Aims and ambitions',
            value:
                essays.aims_and_ambitions ||
                essays.aims_and_ambition_essay,
        },
    ];

    return requiredFields
        .filter((field) => !safeText(field.value))
        .map((field) => field.label);
}

function validateApplicationSubmissionPayload(payload = {}) {
    const missingFields = collectMissingSubmissionFields(payload);

    if (missingFields.length > 0) {
        throw createHttpError(
            400,
            `Complete the following required fields: ${missingFields.join(', ')}.`
        );
    }
}

async function submitMyApplicationForm(userId, payload = {}) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    // The mobile client may omit values that were already loaded from the
    // registry/profile database. Rehydrate only blank values before validation
    // so valid stored information is not requested from the applicant again.
    const storedFormData = await getMyFormData(userId);
    payload = mergeMissingSubmissionValues(payload, storedFormData || {});

    const student = await ensureStudentForUser(userId);

    if (!student?.student_id) {
        throw createHttpError(400, 'Student profile is required.');
    }

    const master = await getMasterStudent(student.master_student_id);
    const resolvedCourseId = firstNonEmpty(
        student.course_id,
        master?.course_id
    );
    const resolvedCourse = resolvedCourseId
        ? await getCourse(resolvedCourseId)
        : null;

    const sourceAcademic = payload.academic || {};
    payload = {
        ...payload,
        address: {
            ...(payload.address || {}),
            barangay: firstNonEmpty(
                payload.address?.barangay,
                payload.address?.barangay_name,
                payload.address?.current_barangay,
                storedFormData?.address?.barangay
            ),
            city_municipality: firstNonEmpty(
                payload.address?.city_municipality,
                payload.address?.city,
                payload.address?.municipality,
                storedFormData?.address?.city_municipality,
                storedFormData?.address?.city
            ),
            province: firstNonEmpty(
                payload.address?.province,
                storedFormData?.address?.province
            ),
        },
        academic: {
            ...sourceAcademic,
            current_course: firstNonEmpty(
                sourceAcademic.current_course,
                sourceAcademic.course,
                sourceAcademic.current_course_code,
                sourceAcademic.course_code,
                resolvedCourse?.course_code,
                resolvedCourse?.course_name
            ),
            current_course_code: firstNonEmpty(
                sourceAcademic.current_course_code,
                sourceAcademic.course_code,
                resolvedCourse?.course_code
            ),
            current_course_name: firstNonEmpty(
                sourceAcademic.current_course_name,
                sourceAcademic.course_name,
                resolvedCourse?.course_name
            ),
            current_year_level: firstNonEmpty(
                sourceAcademic.current_year_level,
                sourceAcademic.year_level,
                student.year_level,
                master?.year_level
            ),
            year_level: firstNonEmpty(
                sourceAcademic.year_level,
                sourceAcademic.current_year_level,
                student.year_level,
                master?.year_level
            ),
        },
    };

    validateApplicationSubmissionPayload(payload);

    const openingId =
        safeText(payload.opening_id) ||
        safeText(payload.openingId) ||
        safeText(payload.opening?.opening_id) ||
        safeText(payload.account?.opening_id);

    if (!openingId) {
        throw createHttpError(400, 'Scholarship selection is required.');
    }

    const { data: opening, error: openingError } = await supabase
        .from('program_openings')
        .select('opening_id, program_id, posting_status, is_archived')
        .eq('opening_id', openingId)
        .maybeSingle();

    if (openingError) throw openingError;

    if (!opening) {
        throw createHttpError(404, 'Scholarship not found.');
    }

    if (opening.is_archived || opening.posting_status !== 'open') {
        throw createHttpError(400, 'This scholarship is not accepting applications.');
    }

    const personal = payload.personal || {};
    const address = payload.address || {};
    const contact = payload.contact || {};
    const family = payload.family || {};
    const academic = payload.academic || {};
    const support = payload.support || {};
    const discipline = payload.discipline || {};
    const essays = payload.essays || {};
    const submittedGwa = parseOptionalGwa(academic.gwa);

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

    const studentUpdatePayload = {
        is_profile_complete: true,
        updated_at: new Date().toISOString(),
    };

    if (submittedGwa !== null) {
        studentUpdatePayload.gwa = submittedGwa;
    }

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
    await ensureApplicationEndorsementSlip(application);

    await supabase
        .from('students')
        .update(studentUpdatePayload)
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
    getMyApplicationStatusSummary,
    downloadMyEndorsementSlipPdf,
    uploadMyDocument,
    submitMyApplicationForm,
};
