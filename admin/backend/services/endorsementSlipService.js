const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');
const supabase = require('../config/supabase');
const { transporter } = require('../config/mailer');
const notificationService = require('./notificationService');
const applicationService = require('./applicationService');
const { resolveStaffRole } = require('../utils/staffRoles');

const STORAGE_BUCKET =
    process.env.SUPABASE_APPLICATION_DOCUMENT_BUCKET || 'documents';
const FRONTEND_BASE_URL =
    (process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
const PDFKIT_MODULE = 'pdfkit';
const QRCODE_MODULE = 'qrcode';

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
        held: 'Held for Guidance Review',
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

            if (overall_status === 'held') {
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
        office_results: officeResults,
        per_office_statuses: tracker.per_office_statuses,
        tracker,
        final_pdf_url: row.final_pdf_url || null,
        completed_at: row.completed_at,
    };
}

async function loadSlipRows({ stage = null } = {}) {
    const params = [];
    const whereClause = stage
        ? `where es.current_stage = $1`
        : '';

    if (stage) {
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
            es.final_pdf_url,
            es.completed_at,
            es.created_at,
            a.submission_date,
            a.application_status,
            a.document_status,
            st.pdm_id,
            st.gwa,
            trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
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
            trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
            st.first_name,
            st.last_name,
            u.email as student_email,
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
        per_office_statuses: tracker.per_office_statuses,
        stages: [
            {
                key: 'sdo',
                label: 'SDO Clearance',
                status: row.sdo_status || (row.current_stage === 'pending_sdo' ? 'pending' : 'not_started'),
                result_label: officeResults.sdo,
                acted_at: row.sdo_acted_at,
                acted_by_user_id: row.sdo_acted_by_user_id,
                acted_by_name: [row.sdo_actor_first_name, row.sdo_actor_last_name].filter(Boolean).join(' ') || row.sdo_actor_email || '',
                remarks: row.sdo_remarks || '',
            },
            {
                key: 'guidance',
                label: 'Guidance Clearance',
                status: row.guidance_status || (row.current_stage === 'pending_guidance' ? 'pending' : 'not_started'),
                result_label: officeResults.guidance,
                acted_at: row.guidance_acted_at,
                acted_by_user_id: row.guidance_acted_by_user_id,
                acted_by_name: [row.guidance_actor_first_name, row.guidance_actor_last_name].filter(Boolean).join(' ') || row.guidance_actor_email || '',
                remarks: row.guidance_remarks || '',
            },
            {
                key: 'pd',
                label: 'Program Director Approval',
                status: row.pd_status || (row.current_stage === 'pending_pd' ? 'pending' : 'not_started'),
                result_label: officeResults.pd,
                acted_at: row.pd_acted_at,
                acted_by_user_id: row.pd_acted_by_user_id,
                acted_by_name: [row.pd_actor_first_name, row.pd_actor_last_name].filter(Boolean).join(' ') || row.pd_actor_email || '',
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
        const doc = new PDFDocument({ size: 'A4', margin: 48 });
        const chunks = [];
        const officeResults = detail.office_results || {};
        const drawCheckbox = (label, checked) => `${checked ? '[x]' : '[ ]'} ${label}`;

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        doc.fontSize(11).fillColor('#111827').text('Office for Scholarship and Financial Assistance (OSFA)', {
            align: 'center',
        });
        doc.moveDown(0.2);
        doc.fontSize(18).text('ENDORSEMENT SLIP', { align: 'center' });
        doc.fontSize(12).text('APPLICATION FOR SCHOLARSHIP', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#374151').text(
            `Semester: ${detail.semester || 'N/A'}    School Year: ${detail.school_year || 'N/A'}`,
            { align: 'center' }
        );
        doc.moveDown(0.2);
        doc.text(`Slip Code: ${detail.slip_code || deriveSlipCode(detail.slip_id)}`, { align: 'center' });
        doc.fillColor('#111827');
        doc.moveDown(1);

        doc.fontSize(10).text(`NAME: ${detail.student_name || 'N/A'}`);
        doc.text(
            `COURSE/PROGRAM: ${detail.program_name || 'N/A'}    PDM ID: ${detail.pdm_id || 'N/A'}`
        );
        doc.text(`OPENING: ${detail.opening_title || 'N/A'}`);
        doc.moveDown(0.8);

        doc.fontSize(11).text('BASED ON THE RECORD ON FILE', { align: 'center' });
        doc.moveDown(0.8);

        doc.fontSize(10).text('Program Director');
        doc.text(drawCheckbox('Good Average Scholastic Standing', officeResults.pd === CHECKBOX_LABELS.pd.approved_good_average));
        doc.text(drawCheckbox('Average Scholastic Standing', officeResults.pd === CHECKBOX_LABELS.pd.approved_average));
        doc.text(`Name & Signature: ${safeText(detail.stages?.find((stage) => stage.key === 'pd')?.acted_by_name) || 'N/A'}`);
        doc.moveDown(0.7);

        doc.text('Student Disciplinary Office');
        doc.text(drawCheckbox('No Offense', officeResults.sdo === CHECKBOX_LABELS.sdo.cleared));
        doc.text(drawCheckbox('Minor Offense', officeResults.sdo === CHECKBOX_LABELS.sdo.disqualified_minor));
        doc.text(drawCheckbox('Major Offense', officeResults.sdo === CHECKBOX_LABELS.sdo.disqualified_major));
        doc.text(`Name & Signature: ${safeText(detail.stages?.find((stage) => stage.key === 'sdo')?.acted_by_name) || 'N/A'}`);
        doc.moveDown(0.7);

        doc.text('Guidance Counselor Office');
        doc.text(drawCheckbox('Good Moral Standing', officeResults.guidance === CHECKBOX_LABELS.guidance.cleared));
        doc.text(`Name & Signature: ${safeText(detail.stages?.find((stage) => stage.key === 'guidance')?.acted_by_name) || 'N/A'}`);
        doc.moveDown(0.8);

        doc.text(`Remarks: ${[
            detail.stages?.find((stage) => stage.key === 'sdo')?.remarks,
            detail.stages?.find((stage) => stage.key === 'guidance')?.remarks,
            detail.stages?.find((stage) => stage.key === 'pd')?.remarks,
        ].filter((value) => safeText(value)).join(' | ') || 'N/A'}`);
        doc.text(
            `Submitted: ${detail.submitted_at ? new Date(detail.submitted_at).toLocaleString('en-PH') : 'N/A'}`
        );
        doc.text(
            `Completed: ${detail.completed_at ? new Date(detail.completed_at).toLocaleString('en-PH') : 'N/A'}`
        );
        doc.moveDown(0.8);

        doc.fontSize(10).fillColor('#4b5563').text('Verification');
        doc.image(qrBuffer, doc.page.width - 180, doc.y - 10, { width: 115, height: 115 });
        doc.text(`Verification URL: ${verificationUrl}`, { width: doc.page.width - 210 });
        doc.text('Scan the QR code or open the verification URL to confirm authenticity.', {
            width: doc.page.width - 210,
        });
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

function buildStageUpdate(queueKey, action, remarks, actorUserId) {
    const now = new Date().toISOString();

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

        return {
            sql: `
                update endorsement_slips
                set sdo_status = $2,
                    sdo_acted_at = $3,
                    sdo_acted_by_user_id = $4,
                    sdo_remarks = $5,
                    current_stage = $6,
                    overall_status = $7,
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
                ['cleared', 'disqualified_minor'].includes(normalizedAction) ? 'pending_guidance' : normalizedAction,
                ['cleared', 'disqualified_minor'].includes(normalizedAction) ? 'pending_guidance' : normalizedAction,
            ],
        };
    }

    if (queueKey === 'guidance') {
        if (!['clear', 'hold'].includes(action)) {
            throw createHttpError(400, 'Guidance action must be clear or hold.');
        }
        if (action === 'hold' && !remarks) {
            throw createHttpError(400, 'Guidance hold requires a reason.');
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
                  and current_stage = 'pending_guidance'
                returning *
            `,
            values: [
                null,
                action === 'clear' ? 'cleared' : 'held',
                now,
                actorUserId,
                remarks || null,
                action === 'clear' ? 'pending_pd' : 'held',
                action === 'clear' ? 'pending_pd' : 'held',
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
    const remarks = safeText(payload?.remarks);
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
        if (currentSlip.current_stage !== config.stage) {
            throw createHttpError(409, 'This endorsement slip is no longer pending in your queue.');
        }

        const mutation = buildStageUpdate(queueKey, action, remarks, actorUserId);
        mutation.values[0] = slipId;
        const updated = await client.query(mutation.sql, mutation.values);

        if (!updated.rows.length) {
            throw createHttpError(409, 'Unable to update endorsement slip.');
        }

        await client.query('commit');

        const notifications = await notifyNextStage({
            slipId,
            queueKey,
            studentName: currentSlip.student_name || 'A student',
        });

        let finalizedDetail = await fetchSlipDetail(slipId, actor);
        let pdfError = null;
        let activation = null;
        if (queueKey === 'pd' && finalizedDetail.overall_status === 'completed') {
            try {
                finalizedDetail = await finalizeCompletedSlip(slipId);
            } catch (error) {
                pdfError = error.message || 'Failed to generate final PDF.';
            }

            activation = await applicationService.attemptScholarActivationIfReady(
                finalizedDetail.application_id
            );
        }

        return {
            slip: finalizedDetail,
            notifications: notifications || [],
            emittedStage: finalizedDetail.current_stage,
            action,
            pdfError,
            activation,
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
            trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))) as student_name,
            sp.program_name,
            ay.label as school_year,
            ap.term as semester
        from endorsement_slips es
        join students st on st.student_id = es.student_id
        left join applications a on a.application_id = es.application_id
        left join scholarship_program sp on sp.program_id = a.program_id
        left join program_openings po on po.opening_id = a.opening_id
        left join academic_years ay on ay.academic_year_id = po.academic_year_id
        left join academic_period ap on ap.period_id = po.period_id
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
        stages: {
            sdo: {
                decision: row.sdo_status,
                result_label: officeResults.sdo,
                acted_at: row.sdo_acted_at,
                remarks: row.sdo_remarks || '',
            },
            guidance: {
                decision: row.guidance_status,
                result_label: officeResults.guidance,
                acted_at: row.guidance_acted_at,
                remarks: row.guidance_remarks || '',
            },
            pd: {
                decision: row.pd_status,
                result_label: officeResults.pd,
                acted_at: row.pd_acted_at,
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
    sendPendingDigests,
    ensureSlipForApplication,
};
