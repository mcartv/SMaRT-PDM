const supabase = require('../config/supabase');

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeLower(value) {
    return normalizeText(value).toLowerCase();
}

function isRecordArchived(row) {
    return row?.is_archived === true;
}

function isScholarArchived(row) {
    return row?.scholar_is_archived === true;
}

function isActiveScholar(row) {
    const scholarshipStatus = normalizeLower(row?.scholarship_status);

    if (isRecordArchived(row)) return false;
    if (isScholarArchived(row)) return false;
    if (scholarshipStatus === 'removed') return false;

    return row?.is_active_scholar === true || scholarshipStatus === 'active';
}

function fullName(student = {}) {
    return [
        student.first_name,
        student.middle_name,
        student.last_name,
    ]
        .map((part) => normalizeText(part))
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function fetchRows(table, columns = '*', options = {}) {
    try {
        let query = supabase.from(table).select(columns);

        if (options.orderBy) {
            query = query.order(options.orderBy, {
                ascending: options.ascending === true,
                nullsFirst: false,
            });
        }

        const limit = Number(options.limit || 10000);
        query = query.range(0, Math.max(0, limit - 1));

        const { data, error } = await query;

        if (error) {
            console.warn(`[DashboardService] ${table} query skipped:`, error.message);
            return [];
        }

        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn(`[DashboardService] ${table} query failed:`, err.message);
        return [];
    }
}

function countBy(rows, predicate) {
    return rows.filter(predicate).length;
}

function getDateValue(row, keys = []) {
    for (const key of keys) {
        if (row?.[key]) return row[key];
    }

    return null;
}

function countWithinDateRange(rows, keys, start, end) {
    return rows.filter((row) => {
        const value = getDateValue(row, keys);
        if (!value) return false;

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return false;

        return date >= start && date < end;
    }).length;
}

function buildTrend(current, previous) {
    if (!previous && !current) return '0%';
    if (!previous && current) return '+100%';

    const change = ((current - previous) / previous) * 100;
    const rounded = Math.round(change);

    if (rounded > 0) return `+${rounded}%`;
    return `${rounded}%`;
}

function getApplicationStatus(row) {
    if (row?.is_disqualified === true) return 'Disqualified';
    return normalizeText(row?.application_status) || 'Unknown';
}

function getDocumentStatus(row) {
    return (
        normalizeText(row?.document_status) ||
        normalizeText(row?.verification_status) ||
        'Unknown'
    );
}

function isVerifiedDocument(row) {
    const documentStatus = normalizeLower(row?.document_status);
    const verificationStatus = normalizeLower(row?.verification_status);

    return (
        documentStatus.includes('verified') ||
        documentStatus.includes('complete') ||
        verificationStatus === 'verified' ||
        verificationStatus === 'completed'
    );
}

function isPendingReview(row) {
    const status = normalizeLower(row?.application_status);

    return (
        status === 'pending review' ||
        status === 'pending' ||
        status.includes('review')
    );
}

function isApplicationNeedingAction(row) {
    const appStatus = normalizeLower(row?.application_status);
    const docStatus = normalizeLower(row?.document_status);
    const verificationStatus = normalizeLower(row?.verification_status);

    if (row?.is_disqualified === true) return false;
    if (appStatus.includes('approved')) return false;
    if (appStatus.includes('rejected')) return false;

    return (
        appStatus.includes('pending') ||
        appStatus.includes('review') ||
        docStatus.includes('missing') ||
        docStatus.includes('pending') ||
        docStatus.includes('uploaded') ||
        verificationStatus.includes('pending') ||
        verificationStatus.includes('flagged')
    );
}

function groupApplicationStatus(applications) {
    const buckets = {
        'Pending Review': 0,
        'Document Verification': 0,
        Verified: 0,
        Approved: 0,
        Rejected: 0,
        Disqualified: 0,
    };

    applications.forEach((row) => {
        const appStatus = normalizeLower(row.application_status);
        const docStatus = normalizeLower(row.document_status);

        if (row.is_disqualified === true) {
            buckets.Disqualified += 1;
            return;
        }

        if (appStatus.includes('approved')) {
            buckets.Approved += 1;
            return;
        }

        if (appStatus.includes('rejected')) {
            buckets.Rejected += 1;
            return;
        }

        if (isVerifiedDocument(row)) {
            buckets.Verified += 1;
            return;
        }

        if (
            docStatus.includes('missing') ||
            docStatus.includes('uploaded') ||
            docStatus.includes('pending') ||
            appStatus.includes('document')
        ) {
            buckets['Document Verification'] += 1;
            return;
        }

        buckets['Pending Review'] += 1;
    });

    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
}

function groupOpeningStatus(openings) {
    const buckets = {
        Draft: 0,
        Open: 0,
        Filled: 0,
        Closed: 0,
        Archived: 0,
    };

    openings.forEach((row) => {
        if (isRecordArchived(row)) {
            buckets.Archived += 1;
            return;
        }

        const status = normalizeLower(row.posting_status || row.status);

        if (status === 'draft') buckets.Draft += 1;
        else if (status === 'open') buckets.Open += 1;
        else if (status === 'filled') buckets.Filled += 1;
        else if (status === 'closed') buckets.Closed += 1;
        else buckets.Draft += 1;
    });

    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
}

function groupDocumentSummary(applications, ocrJobs) {
    const missing = countBy(applications, (row) =>
        normalizeLower(row.document_status).includes('missing')
    );

    const uploaded = countBy(applications, (row) => {
        const status = normalizeLower(row.document_status);
        return status.includes('uploaded') || status.includes('submitted');
    });

    const verified = countBy(applications, isVerifiedDocument);

    const rejectedFlagged = countBy(applications, (row) => {
        const docStatus = normalizeLower(row.document_status);
        const verificationStatus = normalizeLower(row.verification_status);

        return (
            docStatus.includes('rejected') ||
            docStatus.includes('flagged') ||
            verificationStatus.includes('rejected') ||
            verificationStatus.includes('flagged')
        );
    });

    const ocrQueued = countBy(ocrJobs, (row) => {
        const status = normalizeLower(row.status);
        return status === 'queued' || status === 'in_progress';
    });

    const ocrCompleted = countBy(ocrJobs, (row) => {
        const status = normalizeLower(row.status);
        return status === 'completed';
    });

    return [
        { name: 'Missing', value: missing },
        { name: 'Uploaded', value: uploaded },
        { name: 'OCR Queued', value: ocrQueued },
        { name: 'OCR Done', value: ocrCompleted },
        { name: 'Verified', value: verified },
        { name: 'Flagged', value: rejectedFlagged },
    ];
}

function buildApplicationProgramMaps(applications) {
    const applicationProgramMap = new Map();
    const latestProgramByStudentMap = new Map();

    const sortedApplications = [...applications]
        .filter((application) => !isRecordArchived(application))
        .sort((a, b) => {
            const aDate = new Date(a.submission_date || a.created_at || 0).getTime();
            const bDate = new Date(b.submission_date || b.created_at || 0).getTime();
            return bDate - aDate;
        });

    sortedApplications.forEach((application) => {
        if (application.application_id && application.program_id) {
            applicationProgramMap.set(
                String(application.application_id),
                application.program_id
            );
        }

        if (
            application.student_id &&
            application.program_id &&
            !latestProgramByStudentMap.has(String(application.student_id))
        ) {
            latestProgramByStudentMap.set(
                String(application.student_id),
                application.program_id
            );
        }
    });

    return {
        applicationProgramMap,
        latestProgramByStudentMap,
    };
}

function buildScholarsByBenefactor(students, programs, benefactors, applications = []) {
    const programMap = new Map();
    const benefactorMap = new Map();
    const countMap = new Map();

    const {
        applicationProgramMap,
        latestProgramByStudentMap,
    } = buildApplicationProgramMaps(applications);

    programs
        .filter((program) => !isRecordArchived(program))
        .forEach((program) => {
            programMap.set(String(program.program_id), program);
        });

    benefactors
        .filter((benefactor) => !isRecordArchived(benefactor))
        .forEach((benefactor) => {
            benefactorMap.set(
                String(benefactor.benefactor_id),
                benefactor.benefactor_name || 'Unnamed Benefactor'
            );
        });

    students
        .filter((student) => !isRecordArchived(student))
        .filter((student) => !isScholarArchived(student))
        .filter(isActiveScholar)
        .forEach((student) => {
            const programId =
                student.current_program_id ||
                applicationProgramMap.get(String(student.current_application_id || '')) ||
                latestProgramByStudentMap.get(String(student.student_id || ''));

            if (!programId) {
                countMap.set('No Linked Program', (countMap.get('No Linked Program') || 0) + 1);
                return;
            }

            const program = programMap.get(String(programId));

            if (!program) {
                countMap.set('Program Not Found', (countMap.get('Program Not Found') || 0) + 1);
                return;
            }

            const benefactorId = program.benefactor_id;

            if (!benefactorId) {
                countMap.set('No Linked Benefactor', (countMap.get('No Linked Benefactor') || 0) + 1);
                return;
            }

            const benefactorName =
                benefactorMap.get(String(benefactorId)) ||
                'Benefactor Not Found';

            countMap.set(benefactorName, (countMap.get(benefactorName) || 0) + 1);
        });

    return [...countMap.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
}

function buildRecentApplications(applications, students, openings, programs) {
    const studentMap = new Map();
    const openingMap = new Map();
    const programMap = new Map();

    students.forEach((student) => {
        studentMap.set(String(student.student_id), student);
    });

    openings.forEach((opening) => {
        openingMap.set(String(opening.opening_id), opening);
    });

    programs.forEach((program) => {
        programMap.set(String(program.program_id), program);
    });

    return applications
        .filter((row) => !isRecordArchived(row))
        .filter(isApplicationNeedingAction)
        .sort((a, b) => {
            const aDate = new Date(a.submission_date || a.created_at || 0).getTime();
            const bDate = new Date(b.submission_date || b.created_at || 0).getTime();
            return bDate - aDate;
        })
        .slice(0, 8)
        .map((application) => {
            const student = studentMap.get(String(application.student_id)) || {};
            const opening = openingMap.get(String(application.opening_id)) || {};

            const program =
                programMap.get(String(application.program_id || '')) ||
                programMap.get(String(opening.program_id || '')) ||
                programMap.get(String(student.current_program_id || '')) ||
                {};

            const studentName = fullName(student);

            return {
                application_id: application.application_id,
                student_id: application.student_id,
                student_name: studentName || 'Unknown Student',
                student_number:
                    student.pdm_id ||
                    student.registrar_student_number ||
                    'N/A',
                program_name: program.program_name || 'No Program',
                opening_title: opening.opening_title || 'No Opening',
                application_status: getApplicationStatus(application),
                document_status: getDocumentStatus(application),
                submission_date: application.submission_date || application.created_at || null,
            };
        });
}

function buildSummaryCards({
    applications,
    students,
    openings,
}) {
    const now = new Date();

    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - 30);

    const previousStart = new Date(now);
    previousStart.setDate(previousStart.getDate() - 60);

    const activeApplications = applications.filter((row) => !isRecordArchived(row));

    const activeScholarStudents = students
        .filter((student) => !isRecordArchived(student))
        .filter((student) => !isScholarArchived(student))
        .filter(isActiveScholar);

    const totalApplications = activeApplications.length;
    const pendingReview = countBy(activeApplications, isPendingReview);
    const verifiedDocuments = countBy(activeApplications, isVerifiedDocument);
    const activeScholars = activeScholarStudents.length;

    const currentApps = countWithinDateRange(
        activeApplications,
        ['submission_date', 'created_at'],
        currentStart,
        now
    );

    const previousApps = countWithinDateRange(
        activeApplications,
        ['submission_date', 'created_at'],
        previousStart,
        currentStart
    );

    const verifiedRate = totalApplications
        ? Math.round((verifiedDocuments / totalApplications) * 100)
        : 0;

    const openOpenings = countBy(
        openings,
        (row) => !isRecordArchived(row) && normalizeLower(row.posting_status) === 'open'
    );

    return [
        {
            key: 'total_applications',
            label: 'Total Applications',
            value: totalApplications,
            sub: 'Current active application records',
            trend: buildTrend(currentApps, previousApps),
            up: currentApps >= previousApps,
        },
        {
            key: 'pending_review',
            label: 'Pending Review',
            value: pendingReview,
            sub: 'Applications needing OSFA action',
            trend: 'Needs action',
            up: false,
        },
        {
            key: 'verified_documents',
            label: 'Verified Documents',
            value: verifiedDocuments,
            sub: `${verifiedRate}% of active applications`,
            trend: `${verifiedRate}%`,
            up: true,
        },
        {
            key: 'active_scholars',
            label: 'Active Scholars',
            value: activeScholars,
            sub: `${openOpenings} opening(s) currently open`,
            trend: 'Current',
            up: true,
        },
    ];
}

exports.getAdminDashboard = async () => {
    const [
        applications,
        students,
        openings,
        programs,
        benefactors,
        ocrJobs,
    ] = await Promise.all([
        fetchRows(
            'applications',
            'application_id, student_id, opening_id, program_id, application_status, document_status, verification_status, deficiency_status, is_disqualified, submission_date, created_at, is_archived',
            { orderBy: 'submission_date', ascending: false }
        ),
        fetchRows(
            'students',
            'student_id, pdm_id, registrar_student_number, first_name, middle_name, last_name, is_active_scholar, scholarship_status, current_program_id, current_application_id, is_archived, scholar_is_archived, ro_status'
        ),
        fetchRows(
            'program_openings',
            'opening_id, program_id, opening_title, posting_status, is_archived, created_at, updated_at'
        ),
        fetchRows(
            'scholarship_program',
            'program_id, program_name, benefactor_id, is_archived'
        ),
        fetchRows(
            'benefactors',
            'benefactor_id, benefactor_name, benefactor_type, is_archived'
        ),
        fetchRows(
            'ocr_jobs',
            'id, status, created_at, updated_at'
        ),
    ]);

    const activeApplications = applications.filter((row) => !isRecordArchived(row));

    return {
        generatedAt: new Date().toISOString(),
        summaryCards: buildSummaryCards({
            applications,
            students,
            openings,
        }),
        applicationStatus: groupApplicationStatus(activeApplications),
        openingStatus: groupOpeningStatus(openings),
        documentSummary: groupDocumentSummary(activeApplications, ocrJobs),
        scholarsByBenefactor: buildScholarsByBenefactor(
            students,
            programs,
            benefactors,
            applications
        ),
        recentApplications: buildRecentApplications(
            activeApplications,
            students,
            openings,
            programs
        ),
    };
};