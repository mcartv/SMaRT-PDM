const supabase = require('../config/supabase');
const _ = require('lodash');

function getOrdinalSuffix(n) {
    const num = Number(n);
    if (num === 1) return 'st';
    if (num === 2) return 'nd';
    if (num === 3) return 'rd';
    return 'th';
}

exports.fetchApplications = async () => {
    const { data, error } = await supabase
        .from('applications')
        .select(`
            application_id,
            application_status,
            submission_date,
            document_status,
            is_disqualified,
            disqualification_reason,
            students ( first_name, last_name, pdm_id, gwa ),
            scholarship_programs ( program_name )
        `);

    if (error) {
        console.error('Supabase Fetch Error:', error);
        throw new Error(error.message);
    }

    const processed = _.map(data, (app) => ({
        id: app.application_id,
        name: `${_.get(app, 'students.last_name', 'Unknown')}, ${_.get(app, 'students.first_name', 'Student')}`,
        student_number: _.get(app, 'students.pdm_id', 'N/A'),
        program: _.get(app, 'scholarship_programs.program_name', 'General'),
        submitted: app.submission_date,
        status: _.toLower(app.application_status || ''),
        document_status: _.toLower(app.document_status || 'missing docs'),
        disqualified: !!app.is_disqualified,
        disqReason: app.disqualification_reason,
        gwa: _.get(app, 'students.gwa', 0),
    }));

    return _.orderBy(processed, ['submitted'], ['desc']);
};

exports.fetchApplicationDocumentsById = async (id) => {
    const { data, error } = await supabase
        .from('applications')
        .select(`
            application_id,
            application_status,
            document_status,
            submission_date,
            is_disqualified,
            disqualification_reason,
            letter_of_intent_url,
            certificate_of_registration_url,
            grade_form_url,
            certificate_of_indigency_url,
            valid_id_url,
            students (
                user_id,
                first_name,
                last_name,
                pdm_id,
                gwa,
                year_level,
                course_id
            ),
            scholarship_programs (
                program_name
            )
        `)
        .eq('application_id', id)
        .single();

    if (error) {
        console.error('Supabase Document Fetch Error:', error);
        throw new Error(error.message);
    }

    const student = data.students || {};

    let userContact = { email: 'N/A', phone_number: 'N/A' };
    if (student.user_id) {
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('email, phone_number')
            .eq('user_id', student.user_id)
            .single();

        if (userError) {
            console.error('Supabase User Fetch Error:', userError);
        } else if (userData) {
            userContact = userData;
        }
    }

    let courseCode = 'N/A';
    if (student.course_id) {
        const { data: courseData, error: courseError } = await supabase
            .from('academic_course')
            .select('course_code')
            .eq('course_id', student.course_id)
            .single();

        if (courseError) {
            console.error('Supabase Course Fetch Error:', courseError);
        } else if (courseData) {
            courseCode = courseData.course_code;
        }
    }

    const docs = [
        {
            id: 'loi',
            name: 'Letter of Intent',
            url: data.letter_of_intent_url || null,
            status: data.letter_of_intent_url ? 'verified' : 'pending',
        },
        {
            id: 'cor',
            name: 'Certificate of Registration',
            url: data.certificate_of_registration_url || null,
            status: data.certificate_of_registration_url ? 'verified' : 'pending',
        },
        {
            id: 'grades',
            name: 'Grade Form',
            url: data.grade_form_url || null,
            status: data.grade_form_url ? 'verified' : 'pending',
        },
        {
            id: 'indigency',
            name: 'Certificate of Indigency',
            url: data.certificate_of_indigency_url || null,
            status: data.certificate_of_indigency_url ? 'verified' : 'pending',
        },
        {
            id: 'valid_id',
            name: 'Valid ID',
            url: data.valid_id_url || null,
            status: data.valid_id_url ? 'verified' : 'pending',
        },
    ];

    return {
        id: data.application_id,
        application_status: data.application_status,
        document_status: data.document_status,
        submitted: data.submission_date,
        disqualified: !!data.is_disqualified,
        disqualification_reason: data.disqualification_reason || null,
        student: {
            name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown Student',
            initials: `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() || 'NA',
            pdm_id: student.pdm_id || 'N/A',
            email: userContact.email || 'N/A',
            phone: userContact.phone_number || 'N/A',
            year: student.year_level
                ? `${student.year_level}${getOrdinalSuffix(student.year_level)} Year`
                : 'N/A',
            gwa: student.gwa ?? 'N/A',
            program: data.scholarship_programs?.program_name || 'General',
            course: courseCode,
        },
        documents: docs,
    };
};

exports.markApplicationDisqualified = async (id, reason) => {
    const { data, error } = await supabase
        .from('applications')
        .update({
            is_disqualified: true,
            disqualification_reason: reason,
            application_status: 'Disqualified',
        })
        .eq('application_id', id)
        .select();

    if (error) {
        console.error('Supabase Update Error:', error);
        throw new Error(error.message);
    }

    return data;
};