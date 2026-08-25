const fs = require('fs');
const path = require('path');

const target = path.resolve(
  process.cwd(),
  'backend/src/services/applicationService.js'
);

if (!fs.existsSync(target)) {
  console.error(`File not found: ${target}`);
  console.error('Run this script from the SMaRT-PDM project root.');
  process.exit(1);
}

let source = fs.readFileSync(target, 'utf8');
const original = source;

function replaceOnce(oldText, newText, label) {
  if (!source.includes(oldText)) {
    console.error(`Could not locate: ${label}`);
    process.exit(1);
  }
  source = source.replace(oldText, newText);
}

// 1. Include the master-record course_id in the prefill query.
replaceOnce(
`  email_address,
  phone_number,
  course_id,
  year_level,`,
`  email_address,
  phone_number,
  course_id,
  year_level,`,
'student_master_records course_id'
);

// The supplied file may already contain course_id. If not, insert it.
if (!/from\('student_master_records'\)[\s\S]*?phone_number,\s*\n\s*course_id,/m.test(source)) {
  replaceOnce(
`  email_address,
  phone_number,
  year_level,`,
`  email_address,
  phone_number,
  course_id,
  year_level,`,
'master course_id selection'
  );
}

// 2. Allow every course field used by the mobile form and database fallback.
replaceOnce(
`function validateApplicationSubmissionPayload(payload = {}) {
    const personal = payload.personal || {};
    const address = payload.address || {};
    const contact = payload.contact || {};
    const academic = payload.academic || {};
    const essays = payload.essays || {};

    requireSubmissionText(personal.first_name || personal.firstName, 'First name');
    requireSubmissionText(personal.last_name || personal.lastName, 'Last name');
    requireSubmissionText(personal.date_of_birth || personal.dateOfBirth, 'Date of birth');
    requireSubmissionText(personal.place_of_birth || personal.placeOfBirth, 'Place of birth');
    requireSubmissionText(personal.sex || personal.sex_at_birth, 'Sex');
    requireSubmissionText(personal.civil_status || personal.civilStatus, 'Civil status');
    requireSubmissionText(personal.religion, 'Religion');
    requireSubmissionText(contact.mobile_number || contact.mobile, 'Mobile number');
    requireSubmissionText(address.barangay, 'Barangay');
    requireSubmissionText(address.city_municipality || address.city, 'City or municipality');
    requireSubmissionText(address.province, 'Province');
    requireSubmissionText(academic.course || academic.current_course, 'Course');
    requireSubmissionText(academic.year_level || academic.current_year_level, 'Year level');
    requireSubmissionText(essays.self_description || essays.describe_yourself_essay, 'Self-description');
    requireSubmissionText(essays.aims_and_ambitions || essays.aims_and_ambition_essay, 'Aims and ambitions');
}`,
`function validateApplicationSubmissionPayload(payload = {}, fallback = {}) {
    const personal = payload.personal || {};
    const address = payload.address || {};
    const contact = payload.contact || {};
    const academic = payload.academic || {};
    const essays = payload.essays || {};

    requireSubmissionText(personal.first_name || personal.firstName, 'First name');
    requireSubmissionText(personal.last_name || personal.lastName, 'Last name');
    requireSubmissionText(personal.date_of_birth || personal.dateOfBirth, 'Date of birth');
    requireSubmissionText(personal.place_of_birth || personal.placeOfBirth, 'Place of birth');
    requireSubmissionText(personal.sex || personal.sex_at_birth, 'Sex');
    requireSubmissionText(personal.civil_status || personal.civilStatus, 'Civil status');
    requireSubmissionText(personal.religion, 'Religion');
    requireSubmissionText(contact.mobile_number || contact.mobile, 'Mobile number');
    requireSubmissionText(address.barangay, 'Barangay');
    requireSubmissionText(address.city_municipality || address.city, 'City or municipality');
    requireSubmissionText(address.province, 'Province');

    requireSubmissionText(
        firstNonEmpty(
            academic.course,
            academic.course_code,
            academic.course_name,
            academic.current_course,
            academic.current_course_code,
            academic.current_course_name,
            fallback.course_id,
            fallback.course_code,
            fallback.course_name
        ),
        'Course'
    );

    requireSubmissionText(
        firstNonEmpty(
            academic.year_level,
            academic.current_year_level,
            fallback.year_level
        ),
        'Year level'
    );

    requireSubmissionText(
        essays.self_description || essays.describe_yourself_essay,
        'Self-description'
    );
    requireSubmissionText(
        essays.aims_and_ambitions || essays.aims_and_ambition_essay,
        'Aims and ambitions'
    );
}`,
'application submission validation'
);

// 3. Validate after loading the student, master record, and course fallback.
replaceOnce(
`    validateApplicationSubmissionPayload(payload);

    const student = await ensureStudentForUser(userId);

    if (!student?.student_id) {
        throw createHttpError(400, 'Student profile is required.');
    }`,
`    await ensureStudentForUser(userId);

    const student = await getStudent(userId);

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
    const normalizedAcademic = {
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
    };

    payload = {
        ...payload,
        academic: normalizedAcademic,
    };

    validateApplicationSubmissionPayload(payload, {
        course_id: resolvedCourseId,
        course_code: resolvedCourse?.course_code,
        course_name: resolvedCourse?.course_name,
        year_level: firstNonEmpty(student.year_level, master?.year_level),
    });`,
'submit validation order'
);

// 4. Fix form prefill when students.course_id is empty but the master record has it.
replaceOnce(
`    const [master, profile, course, familyRows, educationRows, opening] =
        await Promise.all([
            getMasterStudent(student.master_student_id),
            getStudentProfile(student.student_id),
            getCourse(student.course_id),
            getFamilyRows(student.student_id),
            getEducationRows(student.student_id),
            getOpening(draft?.opening_id || draftPayload.opening?.opening_id),
        ]);`,
`    const [master, profile, studentCourse, familyRows, educationRows, opening] =
        await Promise.all([
            getMasterStudent(student.master_student_id),
            getStudentProfile(student.student_id),
            getCourse(student.course_id),
            getFamilyRows(student.student_id),
            getEducationRows(student.student_id),
            getOpening(draft?.opening_id || draftPayload.opening?.opening_id),
        ]);

    const course =
        studentCourse ||
        (master?.course_id ? await getCourse(master.course_id) : null);`,
'course prefill fallback'
);

const backup = `${target}.before-course-fix`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(target, backup);
}

fs.writeFileSync(target, source, 'utf8');

console.log('Updated:', target);
console.log('Backup:', backup);
console.log('Course validation now accepts mobile aliases and database fallback.');
