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

function isTerminalApplication(row) {
    const status = normalizeLower(row?.application_status);

    return (
        row?.is_disqualified === true ||
        status.includes('approved') ||
        status.includes('rejected') ||
        status.includes('disqualified')
    );
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

        const limit = Math.min(
            10000,
            Math.max(1, Number(options.limit || 10000))
        );

        query = query.range(0, limit - 1);

        const { data, error } = await query;

        if (error) {
            console.warn(
                `[DashboardService] ${table} query skipped:`,
                error.message
            );
            return [];
        }

        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn(
            `[DashboardService] ${table} query failed:`,
            err.message
        );
        return [];
    }
}

function countBy(rows, predicate) {
    return rows.filter(predicate).length;
}

function getApplicationStatus(row) {
    if (row?.is_disqualified === true) return 'Disqualified';
    return normalizeText(row?.application_status) || 'Unknown';
}

function getRequirementsStatus(row) {
    const verificationStatus = normalizeLower(row?.verification_status);

    if (verificationStatus === 'verified') return 'Verified';
    if (
        verificationStatus === 'rejected' ||
        verificationStatus === 'flagged'
    ) {
        return normalizeText(row.verification_status);
    }

    const documentStatus = normalizeText(row?.document_status);
    return documentStatus || normalizeText(row?.verification_status) || 'Pending Review';
}

function getEndorsementMap(endorsements = []) {
    return new Map(
        endorsements
            .filter((row) => row?.application_id)
            .map((row) => [String(row.application_id), row])
    );
}

function getWorkflowStage(application, endorsementMap) {
    const applicationStatus = normalizeLower(application?.application_status);
    const selectionStatus = normalizeLower(application?.selection_status);
    const activationStatus = normalizeLower(application?.activation_status);
    const verificationStatus = normalizeLower(application?.verification_status);
    const endorsement = endorsementMap.get(String(application?.application_id || ''));
    const endorsementStatus = normalizeLower(endorsement?.overall_status);

    if (
        application?.is_disqualified === true ||
        applicationStatus.includes('disqualified')
    ) {
        return 'Disqualified';
    }

    if (applicationStatus.includes('rejected')) {
        return 'Rejected';
    }

    if (
        applicationStatus.includes('approved') ||
        activationStatus === 'activated'
    ) {
        return 'Activated';
    }

    if (selectionStatus === 'waitlisted') {
        return 'Waitlisted';
    }

    if (
        selectionStatus === 'reserved' ||
        selectionStatus === 'promoted'
    ) {
        return 'Ready for Activation';
    }

    if (verificationStatus !== 'verified') {
        return 'Requirements Review';
    }

    if (endorsementStatus !== 'completed') {
        return 'Endorsement Review';
    }

    if (
        application?.queue_position != null ||
        application?.fcfs_completed_at
    ) {
        return 'FCFS Processing';
    }

    return 'Processing';
}

function buildApplicationPipeline(applications, endorsements) {
    const endorsementMap = getEndorsementMap(endorsements);

    const buckets = {
        'Requirements Review': 0,
        'Endorsement Review': 0,
        'Ready for Activation': 0,
        'Waiting List': 0,
        Activated: 0,
        'Rejected / Disqualified': 0,
    };

    applications.forEach((application) => {
        const stage = getWorkflowStage(application, endorsementMap);

        if (stage === 'Requirements Review') {
            buckets['Requirements Review'] += 1;
        } else if (
            stage === 'Endorsement Review' ||
            stage === 'FCFS Processing' ||
            stage === 'Processing'
        ) {
            buckets['Endorsement Review'] += 1;
        } else if (stage === 'Ready for Activation') {
            buckets['Ready for Activation'] += 1;
        } else if (stage === 'Waitlisted') {
            buckets['Waiting List'] += 1;
        } else if (stage === 'Activated') {
            buckets.Activated += 1;
        } else if (
            stage === 'Rejected' ||
            stage === 'Disqualified'
        ) {
            buckets['Rejected / Disqualified'] += 1;
        }
    });

    return Object.entries(buckets).map(([name, value]) => ({
        name,
        value,
    }));
}

function buildApplicationProgramMaps(applications) {
    const applicationProgramMap = new Map();
    const latestProgramByStudentMap = new Map();

    const sortedApplications = [...applications]
        .filter((application) => !isRecordArchived(application))
        .sort((a, b) => {
            const aDate = new Date(
                a.submission_date || a.created_at || 0
            ).getTime();
            const bDate = new Date(
                b.submission_date || b.created_at || 0
            ).getTime();
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
            !latestProgramByStudentMap.has(
                String(application.student_id)
            )
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

function buildScholarsByBenefactor(
    students,
    programs,
    benefactors,
    applications = []
) {
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
                applicationProgramMap.get(
                    String(student.current_application_id || '')
                ) ||
                latestProgramByStudentMap.get(
                    String(student.student_id || '')
                );

            if (!programId) {
                countMap.set(
                    'Unlinked Program',
                    (countMap.get('Unlinked Program') || 0) + 1
                );
                return;
            }

            const program = programMap.get(String(programId));

            if (!program?.benefactor_id) {
                countMap.set(
                    'Unlinked Benefactor',
                    (countMap.get('Unlinked Benefactor') || 0) + 1
                );
                return;
            }

            const benefactorName =
                benefactorMap.get(String(program.benefactor_id)) ||
                'Unknown Benefactor';

            countMap.set(
                benefactorName,
                (countMap.get(benefactorName) || 0) + 1
            );
        });

    return [...countMap.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
}

function buildRecentApplications(
    applications,
    students,
    openings,
    programs,
    endorsements
) {
    const studentMap = new Map();
    const openingMap = new Map();
    const programMap = new Map();
    const endorsementMap = getEndorsementMap(endorsements);

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
        .sort((a, b) => {
            const aDate = new Date(
                a.submission_date || a.created_at || 0
            ).getTime();
            const bDate = new Date(
                b.submission_date || b.created_at || 0
            ).getTime();
            return bDate - aDate;
        })
        .slice(0, 8)
        .map((application) => {
            const student =
                studentMap.get(String(application.student_id)) || {};
            const opening =
                openingMap.get(String(application.opening_id)) || {};

            const program =
                programMap.get(String(application.program_id || '')) ||
                programMap.get(String(opening.program_id || '')) ||
                programMap.get(
                    String(student.current_program_id || '')
                ) ||
                {};

            return {
                application_id: application.application_id,
                student_id: application.student_id,
                student_name:
                    fullName(student) || 'Unknown Student',
                student_number:
                    student.pdm_id ||
                    student.registrar_student_number ||
                    'N/A',
                program_name:
                    program.program_name || 'No Program',
                opening_title:
                    opening.opening_title || 'No Opening',
                application_status:
                    getApplicationStatus(application),
                document_status:
                    getRequirementsStatus(application),
                workflow_status:
                    getWorkflowStage(application, endorsementMap),
                submission_date:
                    application.submission_date ||
                    application.created_at ||
                    null,
            };
        });
}

function isActivePayoutBatch(row) {
    if (isRecordArchived(row)) return false;

    const status = normalizeLower(row?.batch_status);

    return ![
        'completed',
        'complete',
        'closed',
        'archived',
        'released',
    ].includes(status);
}

function isPendingRenewal(row) {
    if (isRecordArchived(row)) return false;

    const status = normalizeLower(
        row?.renewal_status || row?.status
    );

    if (!status) return false;

    return ![
        'approved',
        'completed',
        'complete',
        'rejected',
        'failed',
        'archived',
    ].includes(status);
}

function isActiveRO(row) {
    if (isRecordArchived(row)) return false;

    const status = normalizeLower(
        row?.ro_status || row?.status
    );

    return ![
        'cleared',
        'completed',
        'complete',
        'archived',
        'cancelled',
        'canceled',
    ].includes(status);
}

function isROLogNeedingAttention(row) {
    if (row?.requires_admin_attention === true) return true;

    const validationStatus = normalizeLower(
        row?.validation_status
    );

    return (
        validationStatus.includes('pending') ||
        validationStatus.includes('review')
    );
}

function buildSummaryCards({
    applications,
    students,
    openings,
    benefactors,
    endorsements,
    payoutBatches,
}) {
    const activeApplications = applications.filter(
        (row) => !isRecordArchived(row)
    );

    const activeScholarStudents = students
        .filter((student) => !isRecordArchived(student))
        .filter((student) => !isScholarArchived(student))
        .filter(isActiveScholar);

    const endorsementMap = getEndorsementMap(endorsements);

    const needsAction = countBy(activeApplications, (application) => {
        if (isTerminalApplication(application)) return false;

        const stage = getWorkflowStage(
            application,
            endorsementMap
        );

        return (
            stage === 'Requirements Review' ||
            stage === 'Endorsement Review' ||
            stage === 'Processing'
        );
    });

    const readyForActivation = countBy(
        activeApplications,
        (application) => {
            const selectionStatus = normalizeLower(
                application.selection_status
            );
            const applicationStatus = normalizeLower(
                application.application_status
            );

            return (
                !applicationStatus.includes('approved') &&
                ['reserved', 'promoted'].includes(selectionStatus)
            );
        }
    );

    const waitlisted = countBy(
        activeApplications,
        (application) =>
            normalizeLower(application.selection_status) ===
            'waitlisted'
    );

    const openOpenings = countBy(
        openings,
        (row) =>
            !isRecordArchived(row) &&
            normalizeLower(row.posting_status || row.status) ===
                'open'
    );

    const activePayouts = countBy(
        payoutBatches,
        isActivePayoutBatch
    );

    const activeBenefactors = countBy(
        benefactors,
        (row) => !isRecordArchived(row)
    );

    return [
        {
            key: 'total_applications',
            label: 'Applications',
            value: activeApplications.length,
            sub: 'Active application records',
            accent: 'var(--portal-base)',
            soft: 'var(--portal-accent-soft)',
        },
        {
            key: 'needs_action',
            label: 'Needs Review',
            value: needsAction,
            sub: 'Applications still requiring OSFA processing',
            accent: 'var(--portal-chart-tertiary)',
            soft: 'var(--portal-accent-soft)',
        },
        {
            key: 'ready_for_activation',
            label: 'Ready for Activation',
            value: readyForActivation,
            sub: 'Reserved or promoted applicants',
            accent: 'var(--portal-chart-positive)',
            soft: 'color-mix(in srgb, var(--portal-chart-positive) 12%, white)',
        },
        {
            key: 'waitlisted',
            label: 'Waiting List',
            value: waitlisted,
            sub: 'Qualified applicants waiting for a slot',
            accent: 'var(--portal-chart-secondary)',
            soft: 'var(--portal-surface-soft)',
        },
        {
            key: 'active_scholars',
            label: 'Active Scholars',
            value: activeScholarStudents.length,
            sub: 'Current active scholar records',
            accent: 'var(--portal-chart-quaternary)',
            soft: 'var(--portal-surface-soft)',
        },
        {
            key: 'open_openings',
            label: 'Open Openings',
            value: openOpenings,
            sub: 'Scholarship openings accepting applicants',
            accent: 'var(--portal-chart-primary)',
            soft: 'var(--portal-accent-soft)',
        },
        {
            key: 'active_payouts',
            label: 'Active Payout Batches',
            value: activePayouts,
            sub: 'Payout batches not yet completed',
            accent: 'var(--portal-chart-tertiary)',
            soft: 'var(--portal-accent-soft)',
        },
        {
            key: 'benefactors',
            label: 'Benefactors',
            value: activeBenefactors,
            sub: 'Current active benefactor records',
            accent: 'var(--portal-chart-primary)',
            soft: 'var(--portal-surface-soft)',
        },
    ];
}

function buildActionSummary({
    applications,
    endorsements,
    renewals,
    returnOfObligations,
    roTimeLogs,
    payoutEntries,
}) {
    const activeApplications = applications.filter(
        (row) => !isRecordArchived(row)
    );
    const endorsementMap = getEndorsementMap(endorsements);

    const requirementsReview = countBy(
        activeApplications,
        (application) => {
            if (isTerminalApplication(application)) return false;

            return (
                normalizeLower(application.verification_status) !==
                'verified'
            );
        }
    );

    const endorsementReview = countBy(
        activeApplications,
        (application) => {
            if (isTerminalApplication(application)) return false;

            if (
                normalizeLower(application.verification_status) !==
                'verified'
            ) {
                return false;
            }

            const endorsement = endorsementMap.get(
                String(application.application_id || '')
            );

            return (
                normalizeLower(endorsement?.overall_status) !==
                'completed'
            );
        }
    );

    const waitingList = countBy(
        activeApplications,
        (application) =>
            normalizeLower(application.selection_status) ===
            'waitlisted'
    );

    const renewalsPending = countBy(
        renewals,
        isPendingRenewal
    );

    const activeROIds = new Set(
        returnOfObligations
            .filter(isActiveRO)
            .map((row) => String(row.ro_id || ''))
            .filter(Boolean)
    );

    const roAttentionIds = new Set(activeROIds);

    roTimeLogs
        .filter(isROLogNeedingAttention)
        .forEach((row) => {
            const roId = String(row.ro_id || '');
            if (roId) roAttentionIds.add(roId);
        });

    const payoutPending = countBy(payoutEntries, (row) => {
        const status = normalizeLower(row?.release_status);
        return status === 'pending' || status === 'on hold';
    });

    return [
        {
            key: 'requirements_review',
            label: 'Requirements Review',
            value: requirementsReview,
            sub: 'Applications whose requirements are not yet verified',
            path: '/admin/applications',
        },
        {
            key: 'endorsement_review',
            label: 'Endorsement Review',
            value: endorsementReview,
            sub: 'Verified applicants still completing endorsements',
            path: '/admin/endorsements',
        },
        {
            key: 'renewals_pending',
            label: 'Renewal Review',
            value: renewalsPending,
            sub: 'Renewal records that still need processing',
            path: '/admin/renewals',
        },
        {
            key: 'ro_attention',
            label: 'RO Obligations',
            value: roAttentionIds.size,
            sub: 'Active obligations or logs requiring attention',
            path: '/admin/obligations',
        },
        {
            key: 'payout_pending',
            label: 'Payout Status',
            value: payoutPending,
            sub: 'Scholar payout entries still Pending or On Hold',
            path: '/admin/payout',
        },
        {
            key: 'waiting_list',
            label: 'Waiting List',
            value: waitingList,
            sub: 'Qualified applicants currently waiting for capacity',
            path: '/admin/applications',
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
        endorsements,
        payoutBatches,
        payoutEntries,
        renewals,
        returnOfObligations,
        roTimeLogs,
    ] = await Promise.all([
        fetchRows(
            'applications',
            `
                application_id,
                student_id,
                opening_id,
                program_id,
                application_status,
                document_status,
                verification_status,
                deficiency_status,
                selection_status,
                activation_status,
                queue_position,
                waitlist_position,
                fcfs_completed_at,
                requirements_verified_at,
                is_disqualified,
                submission_date,
                created_at,
                updated_at,
                is_archived
            `,
            { orderBy: 'submission_date', ascending: false }
        ),
        fetchRows(
            'students',
            `
                student_id,
                pdm_id,
                registrar_student_number,
                first_name,
                middle_name,
                last_name,
                is_active_scholar,
                scholarship_status,
                current_program_id,
                current_application_id,
                is_archived,
                scholar_is_archived,
                ro_status
            `
        ),
        fetchRows(
            'program_openings',
            `
                opening_id,
                program_id,
                opening_title,
                posting_status,
                allocated_slots,
                filled_slots,
                is_archived,
                created_at,
                updated_at
            `
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
            'endorsement_slips',
            'endorsement_slip_id, application_id, overall_status, completed_at, updated_at'
        ),
        fetchRows(
            'payout_batches',
            'payout_batch_id, batch_status, is_archived, created_at, updated_at'
        ),
        fetchRows(
            'payout_batch_students',
            'payout_entry_id, payout_batch_id, student_id, release_status'
        ),
        fetchRows('renewals', '*'),
        fetchRows('return_of_obligations', '*'),
        fetchRows(
            'ro_time_logs',
            'log_id, ro_id, validation_status, requires_admin_attention'
        ),
    ]);

    const activeApplications = applications.filter(
        (row) => !isRecordArchived(row)
    );

    return {
        generatedAt: new Date().toISOString(),

        summaryCards: buildSummaryCards({
            applications,
            students,
            openings,
            benefactors,
            endorsements,
            payoutBatches,
        }),

        actionSummary: buildActionSummary({
            applications,
            endorsements,
            renewals,
            returnOfObligations,
            roTimeLogs,
            payoutEntries,
        }),

        applicationPipeline: buildApplicationPipeline(
            activeApplications,
            endorsements
        ),

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
            programs,
            endorsements
        ),
    };
};
