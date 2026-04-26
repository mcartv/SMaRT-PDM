const DOCUMENT_TYPE_ALIASES = {
    cor: 'certificate_of_registration',
    certificate_of_registration: 'certificate_of_registration',
    registration: 'certificate_of_registration',

    grade_form: 'student_grade_forms',
    grade_report: 'student_grade_forms',
    report_of_grades: 'student_grade_forms',
    report_of_grade: 'student_grade_forms',

    certificate_of_indigency: 'certificate_of_indigency',
    indigency: 'certificate_of_indigency',

    lor: 'letter_of_request',
    letter_of_request: 'letter_of_request',
    request_letter: 'letter_of_request',

    application_form: 'application_form',
    application: 'application_form',
};

const DOCUMENT_TYPE_TO_NAME = {
    certificate_of_registration: 'Certificate of Registration',
    student_grade_forms: 'Grade Report',
    certificate_of_indigency: 'Certificate of Indigency',
    letter_of_request: 'Letter of Request',
    application_form: 'Application Form',
};

function normalizeDocumentType(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');

    return DOCUMENT_TYPE_ALIASES[normalized] || normalized;
}

module.exports = {
    DOCUMENT_TYPE_ALIASES,
    DOCUMENT_TYPE_TO_NAME,
    normalizeDocumentType,
};
