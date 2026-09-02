'use strict';

const APPLICATION_FIELD_LIMITS = Object.freeze({
    name: 50,
    email: 64,
    shortText: 100,
    addressPart: 120,
    longAddress: 250,
    landline: 20,
    section: 20,
    schoolName: 150,
    schoolAddress: 200,
    honorsOrClub: 200,
    otherSpecify: 150,
    details: 500,
    longExplanation: 1000,
    essay: 2000,
    lrnDigits: 12,
});

const FIELD_RULES = Object.freeze([
    ['personal.first_name', 'First name', APPLICATION_FIELD_LIMITS.name],
    ['personal.middle_name', 'Middle name', APPLICATION_FIELD_LIMITS.name],
    ['personal.last_name', 'Last name', APPLICATION_FIELD_LIMITS.name],
    ['personal.maiden_name', 'Maiden name', APPLICATION_FIELD_LIMITS.name],
    ['personal.place_of_birth', 'Place of birth', APPLICATION_FIELD_LIMITS.shortText],
    ['personal.citizenship', 'Citizenship', APPLICATION_FIELD_LIMITS.shortText],
    ['personal.civil_status', 'Civil status', APPLICATION_FIELD_LIMITS.shortText],
    ['personal.religion', 'Religion', APPLICATION_FIELD_LIMITS.shortText],

    ['address.unit_bldg_no', 'Unit / building number', APPLICATION_FIELD_LIMITS.addressPart],
    ['address.house_lot_block_no', 'House / lot / block number', APPLICATION_FIELD_LIMITS.addressPart],
    ['address.street', 'Street', APPLICATION_FIELD_LIMITS.addressPart],
    ['address.street_address', 'Street address', APPLICATION_FIELD_LIMITS.addressPart],
    ['address.subdivision', 'Subdivision', APPLICATION_FIELD_LIMITS.addressPart],
    ['address.barangay', 'Barangay', APPLICATION_FIELD_LIMITS.shortText],
    ['address.city_municipality', 'City / municipality', APPLICATION_FIELD_LIMITS.shortText],
    ['address.city', 'City / municipality', APPLICATION_FIELD_LIMITS.shortText],
    ['address.province', 'Province', APPLICATION_FIELD_LIMITS.shortText],
    ['address.zip_code', 'ZIP code', APPLICATION_FIELD_LIMITS.shortText],
    ['contact.landline', 'Landline number', APPLICATION_FIELD_LIMITS.landline],
    ['contact.landline_number', 'Landline number', APPLICATION_FIELD_LIMITS.landline],
    ['contact.email', 'Email', APPLICATION_FIELD_LIMITS.email],
    ['contact.email_address', 'Email', APPLICATION_FIELD_LIMITS.email],

    ['family.parent_guardian_address', 'Parent / guardian address', APPLICATION_FIELD_LIMITS.longAddress],
    ['family.parent_previous_town_province', 'Previous province', APPLICATION_FIELD_LIMITS.shortText],
    ['family.parent_previous_town_municipality', 'Previous municipality', APPLICATION_FIELD_LIMITS.shortText],
    ['family.parent_previous_province', 'Previous province', APPLICATION_FIELD_LIMITS.shortText],

    ['academic.college_school', 'College school', APPLICATION_FIELD_LIMITS.schoolName],
    ['academic.college_address', 'College address', APPLICATION_FIELD_LIMITS.schoolAddress],
    ['academic.college_honors', 'College honors', APPLICATION_FIELD_LIMITS.honorsOrClub],
    ['academic.college_club', 'College club / organization', APPLICATION_FIELD_LIMITS.honorsOrClub],
    ['academic.high_school_school', 'Junior high school', APPLICATION_FIELD_LIMITS.schoolName],
    ['academic.high_school_address', 'Junior high school address', APPLICATION_FIELD_LIMITS.schoolAddress],
    ['academic.high_school_honors', 'Junior high school honors', APPLICATION_FIELD_LIMITS.honorsOrClub],
    ['academic.high_school_club', 'Junior high school club / organization', APPLICATION_FIELD_LIMITS.honorsOrClub],
    ['academic.senior_high_school', 'Senior high school', APPLICATION_FIELD_LIMITS.schoolName],
    ['academic.senior_high_address', 'Senior high school address', APPLICATION_FIELD_LIMITS.schoolAddress],
    ['academic.senior_high_honors', 'Senior high school honors', APPLICATION_FIELD_LIMITS.honorsOrClub],
    ['academic.senior_high_club', 'Senior high school club / organization', APPLICATION_FIELD_LIMITS.honorsOrClub],
    ['academic.elementary_school', 'Elementary school', APPLICATION_FIELD_LIMITS.schoolName],
    ['academic.elementary_address', 'Elementary school address', APPLICATION_FIELD_LIMITS.schoolAddress],
    ['academic.elementary_honors', 'Elementary honors', APPLICATION_FIELD_LIMITS.honorsOrClub],
    ['academic.elementary_club', 'Elementary club / organization', APPLICATION_FIELD_LIMITS.honorsOrClub],
    ['academic.current_course_code', 'Current course', APPLICATION_FIELD_LIMITS.shortText],
    ['academic.current_course', 'Current course', APPLICATION_FIELD_LIMITS.shortText],
    ['academic.current_section', 'Section', APPLICATION_FIELD_LIMITS.section],
    ['academic.section', 'Section', APPLICATION_FIELD_LIMITS.section],
    ['academic.student_number', 'Student number', APPLICATION_FIELD_LIMITS.shortText],
    ['academic.lrn', 'Learner reference number', APPLICATION_FIELD_LIMITS.lrnDigits],
    ['academic.learners_reference_number', 'Learner reference number', APPLICATION_FIELD_LIMITS.lrnDigits],

    ['support.financial_support_other', 'Other financial support', APPLICATION_FIELD_LIMITS.otherSpecify],
    ['support.scholarship_others_specify', 'Other scholarship', APPLICATION_FIELD_LIMITS.otherSpecify],
    ['support.scholarship_details', 'Scholarship details', APPLICATION_FIELD_LIMITS.details],
    ['support.prior_scholarship_details', 'Scholarship details', APPLICATION_FIELD_LIMITS.details],
    ['discipline.disciplinary_explanation', 'Disciplinary explanation', APPLICATION_FIELD_LIMITS.longExplanation],
    ['discipline.disciplinary_details', 'Disciplinary explanation', APPLICATION_FIELD_LIMITS.longExplanation],
    ['essays.describe_yourself_essay', 'Describe yourself essay', APPLICATION_FIELD_LIMITS.essay],
    ['essays.self_description', 'Describe yourself essay', APPLICATION_FIELD_LIMITS.essay],
    ['essays.aims_and_ambition_essay', 'Aims and ambition essay', APPLICATION_FIELD_LIMITS.essay],
    ['essays.aims_and_ambitions', 'Aims and ambition essay', APPLICATION_FIELD_LIMITS.essay],
]);

const FAMILY_MEMBER_RULES = Object.freeze([
    ['last_name', 'last name', APPLICATION_FIELD_LIMITS.name],
    ['first_name', 'first name', APPLICATION_FIELD_LIMITS.name],
    ['middle_name', 'middle name', APPLICATION_FIELD_LIMITS.name],
    ['educational_attainment', 'educational attainment', APPLICATION_FIELD_LIMITS.shortText],
    ['highest_educational_attainment', 'educational attainment', APPLICATION_FIELD_LIMITS.shortText],
    ['occupation', 'occupation', APPLICATION_FIELD_LIMITS.shortText],
    ['company_name_and_address', 'company name / address', APPLICATION_FIELD_LIMITS.longAddress],
    ['company_name_address', 'company name / address', APPLICATION_FIELD_LIMITS.longAddress],
    ['address', 'address', APPLICATION_FIELD_LIMITS.longAddress],
]);

function readPath(source, pathValue) {
    return pathValue.split('.').reduce((current, segment) => {
        if (!current || typeof current !== 'object') return undefined;
        return current[segment];
    }, source);
}

function validationError(label, maxLength) {
    const error = new Error(`${label} must not exceed ${maxLength} characters.`);
    error.statusCode = 400;
    error.code = 'APPLICATION_FIELD_TOO_LONG';
    return error;
}

function assertMaxLength(value, maxLength, label) {
    if (value === null || value === undefined) return;
    if (typeof value !== 'string' && typeof value !== 'number') return;
    if (String(value).length > maxLength) {
        throw validationError(label, maxLength);
    }
}

function validateFamilyMember(member, relationLabel) {
    if (!member || typeof member !== 'object' || Array.isArray(member)) return;
    for (const [key, label, maxLength] of FAMILY_MEMBER_RULES) {
        assertMaxLength(member[key], maxLength, `${relationLabel} ${label}`);
    }
}

function validateApplicationFieldLimits(payload = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;

    for (const [pathValue, label, maxLength] of FIELD_RULES) {
        assertMaxLength(readPath(payload, pathValue), maxLength, label);
    }

    const family = payload.family;
    if (family && typeof family === 'object' && !Array.isArray(family)) {
        for (const [key, label] of [
            ['father', 'Father'],
            ['mother', 'Mother'],
            ['sibling', 'Sibling'],
            ['guardian', 'Guardian'],
        ]) {
            validateFamilyMember(family[key], label);
        }
    }

    const supportChoices = payload.support?.financial_support_choices;
    if (Array.isArray(supportChoices)) {
        for (const value of supportChoices) {
            assertMaxLength(
                value,
                APPLICATION_FIELD_LIMITS.shortText,
                'Financial support option'
            );
        }
    }
}

module.exports = {
    APPLICATION_FIELD_LIMITS,
    validateApplicationFieldLimits,
};
