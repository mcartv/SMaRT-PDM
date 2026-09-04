const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const pool = require('../config/db');
const supabase = require('../config/supabase');
const { transporter } = require('../config/mailer');
const notificationService = require('./notificationService');
const { resolveStaffRole } = require('../utils/staffRoles');
const pdCourseAssignmentService = require('./pdCourseAssignmentService');
const readinessQueueService = require('./readinessQueueService');
const { resolveAvatarUrl } = require('./avatarService');
const {
    ENDORSEMENT_STAGES,
    SDO_RESULTS,
    GUIDANCE_RESULTS,
    PD_RESULTS,
    LEGACY_RESULTS,
    RESULT_LABELS,
    normalizeSdoAction,
    normalizeGuidanceAction,
    normalizePdAction,
    isSdoContinuingResult,
    isCanonicalPdResult,
} = require('../utils/endorsementContract');

function normalizeStorageBucketName(value, fallback = 'documents') {
    const normalized = String(value || fallback)
        .trim()
        .replace(/^\/+|\/+$/g, '');

    if (!normalized) return fallback;

    // Supabase Storage accepts a bucket name only. A value such as
    // "documents/applications" means bucket "documents" and folder
    // "applications"; the folder must remain in the object path.
    return normalized.split('/').filter(Boolean)[0] || fallback;
}

const STORAGE_BUCKET = normalizeStorageBucketName(
    process.env.SUPABASE_APPLICATION_DOCUMENT_BUCKET,
    'documents'
);
const FRONTEND_BASE_URL =
    (process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
const PDFKIT_MODULE = 'pdfkit';
const QRCODE_MODULE = 'qrcode';
const SCHOOL_LOGO_PATH = path.resolve(
    __dirname,
    '../../../mobile/frontend/assets/images/school_logo.png'
);
const INSTITUTION_NAME = 'PAMBAYANG DALUBHASAAN NG MARILAO';
const INSTITUTION_ADDRESS = 'Abangan Norte, Marilao, Bulacan';
const SCHOLARSHIP_OFFICE_LABEL = 'OFFICE OF SCHOLARSHIP AND FINANCIAL ASSISTANCE (OSFA)';

const QUEUE_CONFIG = Object.freeze({
    sdo: {
        allowedRoles: ['sdo'],
        stage: 'pending_sdo',
        nextRole: 'guidance',
        nextTitle: 'Guidance review pending',
    },
    guidance: {
        allowedRoles: ['guidance'],
        stage: 'pending_guidance',
        nextRole: 'pd',
        nextTitle: 'Scholastic standing review pending',
    },
    pd: {
        allowedRoles: ['pd'],
        stage: 'pending_pd',
        nextRole: null,
        nextTitle: null,
    },
});

const STAGE_LABELS = Object.freeze({
    pending_sdo: 'Pending SDO',
    pending_guidance: 'Pending Guidance',
    pending_pd: 'Pending Program Director',
    completed: 'Completed',
    disqualified_major: 'Stopped - Major Disciplinary Offense',
    // Legacy terminal states remain readable while historical records are retained.
    rejected: 'Rejected by Program Director (Legacy)',
    guidance_rejected: 'Rejected by Guidance (Legacy)',
    held: 'Held by Guidance (Legacy)',
    disqualified_minor: 'Minor Offense (Legacy)',
});

const PROGRESS_STEPS = Object.freeze([
    { key: 'sdo', label: 'SDO' },
    { key: 'guidance', label: 'Guidance' },
    { key: 'pd', label: 'Program Director' },
]);

const SDO_STANDARD_REASONS = Object.freeze({
    [SDO_RESULTS.NO_OFFENSE]: 'No disciplinary offense on record.',
    [SDO_RESULTS.MINOR_OFFENSE]: 'Minor offense noted; endorsement forwarded to Guidance.',
    [SDO_RESULTS.MAJOR_OFFENSE]: 'Major offense noted; endorsement process stopped.',
});

const CHECKBOX_LABELS = RESULT_LABELS;

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function formatCourseDisplay(row = {}) {
    const code = safeText(row.course_code);
    const name = safeText(row.course_name);

    if (code && name && code.toLowerCase() !== name.toLowerCase()) {
        return `${code} - ${name}`;
    }

    return code || name || 'N/A';
}

function parseJson(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function deriveSlipCode(slipId) {
    const base = safeText(slipId).split('-')[0].toUpperCase();
    return base ? `ES-${base}` : 'ES-PENDING';
}

async function getSignedFileUrl(filePath) {
    if (!filePath) return null;

    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(filePath, 60 * 60, {
            download: false,
        });

    if (error) {
        console.error(
            'ENDORSEMENT SIGNED URL ERROR:',
            `bucket=${STORAGE_BUCKET}`,
            `path=${filePath}`,
            error.message
        );
        return null;
    }

    return data?.signedUrl || null;
}

function deriveLegacyPdCheckboxResult(gwa) {
    const numericGwa = Number(gwa);
    return Number.isFinite(numericGwa) && numericGwa <= 1.75
        ? CHECKBOX_LABELS.pd[PD_RESULTS.GOOD_SCHOLASTIC_STANDING]
        : CHECKBOX_LABELS.pd[PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING];
}

function mapPaperOfficeResults(row = {}) {
    const pdResult = CHECKBOX_LABELS.pd[row.pd_status] ||
        (row.pd_status === LEGACY_RESULTS.PD_APPROVED ? deriveLegacyPdCheckboxResult(row.gwa) : null);

    return {
        sdo: CHECKBOX_LABELS.sdo[row.sdo_status] || null,
        guidance: CHECKBOX_LABELS.guidance[row.guidance_status] || null,
        pd: pdResult,
    };
}

function getActorUserId(actor = {}) {
    return actor?.userId || actor?.user_id || null;
}

function ensureQueueAccess(queueKey, actor) {
    const config = QUEUE_CONFIG[queueKey];
    if (!config) {
        throw createHttpError(400, 'Invalid endorsement queue.');
    }

    const role = safeText(actor?.role).toLowerCase();
    if (!config.allowedRoles.includes(role)) {
        throw createHttpError(403, 'Access denied for this endorsement queue.');
    }

    return config;
}

function ensureTrackerAccess(actor = {}) {
    const role = safeText(actor?.role).toLowerCase();
    if (!['admin', 'pd', 'guidance', 'sdo'].includes(role)) {
        throw createHttpError(403, 'Access denied for endorsement tracking.');
    }
}

// SMART-PDM_ENDORSEMENT_VERIFIED_GATE_V1
function appendVerifiedApplicationGate(conditions = []) {
    conditions.push(
        `lower(trim(coalesce(a.verification_status, ''))) = 'verified'`
    );
    conditions.push('a.requirements_verified_at is not null');
    conditions.push('coalesce(a.is_archived, false) = false');
    conditions.push('coalesce(a.is_disqualified, false) = false');
    conditions.push(
        `lower(trim(coalesce(a.application_status, ''))) <> 'rejected'`
    );
}

function assertVerifiedApplicationForEndorsement(row = {}) {
    const verificationStatus = safeText(
        row.application_verification_status || row.verification_status
    ).toLowerCase();

    const applicationStatus = safeText(
        row.linked_application_status || row.application_status
    ).toLowerCase();

    const eligible =
        verificationStatus === 'verified' &&
        Boolean(row.requirements_verified_at) &&
        row.application_is_archived !== true &&
        row.application_is_disqualified !== true &&
        applicationStatus !== 'rejected';

    if (!eligible) {
        throw createHttpError(
            409,
            'Endorsement is not available until Admin verifies all required application documents.'
        );
    }
}

function getTrackerSummary(status) {
    switch (status) {
        case 'pending_sdo':
            return {
                currentOffice: 'SDO',
                currentLabel: 'Currently in SDO',
                nextStage: 'guidance',
                nextStageLabel: 'Guidance',
            };
        case 'pending_guidance':
            return {
                currentOffice: 'Guidance',
                currentLabel: 'Currently in Guidance',
                nextStage: 'pd',
                nextStageLabel: 'Program Director',
            };
        case 'pending_pd':
            return {
                currentOffice: 'Program Director',
                currentLabel: 'Currently in Program Director',
                nextStage: null,
                nextStageLabel: null,
            };
        case 'completed':
            return {
                currentOffice: null,
                currentLabel: 'Completed',
                nextStage: null,
                nextStageLabel: null,
            };
        case 'held':
            return {
                currentOffice: 'Guidance',
                currentLabel: 'Held in Guidance',
                nextStage: null,
                nextStageLabel: null,
            };
        case 'guidance_rejected':
            return {
                currentOffice: 'Guidance',
                currentLabel: 'Rejected by Guidance',
                nextStage: null,
                nextStageLabel: null,
            };
        case 'rejected':
            return {
                currentOffice: 'Program Director',
                currentLabel: 'Rejected by Program Director',
                nextStage: null,
                nextStageLabel: null,
            };
        case 'disqualified_minor':
            return {
                currentOffice: 'SDO',
                currentLabel: 'Disqualified by SDO (Minor)',
                nextStage: null,
                nextStageLabel: null,
            };
        case 'disqualified_major':
            return {
                currentOffice: 'SDO',
                currentLabel: 'Disqualified by SDO (Major)',
                nextStage: null,
                nextStageLabel: null,
            };
        default:
            return {
                currentOffice: null,
                currentLabel: STAGE_LABELS[status] || safeText(status) || 'Pending',
                nextStage: null,
                nextStageLabel: null,
            };
    }
}

function buildProgressTracker({
    current_stage,
    overall_status,
    sdo_status,
    guidance_status,
    pd_status,
}) {
    const summary = getTrackerSummary(overall_status || current_stage);
    const steps = PROGRESS_STEPS.map((step) => {
        let state = 'pending';
        let decision = null;

        if (step.key === 'sdo') {
            decision = sdo_status || null;

            if (overall_status === 'disqualified_major') {
                state = 'stopped';
            } else if (current_stage === 'pending_sdo') {
                state = 'active';
            } else if (
                [SDO_RESULTS.NO_OFFENSE, SDO_RESULTS.MINOR_OFFENSE, LEGACY_RESULTS.SDO_CLEARED, LEGACY_RESULTS.SDO_MINOR].includes(sdo_status) ||
                ['pending_guidance', 'pending_pd', 'completed', 'held', 'rejected'].includes(overall_status)
            ) {
                state = 'completed';
            }
        }

        if (step.key === 'guidance') {
            decision = guidance_status || null;

            if (['held', 'guidance_rejected'].includes(overall_status)) {
                state = 'stopped';
            } else if (current_stage === 'pending_guidance') {
                state = 'active';
            } else if ([GUIDANCE_RESULTS.GOOD_MORAL_STANDING, LEGACY_RESULTS.GUIDANCE_CLEARED].includes(guidance_status) || ['pending_pd', 'completed', 'rejected'].includes(overall_status)) {
                state = 'completed';
            }
        }

        if (step.key === 'pd') {
            decision = pd_status || null;

            if (overall_status === 'rejected') {
                state = 'stopped';
            } else if (current_stage === 'pending_pd') {
                state = 'active';
            } else if (overall_status === 'completed' || isCanonicalPdResult(pd_status) || pd_status === LEGACY_RESULTS.PD_APPROVED) {
                state = 'completed';
            }
        }

        return {
            ...step,
            state,
            decision,
        };
    });

    return {
        current_stage,
        overall_status,
        current_stage_label: STAGE_LABELS[current_stage] || current_stage,
        overall_status_label: STAGE_LABELS[overall_status] || overall_status,
        current_office: summary.currentOffice,
        current_label: summary.currentLabel,
        next_stage: summary.nextStage,
        next_stage_label: summary.nextStageLabel,
        steps,
        per_office_statuses: {
            sdo: sdo_status || null,
            guidance: guidance_status || null,
            pd: pd_status || null,
        },
    };
}

function mapQueueRow(row, actorRole = '') {
    const tracker = buildProgressTracker(row);
    const officeResults = mapPaperOfficeResults(row);
    const stages = [
        {
            key: 'sdo',
            label: 'Student Discipline Office',
            status: row.sdo_status || null,
            result_label: officeResults.sdo || null,
            acted_at: row.sdo_acted_at || null,
        },
        {
            key: 'guidance',
            label: 'Guidance Office',
            status: row.guidance_status || null,
            result_label: officeResults.guidance || null,
            acted_at: row.guidance_acted_at || null,
        },
        {
            key: 'pd',
            label: 'Program Director',
            status: row.pd_status || null,
            result_label: officeResults.pd || null,
            acted_at: row.pd_acted_at || null,
        },
    ];

    return {
        slip_id: row.slip_id,
        slip_code: deriveSlipCode(row.slip_id),
        application_id: row.application_id,
        student_id: row.student_id,
        student_name: row.student_name || 'Unknown Student',
        pdm_id: row.pdm_id || 'N/A',
        avatar_url: row.avatar_url || null,
        course_code: row.course_code || '',
        course_name: row.course_name || '',
        course_display: formatCourseDisplay(row),
        year_level: row.year_level || '',
        program_name: row.program_name || 'N/A',
        opening_title: row.opening_title || 'N/A',
        semester: row.semester || '',
        school_year: row.school_year || '',
        submitted_at: row.submission_date,
        application_status: row.application_status,
        document_status: row.document_status,
        current_stage: row.current_stage,
        current_stage_label: tracker.current_stage_label,
        overall_status: row.overall_status,
        overall_status_label: tracker.overall_status_label,
        next_stage: tracker.next_stage,
        next_stage_label: tracker.next_stage_label,
        current_label: tracker.current_label,
        current_office: tracker.current_office,
        // SMART-PDM_PD_OCR_GRADE_VALIDATION_REMOVED_V1
        // Grade OCR/GWA validation remains Admin evidence only. PD receives the
        // submitted Grade Report itself, but not grade_summary_json / OCR metadata.
        ...(actorRole === 'admin'
            ? {
                grade_summary: parseJson(row.grade_summary_json),
                grade_document: {
                    url: row.grade_document_url || '',
                    file_name: row.grade_document_name || '',
                    submitted_at: row.grade_document_submitted_at || null,
                    is_uploaded:
                        row.grade_document_is_submitted === true &&
                        Boolean(
                            safeText(row.grade_document_path) ||
                            safeText(row.grade_document_url)
                        ),
                },
            }
            : actorRole === 'pd'
                ? {
                    grade_document: {
                        url: row.grade_document_url || '',
                        file_name: row.grade_document_name || '',
                        submitted_at: row.grade_document_submitted_at || null,
                        is_uploaded:
                            row.grade_document_is_submitted === true &&
                            Boolean(
                                safeText(row.grade_document_path) ||
                                safeText(row.grade_document_url)
                            ),
                    },
                }
                : {}),
        pd_decision: row.pd_status || null,
        guidance_decision: row.guidance_status || null,
        sdo_decision: row.sdo_status || null,
        office_results: officeResults,
        per_office_statuses: tracker.per_office_statuses,
        tracker,
        stages,
        final_pdf_url: row.final_pdf_url || null,
        completed_at: row.completed_at,
    };
}

async function mapQueueRowForActor(row, actorRole = '') {
    const normalizedRole = safeText(actorRole).toLowerCase();
    const avatarUrl = await resolveAvatarUrl(row.profile_photo_url);

    let signedGradeUrl = '';
    if (normalizedRole === 'pd' || normalizedRole === 'admin') {
        signedGradeUrl = await getSignedFileUrl(row.grade_document_path);
    }

    return mapQueueRow(
        {
            ...row,
            avatar_url: avatarUrl || null,
            grade_document_url: signedGradeUrl || row.grade_document_url || '',
        },
        normalizedRole
    );
}

async function loadSlipRows({ stage = null, stages = null, actor = null } = {}) {
    const params = [];
    const normalizedStages = Array.isArray(stages)
        ? stages.map((value) => safeText(value)).filter(Boolean)
        : [];
    const conditions = [];

    // Keep stale/premature endorsement rows in the database for history, but
    // do not expose them to SDO/Guidance/PD until Admin finishes verification.
    appendVerifiedApplicationGate(conditions);

    if (normalizedStages.length > 0) {
        params.push(normalizedStages);
        conditions.push(`es.current_stage = any($${params.length}::text[])`);
    } else if (stage) {
        params.push(stage);
        conditions.push(`es.current_stage = $${params.length}`);
    }

    const actorRole = safeText(actor?.role).toLowerCase();
    if (actorRole === 'pd') {
        const actorUserId = getActorUserId(actor);
        if (!actorUserId) throw createHttpError(401, 'Authenticated Program Director is required.');
        params.push(actorUserId);
        conditions.push(`exists (
          select 1 from program_director_course_assignments assignment
          where assignment.pd_user_id = $${params.length}
            and assignment.course_id = coalesce(st.course_id, smr.course_id)
            and assignment.is_active = true
        )`);
    }

    // Department tracker views are office-scoped. Admin is the only role that
    // receives the complete cross-office tracker.
    if (!stage && normalizedStages.length === 0) {
        if (actorRole === 'sdo') {
            conditions.push(`(es.current_stage = 'pending_sdo' OR es.sdo_status IS NOT NULL)`);
        } else if (actorRole === 'guidance') {
            conditions.push(`(
              es.current_stage IN ('pending_guidance', 'pending_pd', 'completed')
              OR es.guidance_status IS NOT NULL
            )`);
        } else if (actorRole === 'pd') {
            conditions.push(`(
              es.current_stage IN ('pending_pd', 'completed')
              OR es.pd_status IS NOT NULL
            )`);
        }
    }
    const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';

    const { rows } = await pool.query(
        `
        select
            es.slip_id,
            es.application_id,
            es.student_id,
            es.current_stage,
            es.overall_status,
            es.grade_summary_json,
            es.pd_status,
            es.pd_acted_at,
            es.pd_remarks,
            es.guidance_status,
            es.guidance_acted_at,
            es.guidance_remarks,
            es.sdo_status,
            es.sdo_acted_at,
            es.sdo_remarks,
            es.sdo_offense_type,
            es.sdo_incident_date,
            es.sdo_case_reference_number,
            es.final_pdf_url,
            es.completed_at,
            es.created_at,
            a.submission_date,
            a.application_status,
            a.document_status,
            st.pdm_id,
            st.gwa,
            coalesce(st.course_id, smr.course_id) as course_id,
            st.year_level,
            st.profile_photo_url,
            trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
            ac.course_code,
            ac.course_name,
            sp.program_name,
            po.opening_title,
            ay.label as school_year,
            ap.term as semester,
            grade_doc.file_path as grade_document_path,
            grade_doc.file_url as grade_document_url,
            grade_doc.file_name as grade_document_name,
            grade_doc.submitted_at as grade_document_submitted_at,
            grade_doc.is_submitted as grade_document_is_submitted
        from endorsement_slips es
        join applications a on a.application_id = es.application_id
        join students st on st.student_id = es.student_id
        left join student_master_records smr on smr.master_student_id = st.master_student_id
        left join academic_course ac on ac.course_id = coalesce(st.course_id, smr.course_id)
        left join scholarship_program sp on sp.program_id = a.program_id
        left join program_openings po on po.opening_id = a.opening_id
        left join academic_years ay on ay.academic_year_id = po.academic_year_id
        left join academic_period ap on ap.period_id = po.period_id
        left join lateral (
            select ad.file_path, ad.file_url, ad.file_name, ad.submitted_at, ad.is_submitted
            from application_documents ad
            where ad.application_id = a.application_id
              and lower(coalesce(ad.document_type, '')) = 'grade report'
              and coalesce(ad.is_submitted, false) = true
              and (
                nullif(trim(coalesce(ad.file_path, '')), '') is not null
                or nullif(trim(coalesce(ad.file_url, '')), '') is not null
              )
            order by ad.submitted_at desc nulls last
            limit 1
        ) grade_doc on true
        ${whereClause}
        order by
            case
                when es.overall_status = 'completed' then 2
                else 1
            end,
            a.submission_date desc nulls last,
            es.created_at desc
        `,
        params
    );

    return Promise.all(rows.map((row) => mapQueueRowForActor(row, actorRole)));
}

async function fetchQueue(queueKey, actor) {
    ensureQueueAccess(queueKey, actor);
    return loadSlipRows({ actor });
}

async function fetchAllSlips(actor) {
    ensureTrackerAccess(actor);
    return loadSlipRows({ actor });
}

async function fetchSlipDetail(slipId, actor = null) {
    if (actor?.role) {
        ensureTrackerAccess(actor);
    }

    const { rows } = await pool.query(
        `
        select
            es.*,
            a.submission_date,
            a.application_status,
            a.document_status,
            a.application_payload,
            st.pdm_id,
            st.gwa,
            coalesce(st.course_id, smr.course_id) as course_id,
            st.year_level,
            st.profile_photo_url,
            trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
            st.first_name,
            st.last_name,
            u.email as student_email,
            ac.course_code,
            ac.course_name,
            sp.program_name,
            po.opening_title,
            ay.label as school_year,
            ap.term as semester,
            pd_user.email as pd_actor_email,
            pd_profile.first_name as pd_actor_first_name,
            pd_profile.last_name as pd_actor_last_name,
            guidance_user.email as guidance_actor_email,
            guidance_profile.first_name as guidance_actor_first_name,
            guidance_profile.last_name as guidance_actor_last_name,
            sdo_user.email as sdo_actor_email,
            sdo_profile.first_name as sdo_actor_first_name,
            sdo_profile.last_name as sdo_actor_last_name
        from endorsement_slips es
        join applications a on a.application_id = es.application_id
        join students st on st.student_id = es.student_id
        left join users u on u.user_id = st.user_id
        left join student_master_records smr on smr.master_student_id = st.master_student_id
        left join academic_course ac on ac.course_id = coalesce(st.course_id, smr.course_id)
        left join scholarship_program sp on sp.program_id = a.program_id
        left join program_openings po on po.opening_id = a.opening_id
        left join academic_years ay on ay.academic_year_id = po.academic_year_id
        left join academic_period ap on ap.period_id = po.period_id
        left join users pd_user on pd_user.user_id = es.pd_acted_by_user_id
        left join admin_profiles pd_profile on pd_profile.user_id = es.pd_acted_by_user_id
        left join users guidance_user on guidance_user.user_id = es.guidance_acted_by_user_id
        left join admin_profiles guidance_profile on guidance_profile.user_id = es.guidance_acted_by_user_id
        left join users sdo_user on sdo_user.user_id = es.sdo_acted_by_user_id
        left join admin_profiles sdo_profile on sdo_profile.user_id = es.sdo_acted_by_user_id
        where es.slip_id = $1
          and lower(trim(coalesce(a.verification_status, ''))) = 'verified'
          and a.requirements_verified_at is not null
          and coalesce(a.is_archived, false) = false
          and coalesce(a.is_disqualified, false) = false
          and lower(trim(coalesce(a.application_status, ''))) <> 'rejected'
        limit 1
        `,
        [slipId]
    );

    if (!rows.length) {
        throw createHttpError(404, 'Endorsement slip not found.');
    }

    const row = rows[0];
    // Section is captured with the student's application rather than the
    // registrar record. Read it from that immutable submission so the
    // endorsement slip shows the section the student actually applied under.
    const applicationPayload = parseJson(row.application_payload);
    const applicationAcademic = parseJson(applicationPayload.academic);
    const studentSection = safeText(
        applicationAcademic.current_section || applicationAcademic.section
    );
    const actorRole = safeText(actor?.role).toLowerCase();
    if (actorRole === 'pd') {
        await pdCourseAssignmentService.assertCourseAccess({
            userId: getActorUserId(actor),
            courseId: row.course_id,
            role: actor.role,
        });
        if (!(row.current_stage === 'pending_pd' || row.current_stage === 'completed' || row.pd_status)) {
            throw createHttpError(403, 'This endorsement has not reached the Program Director stage.');
        }
    } else if (actorRole === 'guidance') {
        if (!(row.current_stage === 'pending_guidance' || row.current_stage === 'pending_pd' || row.current_stage === 'completed' || row.guidance_status)) {
            throw createHttpError(403, 'This endorsement has not reached the Guidance stage.');
        }
    } else if (actorRole === 'sdo') {
        if (!(row.current_stage === 'pending_sdo' || row.sdo_status)) {
            throw createHttpError(403, 'This endorsement is outside the SDO scope.');
        }
    }
    const tracker = buildProgressTracker(row);
    const officeResults = mapPaperOfficeResults(row);
    const officeSignatories = {
        sdo: [row.sdo_actor_first_name, row.sdo_actor_last_name].filter(Boolean).join(' ') || row.sdo_actor_email || '',
        guidance:
            [row.guidance_actor_first_name, row.guidance_actor_last_name].filter(Boolean).join(' ') ||
            row.guidance_actor_email ||
            '',
        pd: [row.pd_actor_first_name, row.pd_actor_last_name].filter(Boolean).join(' ') || row.pd_actor_email || '',
    };
    let documents = [];
    // Least privilege for applicant files: OSFA/Admin may inspect the complete
    // application; PD receives only the Grade Report needed for scholastic
    // standing. SDO and Guidance receive no application-document attachments.
    if (actorRole === 'admin' || actorRole === 'pd') {
        const documentParams = [row.application_id];
        let documentFilter = '';
        if (actorRole === 'pd') {
            documentFilter = `AND lower(coalesce(document_type, '')) = 'grade report'`;
        }
        const documentRows = await pool.query(
            `
            select
                document_id,
                document_type,
                file_name,
                file_path,
                file_url,
                submitted_at,
                notes
            from application_documents
            where application_id = $1
              ${documentFilter}
            order by submitted_at desc nulls last, document_type asc
            `,
            documentParams
        );

        documents = await Promise.all(
            documentRows.rows.map(async (document) => ({
                ...document,
                file_url:
                    (await getSignedFileUrl(document.file_path)) ||
                    document.file_url ||
                    null,
            }))
        );
    }

    const avatarUrl = await resolveAvatarUrl(row.profile_photo_url);

    return {
        slip_id: row.slip_id,
        slip_code: deriveSlipCode(row.slip_id),
        application_id: row.application_id,
        student_id: row.student_id,
        student_name: row.student_name || 'Unknown Student',
        pdm_id: row.pdm_id || 'N/A',
        avatar_url: avatarUrl || null,
        course_code: row.course_code || '',
        course_name: row.course_name || '',
        course_display: formatCourseDisplay(row),
        year_level: row.year_level || null,
        section: studentSection,
        student_email: row.student_email || '',
        program_name: row.program_name || 'N/A',
        opening_title: row.opening_title || 'N/A',
        semester: row.semester || '',
        school_year: row.school_year || '',
        submitted_at: row.submission_date,
        application_status: row.application_status,
        document_status: row.document_status,
        current_stage: row.current_stage,
        current_stage_label: tracker.current_stage_label,
        overall_status: row.overall_status,
        overall_status_label: tracker.overall_status_label,
        next_stage: tracker.next_stage,
        next_stage_label: tracker.next_stage_label,
        current_label: tracker.current_label,
        current_office: tracker.current_office,
        grade_summary: parseJson(row.grade_summary_json),
        tracker,
        final_pdf_url: row.final_pdf_url || null,
        verification_token: row.verification_token,
        completed_at: row.completed_at,
        documents,
        office_results: officeResults,
        office_signatories: officeSignatories,
        sdo_offense_detail: {
            offense_type: row.sdo_offense_type || '',
            incident_date: row.sdo_incident_date || null,
            case_reference_number: row.sdo_case_reference_number || '',
        },
        per_office_statuses: tracker.per_office_statuses,
        stages: [
            {
                key: 'sdo',
                label: 'Student Discipline Office',
                status: row.sdo_status || (row.current_stage === 'pending_sdo' ? 'pending' : 'not_started'),
                result_label: officeResults.sdo,
                acted_at: row.sdo_acted_at,
                acted_by_user_id: row.sdo_acted_by_user_id,
                acted_by_name: officeSignatories.sdo,
                remarks: row.sdo_remarks || '',
            },
            {
                key: 'guidance',
                label: 'Guidance Office',
                status: row.guidance_status || (row.current_stage === 'pending_guidance' ? 'pending' : 'not_started'),
                result_label: officeResults.guidance,
                acted_at: row.guidance_acted_at,
                acted_by_user_id: row.guidance_acted_by_user_id,
                acted_by_name: officeSignatories.guidance,
                remarks: row.guidance_remarks || '',
            },
            {
                key: 'pd',
                label: 'Program Director',
                status: row.pd_status || (row.current_stage === 'pending_pd' ? 'pending' : 'not_started'),
                result_label: officeResults.pd,
                acted_at: row.pd_acted_at,
                acted_by_user_id: row.pd_acted_by_user_id,
                acted_by_name: officeSignatories.pd,
                remarks: row.pd_remarks || '',
            },
        ],
    };
}

async function fetchStaffTargetsByRole(role, { courseId = null } = {}) {
    const { rows } = await pool.query(
        `
        select
            u.user_id,
            u.email,
            u.role as user_role,
            ap.admin_id,
            ap.department,
            ap.position,
            ap.first_name,
            ap.last_name
        from users u
        left join admin_profiles ap on ap.user_id = u.user_id
        where ap.is_archived is distinct from true
        `
    );

    let targets = rows
        .filter((row) => resolveStaffRole(row) === role)
        .filter((row) => safeText(row.email))
        .map((row) => ({
            user_id: row.user_id,
            email: row.email,
            name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email,
        }));

    if (role === 'pd' && courseId) {
        const assigned = await pool.query(
            `SELECT pd_user_id FROM program_director_course_assignments WHERE course_id = $1 AND is_active = true`,
            [courseId]
        );
        const allowedIds = new Set(assigned.rows.map((row) => String(row.pd_user_id)));
        targets = targets.filter((target) => allowedIds.has(String(target.user_id)));
    }

    return targets;
}

async function notifyNextStage({ slipId, queueKey, studentName, courseId = null }) {
    const config = QUEUE_CONFIG[queueKey];
    if (!config?.nextRole) {
        return;
    }

    const targets = await fetchStaffTargetsByRole(config.nextRole, { courseId });
    if (!targets.length) {
        return;
    }

    const created = [];
    for (const target of targets) {
        try {
            const notification = await notificationService.createUserNotification({
                userId: target.user_id,
                type: 'Endorsement Slip',
                title: config.nextTitle,
                message: `${studentName} is ready for ${config.nextRole.toUpperCase()} review.`,
                referenceId: slipId,
                referenceType: 'endorsement_slip',
            });
            created.push({
                ...notification,
                target_user_id: target.user_id,
            });
        } catch (error) {
            console.error('ENDORSEMENT NOTIFICATION ERROR:', error.message || error);
        }
    }

    return created;
}

async function notifyAdminOfEndorsementOutcome({
    slipId,
    studentName,
    overallStatus,
}) {
    const status = safeText(overallStatus).toLowerCase();
    const outcomes = {
        completed: {
            title: 'Endorsement completed',
            message: `${studentName} completed all endorsement reviews.`,
        },
        disqualified_major: {
            title: `Endorsement stopped for ${studentName}`,
            message: 'The endorsement stopped after SDO recorded a major offense.',
        },
    };
    const outcome = outcomes[status];

    if (!outcome) return [];

    try {
        return await notificationService.createStaffNotifications({
            roles: ['admin'],
            type: 'Endorsement Update',
            title: outcome.title,
            message: outcome.message,
            referenceId: slipId,
            referenceType: 'endorsement_slip',
        });
    } catch (error) {
        console.error(
            'ENDORSEMENT ADMIN NOTIFICATION ERROR:',
            error.message || error
        );
        return [];
    }
}

function buildPdfVerificationUrl(token) {
    return `${FRONTEND_BASE_URL}/endorsement/verify/${token}`;
}

async function generateVerificationQrDataUrl(url) {
    let QRCode = null;
    try {
        QRCode = require(QRCODE_MODULE);
    } catch {
        throw createHttpError(
            500,
            'QR generation dependency is missing. Install admin backend dependencies before generating PDFs.'
        );
    }

    return QRCode.toDataURL(url, {
        margin: 1,
        width: 180,
    });
}

async function buildCompletedSlipPdf(detail) {
    let PDFDocument = null;
    try {
        PDFDocument = require(PDFKIT_MODULE);
    } catch {
        throw createHttpError(
            500,
            'PDF generation dependency is missing. Install admin backend dependencies before generating PDFs.'
        );
    }

    const verificationUrl = buildPdfVerificationUrl(detail.verification_token);
    const qrDataUrl = await generateVerificationQrDataUrl(verificationUrl);
    const qrBase64 = qrDataUrl.split(',')[1];
    const qrBuffer = Buffer.from(qrBase64, 'base64');

    return await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 28 });
        const chunks = [];
        const officeResults = detail.office_results || {};
        const officeSignatories = detail.office_signatories || {};
        const hasSchoolLogo = fs.existsSync(SCHOOL_LOGO_PATH);
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const left = 28;
        const right = pageWidth - 28;
        const contentWidth = right - left;
        const sectionSplit = left + contentWidth * 0.53;
        const checkboxSize = 12;
        const baseFont = 'Helvetica';
        const boldFont = 'Helvetica-Bold';
        const sectionLabelFontSize = 8;
        const lineColor = '#111827';
        const paperBlue = '#d8f4fb';
        const summaryRemarks = [
            detail.stages?.find((stage) => stage.key === 'sdo')?.remarks,
            detail.stages?.find((stage) => stage.key === 'guidance')?.remarks,
            detail.stages?.find((stage) => stage.key === 'pd')?.remarks,
        ].filter((value) => safeText(value)).join(' | ') || 'N/A';
        const studentSection = safeText(detail.section || detail.section_name) || 'N/A';

        const drawBox = (x, y, width, height, options = {}) => {
            const fillColor = options.fillColor || null;
            doc.save();
            if (fillColor) {
                doc.rect(x, y, width, height).fillAndStroke(fillColor, options.strokeColor || lineColor);
            } else {
                doc.rect(x, y, width, height).stroke(options.strokeColor || lineColor);
            }
            doc.restore();
        };

        const drawCenteredText = (text, x, y, width, options = {}) => {
            doc.font(options.font || baseFont)
                .fontSize(options.size || 10)
                .fillColor(options.color || '#111827')
                .text(text, x, y, {
                    width,
                    align: 'center',
                });
        };

        const drawFieldRow = (y, label, value, width = contentWidth) => {
            drawBox(left, y, width, 34);
            doc.font(boldFont).fontSize(9).text(label, left + 10, y + 10);
            doc.font(baseFont).fontSize(10).text(value || 'N/A', left + 72, y + 10, {
                width: width - 82,
            });
        };

        const drawCheckboxLine = (x, y, label, checked) => {
            drawBox(x, y + 2, checkboxSize, checkboxSize);
            if (checked) {
                doc.font(boldFont).fontSize(11).text('X', x + 2.5, y + 0.5);
            }
            doc.font(baseFont).fontSize(9.5).text(label, x + checkboxSize + 8, y, {
                width: sectionSplit - x - checkboxSize - 20,
            });
        };

        const drawSignatureBlock = (x, y, width, title, signatoryName) => {
            drawBox(x, y, width, 74);
            doc.moveTo(x, y + 38).lineTo(x + width, y + 38).stroke(lineColor);
            drawCenteredText(title, x + 10, y + 44, width - 20, {
                font: baseFont,
                size: 8.5,
            });
            doc.font(baseFont).fontSize(8.5).text(safeText(signatoryName) || 'Pending', x + 10, y + 14, {
                width: width - 20,
                align: 'center',
            });
        };

        const drawOfficeSection = ({
            top,
            leftItems,
            signatureTitle,
            signatoryName,
            extraDetails = [],
            height,
        }) => {
            drawBox(left, top, contentWidth, height);
            doc.moveTo(sectionSplit, top).lineTo(sectionSplit, top + height).stroke(lineColor);

            let checkboxY = top + 12;
            leftItems.forEach((item) => {
                drawCheckboxLine(left + 10, checkboxY, item.label, item.checked);
                checkboxY += 30;
            });

            const detailStartY = Math.max(checkboxY - 4, top + 16);
            if (extraDetails.length) {
                doc.font(baseFont).fontSize(7.5).fillColor('#374151');
                extraDetails.forEach((line, index) => {
                    doc.text(line, left + 10, detailStartY + index * 11, {
                        width: sectionSplit - left - 20,
                    });
                });
            }

            drawSignatureBlock(
                sectionSplit,
                top + Math.max(10, (height - 74) / 2),
                right - sectionSplit,
                signatureTitle,
                signatoryName
            );
        };

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        drawBox(0, 0, pageWidth, pageHeight, { fillColor: paperBlue, strokeColor: paperBlue });
        drawBox(left, 28, contentWidth, pageHeight - 56);

        const headerTop = 40;
        if (hasSchoolLogo) {
            doc.image(SCHOOL_LOGO_PATH, left + 10, headerTop + 4, { fit: [54, 54], align: 'left' });
        }

        drawCenteredText(INSTITUTION_NAME, left + 72, headerTop + 4, contentWidth - 144, {
            font: boldFont,
            size: 18,
        });
        drawCenteredText(INSTITUTION_ADDRESS, left + 72, headerTop + 28, contentWidth - 144, {
            size: 10,
        });
        drawCenteredText(SCHOLARSHIP_OFFICE_LABEL, left + 72, headerTop + 58, contentWidth - 144, {
            font: boldFont,
            size: 9.5,
        });

        doc.font(baseFont).fontSize(9).text('PMA-OSFA', right - 96, headerTop + 8, { width: 70, align: 'left' });
        doc.text('Form-02', right - 96, headerTop + 28, { width: 70, align: 'left' });

        drawCenteredText('ENDORSEMENT SLIP', left, 126, contentWidth, {
            font: boldFont,
            size: 16,
        });
        drawCenteredText('APPLICATION FOR SCHOLARSHIP', left, 150, contentWidth, {
            font: boldFont,
            size: 14,
        });
        drawCenteredText(
            `${detail.semester || 'N/A'} SEMESTER, A.Y ${detail.school_year || 'N/A'}`,
            left,
            177,
            contentWidth,
            {
                font: boldFont,
                size: 11.5,
            }
        );

        let cursorY = 214;
        drawFieldRow(cursorY, 'NAME:', detail.student_name || 'N/A');
        cursorY += 34;

        const courseWidth = contentWidth * 0.46;
        const yearWidth = contentWidth * 0.26;
        const sectionWidth = contentWidth - courseWidth - yearWidth;
        drawBox(left, cursorY, courseWidth, 34);
        drawBox(left + courseWidth, cursorY, yearWidth, 34);
        drawBox(left + courseWidth + yearWidth, cursorY, sectionWidth, 34);
        doc.font(boldFont).fontSize(9)
            .text('COURSE:', left + 10, cursorY + 10)
            .text('YEAR:', left + courseWidth + 10, cursorY + 10)
            .text('SECTION:', left + courseWidth + yearWidth + 10, cursorY + 10);
        doc.font(baseFont).fontSize(10)
            .text(detail.course_display || formatCourseDisplay(detail), left + 68, cursorY + 10, { width: courseWidth - 78 })
            .text(String(detail.year_level || 'N/A'), left + courseWidth + 54, cursorY + 10, { width: yearWidth - 64 })
            .text(studentSection, left + courseWidth + yearWidth + 64, cursorY + 10, { width: sectionWidth - 74 });
        cursorY += 34;

        drawBox(left, cursorY, contentWidth, 58);
        doc.font(baseFont).fontSize(11).text(
            'Respectfully endorsing the above named student under the following circumstances:',
            left + 10,
            cursorY + 13,
            { width: contentWidth - 20, align: 'left' }
        );
        cursorY += 58;

        drawBox(left, cursorY, contentWidth, 28);
        drawCenteredText('BASED ON THE RECORD ON FILE', left, cursorY + 7, contentWidth, {
            font: boldFont,
            size: 11.5,
        });
        cursorY += 28;

        drawOfficeSection({
            top: cursorY,
            leftItems: [
                {
                    label: 'Good Scholastic Standing',
                    checked: officeResults.pd === CHECKBOX_LABELS.pd[PD_RESULTS.GOOD_SCHOLASTIC_STANDING],
                },
                {
                    label: 'Average Scholastic Standing',
                    checked: officeResults.pd === CHECKBOX_LABELS.pd[PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING],
                },
            ],
            signatureTitle: 'Name & Signature\nProgram Director',
            signatoryName: officeSignatories.pd || detail.stages?.find((stage) => stage.key === 'pd')?.acted_by_name,
            height: 92,
        });
        cursorY += 92;

        drawOfficeSection({
            top: cursorY,
            leftItems: [
                {
                    label: 'No Disciplinary Offense',
                    checked: officeResults.sdo === CHECKBOX_LABELS.sdo[SDO_RESULTS.NO_OFFENSE],
                },
                {
                    label: 'With Minor Offense/s',
                    checked: officeResults.sdo === CHECKBOX_LABELS.sdo[SDO_RESULTS.MINOR_OFFENSE],
                },
                {
                    label: 'With Major Offense/s',
                    checked: officeResults.sdo === CHECKBOX_LABELS.sdo[SDO_RESULTS.MAJOR_OFFENSE],
                },
            ],
            signatureTitle: 'Name & Signature\nStudent Discipline Officer',
            signatoryName: officeSignatories.sdo || detail.stages?.find((stage) => stage.key === 'sdo')?.acted_by_name,
            height: 92,
        });
        cursorY += 92;

        drawOfficeSection({
            top: cursorY,
            leftItems: [
                {
                    label: 'Good Moral Standing',
                    checked:
                        officeResults.guidance ===
                        CHECKBOX_LABELS.guidance[GUIDANCE_RESULTS.GOOD_MORAL_STANDING],
                },
            ],
            signatureTitle: 'Name & Signature\nGuidance Counselor',
            signatoryName:
                officeSignatories.guidance || detail.stages?.find((stage) => stage.key === 'guidance')?.acted_by_name,
            height: 76,
        });
        cursorY += 76;

        drawBox(left, cursorY, contentWidth, 54);
        doc.font(boldFont).fontSize(9).text('REMARKS:', left + 10, cursorY + 10);
        doc.font(baseFont).fontSize(8.5).text(summaryRemarks, left + 86, cursorY + 10, {
            width: contentWidth - 96,
            height: 34,
        });
        cursorY += 54;

        drawBox(left, cursorY, contentWidth, 78);
        doc.font(baseFont).fontSize(sectionLabelFontSize).fillColor('#374151');
        doc.text(
            `Submitted: ${detail.submitted_at ? new Date(detail.submitted_at).toLocaleString('en-PH') : 'N/A'}`,
            left + 10,
            cursorY + 10
        );
        doc.text(
            `Completed: ${detail.completed_at ? new Date(detail.completed_at).toLocaleString('en-PH') : 'N/A'}`,
            left + 10,
            cursorY + 23
        );
        doc.text(`Slip Code: ${detail.slip_code || deriveSlipCode(detail.slip_id)}`, left + 10, cursorY + 36);
        doc.text(`Verification URL: ${verificationUrl}`, left + 10, cursorY + 49, {
            width: contentWidth - 150,
        });
        doc.image(qrBuffer, right - 86, cursorY + 7, { width: 58, height: 58 });
        doc.end();
    });
}

async function storeCompletedSlipPdf(detail) {
    const pdfBuffer = await buildCompletedSlipPdf(detail);
    const fileName = `endorsement-slip-${detail.slip_id}.pdf`;
    const storagePath = `endorsement-slips/${detail.slip_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
        });

    if (uploadError) {
        throw createHttpError(500, uploadError.message);
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 30, {
            download: fileName,
        });

    if (signedUrlError) {
        throw createHttpError(500, signedUrlError.message);
    }

    return {
        path: storagePath,
        url: signedUrlData?.signedUrl || '',
    };
}

async function finalizeCompletedSlip(slipId) {
    const detailBeforePdf = await fetchSlipDetail(slipId);
    const pdf = await storeCompletedSlipPdf(detailBeforePdf);

    await pool.query(
        `
        update endorsement_slips
        set final_pdf_url = $2,
            final_pdf_path = $3,
            completed_at = coalesce(completed_at, now()),
            updated_at = now()
        where slip_id = $1
        `,
        [slipId, pdf.url, pdf.path]
    );

    return fetchSlipDetail(slipId);
}

async function buildSlipPdfDownload(slipId, actor = null) {
    const detail = await fetchSlipDetail(slipId, actor);
    const pdfBuffer = await buildCompletedSlipPdf(detail);
    return {
        fileName: `endorsement-slip-${detail.slip_code || deriveSlipCode(detail.slip_id)}.pdf`,
        buffer: pdfBuffer,
    };
}

function buildStageUpdate(queueKey, payload, actorUserId, context = {}) {
    const now = new Date().toISOString();
    const rawAction = safeText(payload?.action).toLowerCase();
    const remarks = safeText(payload?.remarks);

    if (queueKey === 'sdo') {
        const result = normalizeSdoAction(rawAction);
        if (!result) {
            throw createHttpError(
                400,
                'SDO result must be no_offense, minor_offense, or major_offense.'
            );
        }

        // The paper endorsement slip records only the disciplinary standing.
        // Detailed offense records remain in the separate SDO disciplinary module.
        const continuesToGuidance = isSdoContinuingResult(result);
        const nextStage = continuesToGuidance
            ? ENDORSEMENT_STAGES.PENDING_GUIDANCE
            : ENDORSEMENT_STAGES.DISQUALIFIED_MAJOR;

        return {
            action: result,
            sql: `
                update endorsement_slips
                set sdo_status = $2,
                    sdo_acted_at = $3,
                    sdo_acted_by_user_id = $4,
                    sdo_remarks = $5,
                    sdo_offense_type = null,
                    sdo_incident_date = null,
                    sdo_case_reference_number = null,
                    current_stage = $6,
                    overall_status = $7,
                    updated_at = now()
                where slip_id = $1
                  and current_stage = 'pending_sdo'
                returning *
            `,
            values: [
                null,
                result,
                now,
                actorUserId,
                remarks || SDO_STANDARD_REASONS[result] || null,
                nextStage,
                nextStage,
            ],
        };
    }

    if (queueKey === 'guidance') {
        const result = normalizeGuidanceAction(rawAction);
        if (result !== GUIDANCE_RESULTS.GOOD_MORAL_STANDING) {
            throw createHttpError(400, 'Guidance result must be good_moral_standing.');
        }

        return {
            action: result,
            sql: `
                update endorsement_slips
                set guidance_status = $2,
                    guidance_acted_at = $3,
                    guidance_acted_by_user_id = $4,
                    guidance_remarks = $5,
                    current_stage = $6,
                    overall_status = $7,
                    updated_at = now()
                where slip_id = $1
                  and current_stage = 'pending_guidance'
                returning *
            `,
            values: [
                null,
                result,
                now,
                actorUserId,
                remarks || null,
                ENDORSEMENT_STAGES.PENDING_PD,
                ENDORSEMENT_STAGES.PENDING_PD,
            ],
        };
    }

    if (queueKey === 'pd') {
        const result = normalizePdAction(rawAction, {
            scholasticStanding: payload?.scholastic_standing,
            gwa: context.gwa,
        });
        if (!result) {
            throw createHttpError(
                400,
                'PD result must be good_scholastic_standing or average_scholastic_standing.'
            );
        }

        return {
            action: result,
            sql: `
                update endorsement_slips
                set pd_status = $2,
                    pd_acted_at = $3,
                    pd_acted_by_user_id = $4,
                    pd_remarks = $5,
                    current_stage = $6,
                    overall_status = $7,
                    completed_at = coalesce(completed_at, now()),
                    updated_at = now()
                where slip_id = $1
                  and current_stage = 'pending_pd'
                returning *
            `,
            values: [
                null,
                result,
                now,
                actorUserId,
                remarks || null,
                ENDORSEMENT_STAGES.COMPLETED,
                ENDORSEMENT_STAGES.COMPLETED,
            ],
        };
    }

    throw createHttpError(400, 'Unsupported endorsement action.');
}

async function applyStageAction(queueKey, slipId, payload, actor) {
    const config = ensureQueueAccess(queueKey, actor);
    const action = safeText(payload?.action).toLowerCase();
    const actorUserId = getActorUserId(actor);

    if (!actorUserId) {
        throw createHttpError(401, 'Authenticated user is required.');
    }

    const client = await pool.connect();
    try {
        await client.query('begin');

        const currentResult = await client.query(
            `
            select
                es.*,
                st.course_id,
                st.gwa,
                trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
                a.verification_status as application_verification_status,
                a.requirements_verified_at,
                a.application_status as linked_application_status,
                a.is_archived as application_is_archived,
                a.is_disqualified as application_is_disqualified
            from endorsement_slips es
            join students st on st.student_id = es.student_id
            join applications a on a.application_id = es.application_id
            where es.slip_id = $1
            for update
            `,
            [slipId]
        );

        if (!currentResult.rows.length) {
            throw createHttpError(404, 'Endorsement slip not found.');
        }

        const currentSlip = currentResult.rows[0];

        // A stale/direct URL cannot bypass the same eligibility rule used by
        // the visible SDO/Guidance/PD queues.
        assertVerifiedApplicationForEndorsement(currentSlip);
        if (queueKey === 'pd') {
            await pdCourseAssignmentService.assertCourseAccess({
                userId: actorUserId,
                courseId: currentSlip.course_id,
                role: actor?.role,
                client,
            });
        }
        const isCurrentQueueStage = currentSlip.current_stage === config.stage;

        if (queueKey === 'pd' && normalizePdAction(action, {
            scholasticStanding: payload?.scholastic_standing,
            gwa: currentSlip.gwa,
        })) {
            const gradeDocumentResult = await client.query(`
                select ad.document_id
                from application_documents ad
                where ad.application_id = $1
                  and lower(coalesce(ad.document_type, '')) = 'grade report'
                  and coalesce(ad.is_submitted, false) = true
                  and (
                    nullif(trim(coalesce(ad.file_path, '')), '') is not null
                    or nullif(trim(coalesce(ad.file_url, '')), '') is not null
                  )
                limit 1
            `, [currentSlip.application_id]);
            if (!gradeDocumentResult.rows.length) {
                throw createHttpError(409, 'A Grade Report is required for Program Director review.');
            }
        }

        if (!isCurrentQueueStage) {
            throw createHttpError(409, 'This endorsement slip is no longer pending in your queue.');
        }

        const mutation = buildStageUpdate(queueKey, payload, actorUserId, currentSlip);
        mutation.values[0] = slipId;
        const updated = await client.query(mutation.sql, mutation.values);

        if (!updated.rows.length) {
            throw createHttpError(409, 'Unable to update endorsement slip.');
        }

        await client.query(
            `
            update applications
            set updated_at = now()
            where application_id = $1
            `,
            [updated.rows[0].application_id]
        );

        await client.query('commit');

        const nextStageNotifications = await notifyNextStage({
            slipId,
            queueKey,
            studentName: currentSlip.student_name || 'A student',
            courseId: currentSlip.course_id,
        });

        const adminNotifications = await notifyAdminOfEndorsementOutcome({
            slipId,
            studentName: currentSlip.student_name || 'A student',
            overallStatus: updated.rows[0].overall_status,
        });
        const notifications = [
            ...(nextStageNotifications || []),
            ...(adminNotifications || []),
        ];

        let finalizedDetail = await fetchSlipDetail(slipId, actor);
        let pdfError = null;
        if (queueKey === 'pd' && finalizedDetail.overall_status === 'completed') {
            try {
                finalizedDetail = await finalizeCompletedSlip(slipId);
            } catch (error) {
                pdfError = error.message || 'Failed to generate final PDF.';
            }

            // The applicant becomes FCFS-ready at the exact time the second
            // readiness requirement is completed. Recalculate the opening
            // queue immediately after PD completion.
            try {
                await readinessQueueService.syncApplicationReadiness(
                    finalizedDetail.application_id
                );
            } catch (queueError) {
                console.error(
                    'ENDORSEMENT READINESS QUEUE SYNC ERROR:',
                    queueError.message || queueError
                );
            }
        }

        return {
            slip: finalizedDetail,
            notifications: notifications || [],
            emittedStage: finalizedDetail.current_stage,
            action: mutation.action || action,
            pdfError,
        };
    } catch (error) {
        await client.query('rollback');
        throw error;
    } finally {
        client.release();
    }
}

async function fetchVerificationPayload(token) {
    const { rows } = await pool.query(
        `
        select
            es.slip_id,
            es.application_id,
            es.student_id,
            es.current_stage,
            es.overall_status,
            es.completed_at,
            es.pd_status,
            es.pd_acted_at,
            es.pd_remarks,
            es.guidance_status,
            es.guidance_acted_at,
            es.guidance_remarks,
            es.sdo_status,
            es.sdo_acted_at,
            es.sdo_remarks,
            st.pdm_id,
            st.gwa,
            coalesce(st.course_id, smr.course_id) as course_id,
            trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
            ac.course_code,
            ac.course_name,
            sp.program_name,
            ay.label as school_year,
            ap.term as semester,
            pd_user.email as pd_actor_email,
            pd_profile.first_name as pd_actor_first_name,
            pd_profile.last_name as pd_actor_last_name,
            guidance_user.email as guidance_actor_email,
            guidance_profile.first_name as guidance_actor_first_name,
            guidance_profile.last_name as guidance_actor_last_name,
            sdo_user.email as sdo_actor_email,
            sdo_profile.first_name as sdo_actor_first_name,
            sdo_profile.last_name as sdo_actor_last_name
        from endorsement_slips es
        join students st on st.student_id = es.student_id
        left join applications a on a.application_id = es.application_id
        left join student_master_records smr on smr.master_student_id = st.master_student_id
        left join academic_course ac on ac.course_id = coalesce(st.course_id, smr.course_id)
        left join scholarship_program sp on sp.program_id = a.program_id
        left join program_openings po on po.opening_id = a.opening_id
        left join academic_years ay on ay.academic_year_id = po.academic_year_id
        left join academic_period ap on ap.period_id = po.period_id
        left join users pd_user on pd_user.user_id = es.pd_acted_by_user_id
        left join admin_profiles pd_profile on pd_profile.user_id = es.pd_acted_by_user_id
        left join users guidance_user on guidance_user.user_id = es.guidance_acted_by_user_id
        left join admin_profiles guidance_profile on guidance_profile.user_id = es.guidance_acted_by_user_id
        left join users sdo_user on sdo_user.user_id = es.sdo_acted_by_user_id
        left join admin_profiles sdo_profile on sdo_profile.user_id = es.sdo_acted_by_user_id
        where es.verification_token = $1
        limit 1
        `,
        [token]
    );

    if (!rows.length) {
        throw createHttpError(404, 'Verification token not found.');
    }

    const row = rows[0];
    const tracker = buildProgressTracker(row);
    const officeResults = mapPaperOfficeResults(row);
    const officeSignatories = {
        sdo: [row.sdo_actor_first_name, row.sdo_actor_last_name].filter(Boolean).join(' ') || row.sdo_actor_email || '',
        guidance:
            [row.guidance_actor_first_name, row.guidance_actor_last_name].filter(Boolean).join(' ') ||
            row.guidance_actor_email ||
            '',
        pd: [row.pd_actor_first_name, row.pd_actor_last_name].filter(Boolean).join(' ') || row.pd_actor_email || '',
    };
    return {
        verified: row.overall_status === 'completed',
        slip_id: row.slip_id,
        slip_code: deriveSlipCode(row.slip_id),
        application_id: row.application_id,
        student_name: row.student_name || 'Unknown Student',
        pdm_id: row.pdm_id || 'N/A',
        course_code: row.course_code || '',
        course_name: row.course_name || '',
        course_display: formatCourseDisplay(row),
        year_level: row.year_level || '',
        program_name: row.program_name || 'N/A',
        semester: row.semester || '',
        school_year: row.school_year || '',
        current_stage: row.current_stage,
        current_stage_label: tracker.current_stage_label,
        overall_status: row.overall_status,
        overall_status_label: tracker.overall_status_label,
        current_label: tracker.current_label,
        completed_at: row.completed_at,
        tracker,
        office_results: officeResults,
        office_signatories: officeSignatories,
        sdo_offense_detail: {
            offense_type: row.sdo_offense_type || '',
            incident_date: row.sdo_incident_date || null,
            case_reference_number: row.sdo_case_reference_number || '',
        },
        stages: {
            sdo: {
                decision: row.sdo_status,
                result_label: officeResults.sdo,
                acted_at: row.sdo_acted_at,
                acted_by_name: officeSignatories.sdo,
                remarks: row.sdo_remarks || '',
            },
            guidance: {
                decision: row.guidance_status,
                result_label: officeResults.guidance,
                acted_at: row.guidance_acted_at,
                acted_by_name: officeSignatories.guidance,
                remarks: row.guidance_remarks || '',
            },
            pd: {
                decision: row.pd_status,
                result_label: officeResults.pd,
                acted_at: row.pd_acted_at,
                acted_by_name: officeSignatories.pd,
                remarks: row.pd_remarks || '',
            },
        },
    };
}

async function sendPendingDigestForRole(role) {
    if (!transporter) {
        return { sent: 0, skipped: 'mailer_unavailable' };
    }

    const queueKey = role === 'pd' ? 'pd' : role === 'guidance' ? 'guidance' : role === 'sdo' ? 'sdo' : null;
    if (!queueKey) {
        return { sent: 0, skipped: 'unsupported_role' };
    }

    const recipients = await fetchStaffTargetsByRole(role);
    if (!recipients.length) {
        return { sent: 0, role, skipped: 'no_recipients' };
    }

    const queueUrl = `${FRONTEND_BASE_URL}/${queueKey}/dashboard`;
    let sent = 0;
    for (const recipient of recipients) {
        const rows = await loadSlipRows({
            stage: QUEUE_CONFIG[queueKey].stage,
            actor: role === 'pd' ? { role: 'pd', userId: recipient.user_id } : null,
        });
        if (!rows.length) continue;
        const previewItems = rows
            .slice(0, 10)
            .map((row) => `<li>${row.student_name} (${row.pdm_id}) - ${row.program_name}</li>`)
            .join('');
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: recipient.email,
            subject: `[SMaRT-PDM] ${role.toUpperCase()} queue digest`,
            html: `
                <p>Hello ${recipient.name},</p>
                <p>You have <strong>${rows.length}</strong> pending endorsement request(s) in your queue.</p>
                <ul>${previewItems}</ul>
                <p><a href="${queueUrl}">Open pending queue</a></p>
            `,
        });
        sent += 1;
    }

    return {
        sent,
        role,
    };
}

async function sendPendingDigests() {
    const roles = ['pd', 'guidance', 'sdo'];
    const results = [];
    for (const role of roles) {
        try {
            results.push(await sendPendingDigestForRole(role));
        } catch (error) {
            console.error(`ENDORSEMENT DIGEST ERROR [${role}]:`, error.message || error);
            results.push({ role, sent: 0, error: error.message || String(error) });
        }
    }
    return results;
}

async function ensureSlipForApplication(applicationId) {
    if (!applicationId) return null;
    const { rows } = await pool.query(
        `
        insert into endorsement_slips (
            application_id,
            student_id,
            opening_id,
            current_stage,
            overall_status,
            verification_token
        )
        select
            a.application_id,
            a.student_id,
            a.opening_id,
            'pending_sdo',
            'pending_sdo',
            encode(gen_random_bytes(24), 'hex')
        from applications a
        where a.application_id = $1
        on conflict (application_id) do nothing
        returning slip_id
        `,
        [applicationId]
    );

    await pool.query('select public.sync_endorsement_slip_grade_summary($1)', [applicationId]);
    return rows[0] || null;
}

module.exports = {
    fetchQueue,
    fetchAllSlips,
    fetchSlipDetail,
    applyStageAction,
    fetchVerificationPayload,
    buildSlipPdfDownload,
    sendPendingDigests,
    ensureSlipForApplication,
};
