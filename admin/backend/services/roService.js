const supabase = require('../config/supabase');

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function fullName(student = {}) {
    return [
        student.first_name,
        student.middle_name,
        student.last_name,
    ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isClearedStatus(status) {
    return normalizeText(status) === 'cleared';
}

function extractAvatarStoragePath(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return null;

    if (!/^https?:\/\//i.test(rawValue)) {
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
            return rawValue.slice(markerIndex + marker.length).split('?')[0];
        }
    }

    return null;
}

async function resolveAvatarUrl(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return null;

    const storagePath = extractAvatarStoragePath(rawValue);
    if (!storagePath) return rawValue;

    const { data, error } = await supabase.storage
        .from('avatars')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    if (error) return rawValue;

    return data?.signedUrl || rawValue;
}

exports.getSummary = async () => {
    const { data, error } = await supabase
        .from('return_of_obligations')
        .select('ro_status');

    if (error) throw new Error(error.message);

    let pending = 0;
    let cleared = 0;

    for (const row of data || []) {
        if (row.ro_status === 'Cleared') cleared += 1;
        else pending += 1;
    }

    return {
        pending,
        cleared,
        total: pending + cleared,
    };
};

exports.getROScholars = async (filters = {}) => {
    const {
        search = '',
        courseId = 'all',
        yearLevel = 'all',
        openingId = 'all',
        status = 'all',
    } = filters || {};

    let applicationQuery = supabase
        .from('applications')
        .select(`
            application_id,
            student_id,
            program_id,
            opening_id,
            application_status,
            submission_date
        `)
        .in('application_status', ['Approved', 'Approved Scholar', 'Accepted'])
        .order('submission_date', { ascending: false });

    if (openingId && openingId !== 'all') {
        applicationQuery = applicationQuery.eq('opening_id', openingId);
    }

    const { data: applications, error: applicationError } = await applicationQuery;

    if (applicationError) throw new Error(applicationError.message);

    const approvedApplications = applications || [];

    if (approvedApplications.length === 0) {
        return [];
    }

    const studentIds = [
        ...new Set(approvedApplications.map((app) => app.student_id).filter(Boolean)),
    ];

    const programIds = [
        ...new Set(approvedApplications.map((app) => app.program_id).filter(Boolean)),
    ];

    const openingIds = [
        ...new Set(approvedApplications.map((app) => app.opening_id).filter(Boolean)),
    ];

    const applicationIds = [
        ...new Set(approvedApplications.map((app) => app.application_id).filter(Boolean)),
    ];

    let studentQuery = supabase
        .from('students')
        .select(`
            student_id,
            pdm_id,
            first_name,
            middle_name,
            last_name,
            year_level,
            profile_photo_url,
            is_active_scholar,
            course_id
        `)
        .in('student_id', studentIds)
        .eq('is_active_scholar', true);

    if (courseId && courseId !== 'all') {
        studentQuery = studentQuery.eq('course_id', courseId);
    }

    if (yearLevel && yearLevel !== 'all') {
        studentQuery = studentQuery.eq('year_level', yearLevel);
    }

    const { data: students, error: studentError } = await studentQuery;

    if (studentError) throw new Error(studentError.message);

    const filteredStudents = students || [];

    if (filteredStudents.length === 0) {
        return [];
    }

    const filteredStudentIdSet = new Set(
        filteredStudents.map((student) => student.student_id)
    );

    const finalApplications = approvedApplications.filter((app) =>
        filteredStudentIdSet.has(app.student_id)
    );

    if (finalApplications.length === 0) {
        return [];
    }

    const courseIds = [
        ...new Set(filteredStudents.map((student) => student.course_id).filter(Boolean)),
    ];

    const finalProgramIds = [
        ...new Set(finalApplications.map((app) => app.program_id).filter(Boolean)),
    ];

    const finalOpeningIds = [
        ...new Set(finalApplications.map((app) => app.opening_id).filter(Boolean)),
    ];

    const finalApplicationIds = [
        ...new Set(finalApplications.map((app) => app.application_id).filter(Boolean)),
    ];

    const [
        courseResult,
        programResult,
        openingResult,
        roResult,
    ] = await Promise.all([
        courseIds.length
            ? supabase
                .from('academic_course')
                .select('course_id, course_code, course_name')
                .in('course_id', courseIds)
            : Promise.resolve({ data: [], error: null }),

        finalProgramIds.length
            ? supabase
                .from('scholarship_program')
                .select('program_id, program_name, benefactor_id')
                .in('program_id', finalProgramIds)
            : Promise.resolve({ data: [], error: null }),

        finalOpeningIds.length
            ? supabase
                .from('program_openings')
                .select('opening_id, opening_title, posting_status')
                .in('opening_id', finalOpeningIds)
            : Promise.resolve({ data: [], error: null }),

        finalApplicationIds.length
            ? supabase
                .from('return_of_obligations')
                .select(`
                    ro_id,
                    student_id,
                    application_id,
                    opening_id,
                    program_id,
                    ro_status,
                    cleared_at,
                    cleared_by,
                    remarks,
                    created_at,
                    updated_at
                `)
                .in('application_id', finalApplicationIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (courseResult.error) throw new Error(courseResult.error.message);
    if (programResult.error) throw new Error(programResult.error.message);
    if (openingResult.error) throw new Error(openingResult.error.message);
    if (roResult.error) throw new Error(roResult.error.message);

    const programs = programResult.data || [];
    const benefactorIds = [
        ...new Set(programs.map((program) => program.benefactor_id).filter(Boolean)),
    ];

    const { data: benefactors, error: benefactorError } = benefactorIds.length
        ? await supabase
            .from('benefactors')
            .select('benefactor_id, benefactor_name')
            .in('benefactor_id', benefactorIds)
        : { data: [], error: null };

    if (benefactorError) throw new Error(benefactorError.message);

    const studentMap = new Map(
        filteredStudents.map((student) => [student.student_id, student])
    );

    const courseMap = new Map(
        (courseResult.data || []).map((course) => [course.course_id, course])
    );

    const programMap = new Map(
        programs.map((program) => [program.program_id, program])
    );

    const benefactorMap = new Map(
        (benefactors || []).map((benefactor) => [
            benefactor.benefactor_id,
            benefactor,
        ])
    );

    const openingMap = new Map(
        (openingResult.data || []).map((opening) => [opening.opening_id, opening])
    );

    const roByApplication = new Map();

    for (const ro of roResult.data || []) {
        if (ro.application_id) {
            roByApplication.set(ro.application_id, ro);
        }
    }

    const searchNeedle = normalizeText(search);

    const rows = await Promise.all(
        finalApplications.map(async (app) => {
            const student = studentMap.get(app.student_id);
            if (!student) return null;

            const course = courseMap.get(student.course_id) || {};
            const program = programMap.get(app.program_id) || {};
            const benefactor = benefactorMap.get(program.benefactor_id) || {};
            const opening = openingMap.get(app.opening_id) || {};
            const ro = roByApplication.get(app.application_id) || null;

            const name = fullName(student) || 'Unknown Scholar';
            const cleared = !!ro && isClearedStatus(ro.ro_status);

            return {
                student_id: student.student_id,
                pdm_id: student.pdm_id,
                first_name: student.first_name,
                middle_name: student.middle_name,
                last_name: student.last_name,
                name,
                year_level: student.year_level,
                profile_photo_url: await resolveAvatarUrl(student.profile_photo_url),
                is_active_scholar: student.is_active_scholar,

                course_id: student.course_id,
                course_code: course.course_code || null,
                course_name: course.course_name || null,

                application_id: app.application_id,
                application_status: app.application_status,
                submission_date: app.submission_date,

                program_id: app.program_id,
                program_name: program.program_name || 'Scholarship Program',
                benefactor_name: benefactor.benefactor_name || null,

                opening_id: app.opening_id,
                opening_title: opening.opening_title || 'Scholarship Opening',
                opening_status: opening.posting_status || null,

                ro_id: ro?.ro_id || null,
                ro_status: cleared ? 'Cleared' : 'Pending',
                is_cleared: cleared,
                cleared_at: ro?.cleared_at || null,
                remarks: ro?.remarks || null,
            };
        })
    );

    let finalRows = rows.filter(Boolean);

    if (searchNeedle) {
        finalRows = finalRows.filter((row) => {
            const haystack = normalizeText([
                row.name,
                row.pdm_id,
                row.course_code,
                row.course_name,
                row.program_name,
                row.opening_title,
                row.benefactor_name,
            ].filter(Boolean).join(' '));

            return haystack.includes(searchNeedle);
        });
    }

    if (status === 'cleared') {
        finalRows = finalRows.filter((row) => row.is_cleared);
    }

    if (status === 'pending') {
        finalRows = finalRows.filter((row) => !row.is_cleared);
    }

    return finalRows;
};

exports.clearScholarRO = async (studentId, payload = {}, user = {}) => {
    const {
        openingId = null,
        applicationId = null,
        programId = null,
        remarks = 'Marked as cleared by RO admin.',
    } = payload || {};

    if (!studentId) {
        throw new Error('Student ID is required');
    }

    let applicationQuery = supabase
        .from('applications')
        .select(`
            application_id,
            student_id,
            opening_id,
            program_id,
            application_status
        `)
        .eq('student_id', studentId)
        .in('application_status', ['Approved', 'Approved Scholar', 'Accepted'])
        .order('submission_date', { ascending: false })
        .limit(1);

    if (applicationId) {
        applicationQuery = applicationQuery.eq('application_id', applicationId);
    }

    if (openingId) {
        applicationQuery = applicationQuery.eq('opening_id', openingId);
    }

    const { data: application, error: applicationError } =
        await applicationQuery.maybeSingle();

    if (applicationError) throw new Error(applicationError.message);

    if (!application) {
        throw new Error('Approved scholarship application not found for this student.');
    }

    const finalApplicationId = application.application_id;
    const finalOpeningId = application.opening_id || openingId || null;
    const finalProgramId = application.program_id || programId || null;

    const { data: existingRO, error: existingError } = await supabase
        .from('return_of_obligations')
        .select('ro_id')
        .eq('student_id', studentId)
        .eq('application_id', finalApplicationId)
        .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    const now = new Date().toISOString();
    const adminUserId = user?.userId || user?.user_id || user?.sub || null;

    if (existingRO?.ro_id) {
        const { data, error } = await supabase
            .from('return_of_obligations')
            .update({
                ro_status: 'Cleared',
                cleared_by: adminUserId,
                cleared_at: now,
                remarks,
                updated_at: now,
            })
            .eq('ro_id', existingRO.ro_id)
            .select()
            .single();

        if (error) throw new Error(error.message);

        return {
            message: 'Student RO marked as cleared.',
            clearance: data,
        };
    }

    const { data, error } = await supabase
        .from('return_of_obligations')
        .insert({
            student_id: studentId,
            application_id: finalApplicationId,
            opening_id: finalOpeningId,
            program_id: finalProgramId,
            ro_status: 'Cleared',
            cleared_by: adminUserId,
            cleared_at: now,
            remarks,
            created_at: now,
            updated_at: now,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);

    return {
        message: 'Student RO marked as cleared.',
        clearance: data,
    };
};