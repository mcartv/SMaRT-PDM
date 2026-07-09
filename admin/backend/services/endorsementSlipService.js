const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const pool = require('../config/db');
const supabase = require('../config/supabase');
const { transporter } = require('../config/mailer');
const notificationService = require('./notificationService');
const { resolveStaffRole } = require('../utils/staffRoles');

const STORAGE_BUCKET =
    process.env.SUPABASE_APPLICATION_DOCUMENT_BUCKET || 'documents';
const FRONTEND_BASE_URL =
    (process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
const PDFKIT_MODULE = 'pdfkit';
const QRCODE_MODULE = 'qrcode';
const SCHOOL_LOGO_PATH = path.resolve(
    __dirname,
    '../../../mobile/smartpdm_mobileapp/assets/images/school_logo.png'
);
const INSTITUTION_NAME = 'PAMBAYANG DALUBHASAAN NG MARILAO';
const INSTITUTION_ADDRESS = 'Abangan Norte, Marilao, Bulacan';
const SCHOLARSHIP_OFFICE_LABEL = 'OFFICE OF SCHOLARSHIP AND FINANCIAL ASSISTANCE (OSFA)';

const QUEUE_CONFIG = Object.freeze({
    sdo: {
        allowedRoles: ['sdo', 'admin'],
        stage: 'pending_sdo',
        nextRole: 'guidance',
        nextTitle: 'Guidance clearance pending',
    },
    guidance: {
        allowedRoles: ['guidance', 'admin'],
        stage: 'pending_guidance',
        nextRole: 'pd',
        nextTitle: 'PD approval pending',
    },
    pd: {
        allowedRoles: ['pd', 'admin'],
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
    rejected: 'Rejected by Program Director',
    guidance_rejected: 'Rejected by Guidance',
    held: 'Held by Guidance',
    disqualified_minor: 'Disqualified (Minor)',
    disqualified_major: 'Disqualified (Major)',
});

const PROGRESS_STEPS = Object.freeze([
    { key: 'sdo', label: 'SDO' },
    { key: 'guidance', label: 'Guidance' },
    { key: 'pd', label: 'Program Director' },
]);

const SDO_STANDARD_REASONS = Object.freeze({
    cleared: 'No record - cleared.',
    disqualified_minor: 'Minor offense noted and forwarded to Guidance.',
    disqualified_major: 'Major offense - disqualified.',
});

const CHECKBOX_LABELS = Object.freeze({
    sdo: {
        cleared: 'No Offense',
        disqualified_minor: 'Minor Offense',
        disqualified_major: 'Major Offense',
    },
    guidance: {
        cleared: 'Good Moral Standing',
        held: 'For Counseling / Hold',
        rejected: 'Rejected',
    },
    pd: {
        approved_good_average: 'Good Average Scholastic Standing',
        approved_average: 'Average Scholastic Standing',
        rejected: 'Rejected by Program Director',
    },
});

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
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

function derivePdCheckboxResult(gwa) {
    const numericGwa = Number(gwa);
    if (!Number.isFinite(numericGwa)) {
        return CHECKBOX_LABELS.pd.approved_average;
    }

    return numericGwa <= 1.75
        ? CHECKBOX_LABELS.pd.approved_good_average
        : CHECKBOX_LABELS.pd.approved_average;
}

function mapPaperOfficeResults(row = {}) {
    return {
        sdo: CHECKBOX_LABELS.sdo[row.sdo_status] || null,
        guidance: CHECKBOX_LABELS.guidance[row.guidance_status] || null,
        pd:
            row.pd_status === 'approved'
                ? derivePdCheckboxResult(row.gwa)
                : row.pd_status === 'rejected'
                    ? CHECKBOX_LABELS.pd.rejected
                    : null,
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
                ['cleared', 'disqualified_minor'].includes(sdo_status) ||
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
            } else if (guidance_status === 'cleared' || ['pending_pd', 'completed', 'rejected'].includes(overall_status)) {
                state = 'completed';
            }
        }

        if (step.key === 'pd') {
            decision = pd_status || null;

            if (overall_status === 'rejected') {
                state = 'stopped';
            } else if (current_stage === 'pending_pd') {
                state = 'active';
            } else if (overall_status === 'completed' || pd_status === 'approved') {
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

function mapQueueRow(row) {
    const tracker = buildProgressTracker(row);
    const officeResults = mapPaperOfficeResults(row);
    const stages = [
        {
            key: 'sdo',
            label: 'SDO Clearance',
            status: row.sdo_status || null,
            result_label: officeResults.sdo || null,
            acted_at: row.sdo_acted_at || null,
        },
        {
            key: 'guidance',
            label: 'Guidance Clearance',
            status: row.guidance_status || null,
            result_label: officeResults.guidance || null,
            acted_at: row.guidance_acted_at || null,
        },
        {
            key: 'pd',
            label: 'Program Director Approval',
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
        grade_document: {
            url: row.grade_document_url || '',
            file_name: row.grade_document_name || '',
            submitted_at: row.grade_document_submitted_at || null,
        },
        pd_decision: row.pd_status || null,
        guidance_decision: row.guidance_status || null,
        sdo_decision: row.sdo_status || null,
        sdo_offense_detail: {
            offense_type: row.sdo_offense_type || '',
            incident_date: row.sdo_incident_date || null,
            case_reference_number: row.sdo_case_reference_number || '',
        },
        office_results: officeResults,
        per_office_statuses: tracker.per_office_statuses,
        tracker,
        stages,
        final_pdf_url: row.final_pdf_url || null,
        completed_at: row.completed_at,
    };
}

async function loadSlipRows({ stage = null, stages = null } = {}) {
    const params = [];
    const normalizedStages = Array.isArray(stages)
        ? stages.map((value) => safeText(value)).filter(Boolean)
        : [];
    let whereClause = '';

    if (normalizedStages.length > 0) {
        whereClause = `where es.current_stage = any($1::text[])`;
        params.push(normalizedStages);
    } else if (stage) {
        whereClause = `where es.current_stage = $1`;
        params.push(stage);
    }

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
            st.year_level,
            trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
            ac.course_code,
            sp.program_name,
            po.opening_title,
            ay.label as school_year,
            ap.term as semester,
            grade_doc.file_url as grade_document_url,
            grade_doc.file_name as grade_document_name,
            grade_doc.submitted_at as grade_document_submitted_at
        from endorsement_slips es
        join applications a on a.application_id = es.application_id
        join students st on st.student_id = es.student_id
        left join academic_course ac on ac.course_id = st.course_id
        left join scholarship_program sp on sp.program_id = a.program_id
        left join program_openings po on po.opening_id = a.opening_id
        left join academic_years ay on ay.academic_year_id = po.academic_year_id
        left join academic_period ap on ap.period_id = po.period_id
        left join lateral (
            select ad.file_url, ad.file_name, ad.submitted_at
            from application_documents ad
            where ad.application_id = a.application_id
              and lower(coalesce(ad.document_type, '')) = 'grade report'
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

    return rows.map(mapQueueRow);
}

async function fetchQueue(queueKey, actor) {
    const config = ensureQueueAccess(queueKey, actor);
    if (queueKey === 'guidance') {
        return loadSlipRows({ stages: ['pending_guidance', 'held'] });
    }

    return loadSlipRows({ stage: config.stage });
}

async function fetchAllSlips(actor) {
    ensureTrackerAccess(actor);
    return loadSlipRows();
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
            st.pdm_id,
            st.gwa,
            st.year_level,
            trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
            st.first_name,
            st.last_name,
            u.email as student_email,
            ac.course_code,
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
        left join academic_course ac on ac.course_id = st.course_id
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
        limit 1
        `,
        [slipId]
    );

    if (!rows.length) {
        throw createHttpError(404, 'Endorsement slip not found.');
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
    const documentRows = await pool.query(
        `
        select
            document_id,
            document_type,
            file_name,
            file_url,
            submitted_at,
            notes
        from application_documents
        where application_id = $1
        order by submitted_at desc nulls last, document_type asc
        `,
        [row.application_id]
    );

    return {
        slip_id: row.slip_id,
        slip_code: deriveSlipCode(row.slip_id),
        application_id: row.application_id,
        student_id: row.student_id,
        student_name: row.student_name || 'Unknown Student',
        pdm_id: row.pdm_id || 'N/A',
        course_code: row.course_code || 'N/A',
        year_level: row.year_level || null,
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
        documents: documentRows.rows,
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
                label: 'SDO Clearance',
                status: row.sdo_status || (row.current_stage === 'pending_sdo' ? 'pending' : 'not_started'),
                result_label: officeResults.sdo,
                acted_at: row.sdo_acted_at,
                acted_by_user_id: row.sdo_acted_by_user_id,
                acted_by_name: officeSignatories.sdo,
                remarks: row.sdo_remarks || '',
            },
            {
                key: 'guidance',
                label: 'Guidance Clearance',
                status: row.guidance_status || (row.current_stage === 'pending_guidance' ? 'pending' : 'not_started'),
                result_label: officeResults.guidance,
                acted_at: row.guidance_acted_at,
                acted_by_user_id: row.guidance_acted_by_user_id,
                acted_by_name: officeSignatories.guidance,
                remarks: row.guidance_remarks || '',
            },
            {
                key: 'pd',
                label: 'Program Director Approval',
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

async function fetchStaffTargetsByRole(role) {
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

    return rows
        .filter((row) => resolveStaffRole(row) === role)
        .filter((row) => safeText(row.email))
        .map((row) => ({
            user_id: row.user_id,
            email: row.email,
            name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email,
        }));
}

async function notifyNextStage({ slipId, queueKey, studentName }) {
    const config = QUEUE_CONFIG[queueKey];
    if (!config?.nextRole) {
        return;
    }

    const targets = await fetchStaffTargetsByRole(config.nextRole);
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
            .text(detail.course_code || 'N/A', left + 68, cursorY + 10, { width: courseWidth - 78 })
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
                    checked: officeResults.pd === CHECKBOX_LABELS.pd.approved_good_average,
                },
                {
                    label: 'Average Scholastic Standing',
                    checked: officeResults.pd === CHECKBOX_LABELS.pd.approved_average,
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
                    label: 'No Disciplinary Offense/s',
                    checked: officeResults.sdo === CHECKBOX_LABELS.sdo.cleared,
                },
                {
                    label: 'With Minor Offense/s',
                    checked: officeResults.sdo === CHECKBOX_LABELS.sdo.disqualified_minor,
                },
                {
                    label: 'With Major Offense/s',
                    checked: officeResults.sdo === CHECKBOX_LABELS.sdo.disqualified_major,
                },
            ],
            signatureTitle: 'Name & Signature\nStudent Discipline Officer',
            signatoryName: officeSignatories.sdo || detail.stages?.find((stage) => stage.key === 'sdo')?.acted_by_name,
            extraDetails: [
                safeText(detail.sdo_offense_detail?.offense_type)
                    ? `Offense Type: ${safeText(detail.sdo_offense_detail?.offense_type)}`
                    : '',
                safeText(detail.sdo_offense_detail?.incident_date)
                    ? `Date of Incident: ${safeText(detail.sdo_offense_detail?.incident_date)}`
                    : '',
                safeText(detail.sdo_offense_detail?.case_reference_number)
                    ? `Case Note / Ref No.: ${safeText(detail.sdo_offense_detail?.case_reference_number)}`
                    : '',
            ].filter(Boolean),
            height: 116,
        });
        cursorY += 116;

        drawOfficeSection({
            top: cursorY,
            leftItems: [
                {
                    label: 'Good Moral Standing',
                    checked: officeResults.guidance === CHECKBOX_LABELS.guidance.cleared,
                },
                {
                    label: 'For Counseling / Hold',
                    checked: officeResults.guidance === CHECKBOX_LABELS.guidance.held,
                },
                {
                    label: 'Rejected',
                    checked: officeResults.guidance === CHECKBOX_LABELS.guidance.rejected,
                },
            ],
            signatureTitle: 'Name & Signature\nGuidance Counselor',
            signatoryName:
                officeSignatories.guidance || detail.stages?.find((stage) => stage.key === 'guidance')?.acted_by_name,
            height: 108,
        });
        cursorY += 108;

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

function buildStageUpdate(queueKey, payload, actorUserId) {
    const now = new Date().toISOString();
    const action = safeText(payload?.action).toLowerCase();
    const remarks = safeText(payload?.remarks);

    if (queueKey === 'sdo') {
        if (!['clear', 'disqualify_minor', 'disqualify_major'].includes(action)) {
            throw createHttpError(400, 'SDO action is invalid.');
        }

        const normalizedAction =
            action === 'clear'
                ? 'cleared'
                : action === 'disqualify_minor'
                    ? 'disqualified_minor'
                    : 'disqualified_major';
        const offenseType = safeText(payload?.offense_type);
        const incidentDate = safeText(payload?.incident_date);
        const caseReferenceNumber = safeText(payload?.case_reference_number);

        if (normalizedAction !== 'cleared' && !remarks) {
            throw createHttpError(400, 'SDO remarks are required for minor or major offense.');
        }
        if (normalizedAction !== 'cleared' && !offenseType) {
            throw createHttpError(400, 'Offense type is required for minor or major offense.');
        }

        return {
            sql: `
                update endorsement_slips
                set sdo_status = $2,
                    sdo_acted_at = $3,
                    sdo_acted_by_user_id = $4,
                    sdo_remarks = $5,
                    sdo_offense_type = $6,
                    sdo_incident_date = $7,
                    sdo_case_reference_number = $8,
                    current_stage = $9,
                    overall_status = $10,
                    updated_at = now()
                where slip_id = $1
                  and current_stage = 'pending_sdo'
                returning *
            `,
            values: [
                null,
                normalizedAction,
                now,
                actorUserId,
                remarks || SDO_STANDARD_REASONS[normalizedAction] || null,
                normalizedAction === 'cleared' ? null : offenseType || null,
                normalizedAction === 'cleared' ? null : incidentDate || null,
                normalizedAction === 'cleared' ? null : caseReferenceNumber || null,
                ['cleared', 'disqualified_minor'].includes(normalizedAction) ? 'pending_guidance' : normalizedAction,
                ['cleared', 'disqualified_minor'].includes(normalizedAction) ? 'pending_guidance' : normalizedAction,
            ],
        };
    }

    if (queueKey === 'guidance') {
        if (!['clear', 'hold', 'reject'].includes(action)) {
            throw createHttpError(400, 'Guidance action must be clear, hold, or reject.');
        }
        if (['hold', 'reject'].includes(action) && !remarks) {
            throw createHttpError(400, 'Guidance hold or rejection requires a reason.');
        }

        return {
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
                  and current_stage in ('pending_guidance', 'held')
                returning *
            `,
            values: [
                null,
                action === 'clear' ? 'cleared' : action === 'hold' ? 'held' : 'rejected',
                now,
                actorUserId,
                remarks || null,
                action === 'clear' ? 'pending_pd' : action === 'hold' ? 'held' : 'guidance_rejected',
                action === 'clear' ? 'pending_pd' : action === 'hold' ? 'held' : 'guidance_rejected',
            ],
        };
    }

    if (queueKey === 'pd') {
        if (!['approve', 'reject'].includes(action)) {
            throw createHttpError(400, 'PD action must be approve or reject.');
        }

        return {
            sql: `
                update endorsement_slips
                set pd_status = $2,
                    pd_acted_at = $3,
                    pd_acted_by_user_id = $4,
                    pd_remarks = $5,
                    current_stage = $6,
                    overall_status = $7,
                    completed_at = case when $6 = 'completed' then coalesce(completed_at, now()) else completed_at end,
                    updated_at = now()
                where slip_id = $1
                  and current_stage = 'pending_pd'
                returning *
            `,
            values: [
                null,
                action === 'approve' ? 'approved' : 'rejected',
                now,
                actorUserId,
                remarks || null,
                action === 'approve' ? 'completed' : 'rejected',
                action === 'approve' ? 'completed' : 'rejected',
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
        throw createHttpError(401, 'Authenticated staff user is required.');
    }

    const client = await pool.connect();
    try {
        await client.query('begin');

        const currentResult = await client.query(
            `
            select es.*, trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name
            from endorsement_slips es
            join students st on st.student_id = es.student_id
            where es.slip_id = $1
            for update
            `,
            [slipId]
        );

        if (!currentResult.rows.length) {
            throw createHttpError(404, 'Endorsement slip not found.');
        }

        const currentSlip = currentResult.rows[0];
        const isHeldGuidanceResolution =
            queueKey === 'guidance' &&
            currentSlip.current_stage === 'held' &&
            ['clear', 'reject'].includes(action);
        const isCurrentQueueStage = currentSlip.current_stage === config.stage;

        if (!isCurrentQueueStage && !isHeldGuidanceResolution) {
            throw createHttpError(409, 'This endorsement slip is no longer pending in your queue.');
        }

        const mutation = buildStageUpdate(queueKey, payload, actorUserId);
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

        const notifications = await notifyNextStage({
            slipId,
            queueKey,
            studentName: currentSlip.student_name || 'A student',
        });

        let finalizedDetail = await fetchSlipDetail(slipId, actor);
        let pdfError = null;
        if (queueKey === 'pd' && finalizedDetail.overall_status === 'completed') {
            try {
                finalizedDetail = await finalizeCompletedSlip(slipId);
            } catch (error) {
                pdfError = error.message || 'Failed to generate final PDF.';
            }
        }

        return {
            slip: finalizedDetail,
            notifications: notifications || [],
            emittedStage: finalizedDetail.current_stage,
            action,
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
            es.sdo_offense_type,
            es.sdo_incident_date,
            es.sdo_case_reference_number,
            st.pdm_id,
            st.gwa,
            trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
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

    const rows = await loadSlipRows({ stage: QUEUE_CONFIG[queueKey].stage });
    if (!rows.length) {
        return { sent: 0, role };
    }

    const recipients = await fetchStaffTargetsByRole(role);
    if (!recipients.length) {
        return { sent: 0, role, skipped: 'no_recipients' };
    }

    const queueUrl = `${FRONTEND_BASE_URL}/${queueKey}/dashboard`;
    const previewItems = rows
        .slice(0, 10)
        .map((row) => `<li>${row.student_name} (${row.pdm_id}) - ${row.program_name}</li>`)
        .join('');

    for (const recipient of recipients) {
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
    }

    return {
        sent: recipients.length,
        role,
        pending: rows.length,
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
