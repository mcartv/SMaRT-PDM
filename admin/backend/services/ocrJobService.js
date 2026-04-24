const pool = require('../config/db');
const {
    DOCUMENT_TYPE_TO_NAME,
    normalizeDocumentType,
} = require('../utils/documentTypes');

function buildHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function mapJobRow(row) {
    return {
        id: row.id,
        application_id: row.application_id,
        document_key: row.document_key,
        document_type: row.document_type,
        student_id: row.student_id,
        student_name: row.student_name,
        status: row.status,
        priority: Number(row.priority || 0),
        requested_by: row.requested_by || null,
        claimed_by: row.claimed_by || null,
        raw_text: row.raw_text || '',
        ocr_confidence:
            row.ocr_confidence === null || row.ocr_confidence === undefined
                ? null
                : Number(row.ocr_confidence),
        extracted_fields: row.extracted_fields || {},
        source_payload: row.source_payload || {},
        error_message: row.error_message || null,
        created_at: row.created_at,
        claimed_at: row.claimed_at,
        completed_at: row.completed_at,
        updated_at: row.updated_at,
    };
}

function normalizeCreateJobInput(input = {}) {
    return {
        applicationId: input.applicationId || input.application_id || null,
        documentKey: input.documentKey || input.document_key || null,
        documentType: input.documentType || input.document_type || null,
        studentId: input.studentId || input.student_id || null,
        studentName: input.studentName || input.student_name || null,
        requestedBy: input.requestedBy || input.requested_by || null,
        sourcePayload: input.sourcePayload || input.source_payload || {},
    };
}

async function validateQueueableDocument(
    client,
    applicationId,
    documentKey,
    sourcePayload = {}
) {
    if (!applicationId) {
        throw buildHttpError(400, 'application_id is required');
    }

    const normalizedDocumentKey = normalizeDocumentType(documentKey);
    const isIotCameraMode =
        sourcePayload?.mode === 'iot_camera' ||
        sourcePayload?.source === 'web_iot_ocr_button';

    if (!normalizedDocumentKey) {
        throw buildHttpError(400, 'document_key is required');
    }

    if (normalizedDocumentKey === 'application_form') {
        throw buildHttpError(
            400,
            'IoT OCR is only available for camera-scannable documents'
        );
    }

    const documentTypeName = DOCUMENT_TYPE_TO_NAME[normalizedDocumentKey];

    if (!documentTypeName) {
        throw buildHttpError(400, 'Invalid document_key');
    }

    const applicationResult = await client.query(
        `
        SELECT
            a.application_id::text AS application_id,
            a.student_id::text AS student_id,
            TRIM(
                CONCAT_WS(
                    ' ',
                    st.first_name,
                    st.middle_name,
                    st.last_name
                )
            ) AS student_name
        FROM applications a
        LEFT JOIN students st
            ON st.student_id = a.student_id
        WHERE a.application_id::text = $1
        LIMIT 1
        `,
        [String(applicationId)]
    );

    if (!applicationResult.rows.length) {
        throw buildHttpError(404, 'Application not found');
    }

    const applicationRow = applicationResult.rows[0];
    if (!applicationRow.student_id) {
        throw buildHttpError(409, 'Application is missing student_id');
    }

    if (!isIotCameraMode) {
        const documentResult = await client.query(
            `
            SELECT
                document_type,
                file_path,
                file_url,
                is_submitted
            FROM application_documents
            WHERE application_id::text = $1
              AND document_type = $2
            LIMIT 1
            `,
            [String(applicationId), documentTypeName]
        );

        const documentRow = documentResult.rows[0] || null;

        if (
            !documentRow ||
            (!documentRow.is_submitted && !documentRow.file_path && !documentRow.file_url)
        ) {
            throw buildHttpError(
                409,
                'The requested application document is not uploaded yet'
            );
        }
    }

    return {
        applicationId: String(applicationRow.application_id),
        studentId: applicationRow.student_id || null,
        studentName: applicationRow.student_name || 'Unknown Student',
        documentKey: normalizedDocumentKey,
        documentType: documentTypeName,
    };
}

exports.createJob = async (input = {}) => {
    const {
        applicationId,
        documentKey,
        documentType,
        studentId,
        studentName,
        requestedBy = null,
        sourcePayload = {},
    } = normalizeCreateJobInput(input);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const validatedContext = await validateQueueableDocument(
            client,
            applicationId,
            documentKey,
            sourcePayload
        );
        const documentContext = {
            applicationId: validatedContext.applicationId,
            studentId: studentId || validatedContext.studentId,
            studentName: studentName || validatedContext.studentName,
            documentKey: validatedContext.documentKey,
            documentType: documentType || validatedContext.documentType,
        };

        const existingJobResult = await client.query(
            `
            SELECT *
            FROM ocr_jobs
            WHERE application_id = $1
              AND document_key = $2
              AND status IN ('queued', 'in_progress')
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [documentContext.applicationId, documentContext.documentKey]
        );

        if (existingJobResult.rows.length) {
            await client.query('COMMIT');
            const job = mapJobRow(existingJobResult.rows[0]);
            return {
                created: false,
                job,
                ...job,
            };
        }

        const insertResult = await client.query(
            `
            INSERT INTO ocr_jobs (
                application_id,
                document_key,
                document_type,
                student_id,
                student_name,
                status,
                priority,
                requested_by,
                extracted_fields,
                source_payload
            )
            VALUES ($1, $2, $3, $4, $5, 'queued', 0, $6, '{}'::jsonb, $7::jsonb)
            RETURNING *
            `,
            [
                documentContext.applicationId,
                documentContext.documentKey,
                documentContext.documentType,
                documentContext.studentId,
                documentContext.studentName,
                requestedBy ? String(requestedBy) : null,
                JSON.stringify(sourcePayload || {}),
            ]
        );

        await client.query('COMMIT');
        const job = mapJobRow(insertResult.rows[0]);

        return {
            created: true,
            job,
            ...job,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

exports.claimNextJob = async ({ claimedBy = null } = {}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query(
            `
            UPDATE ocr_jobs
            SET
                status = 'queued',
                claimed_by = NULL,
                claimed_at = NULL,
                error_message = 'Recovered from stale in_progress state',
                updated_at = NOW()
            WHERE status = 'in_progress'
              AND claimed_at < NOW() - INTERVAL '5 minutes'
            `
        );

        const claimResult = await client.query(
            `
            WITH next_job AS (
                SELECT id
                FROM ocr_jobs
                WHERE status = 'queued'
                ORDER BY priority DESC, created_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE ocr_jobs
            SET
                status = 'in_progress',
                claimed_at = NOW(),
                claimed_by = $1,
                updated_at = NOW()
            WHERE id IN (SELECT id FROM next_job)
            RETURNING *
            `,
            [claimedBy]
        );

        if (!claimResult.rows.length) {
            throw buildHttpError(404, 'No OCR job available');
        }

        await client.query('COMMIT');
        return mapJobRow(claimResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

exports.completeJob = async ({
    jobId,
    status,
    rawText,
    ocrConfidence,
    extractedFields,
    sourcePayload,
    errorMessage,
    claimedBy = null,
}) => {
    if (!jobId) {
        throw buildHttpError(400, 'job id is required');
    }

    if (!['completed', 'failed'].includes(status)) {
        throw buildHttpError(400, 'status must be either completed or failed');
    }

    const client = await pool.connect();

    try {
        const applicationService = require('./applicationService');
        await client.query('BEGIN');

        const jobResult = await client.query(
            `
            SELECT *
            FROM ocr_jobs
            WHERE id = $1
            FOR UPDATE
            `,
            [jobId]
        );

        if (!jobResult.rows.length) {
            throw buildHttpError(404, 'OCR job not found');
        }

        const job = jobResult.rows[0];

        if (!['queued', 'in_progress'].includes(job.status)) {
            throw buildHttpError(409, 'OCR job is already finalized');
        }

        if (status === 'failed') {
            const failedResult = await client.query(
                `
                UPDATE ocr_jobs
                SET
                    status = 'failed',
                    claimed_by = COALESCE($2, claimed_by),
                    error_message = $3,
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
                `,
                [jobId, claimedBy, String(errorMessage || 'OCR job failed')]
            );

            await client.query('COMMIT');

            return {
                job: mapJobRow(failedResult.rows[0]),
                snapshot: null,
            };
        }

        const normalizedPayload = applicationService.normalizeOcrPayload({
            raw_text: rawText,
            ocr_confidence: ocrConfidence,
            extracted_fields: extractedFields,
            source_payload: sourcePayload,
        });

        const completedResult = await client.query(
            `
            UPDATE ocr_jobs
            SET
                status = 'completed',
                claimed_by = COALESCE($2, claimed_by),
                raw_text = $3,
                ocr_confidence = $4,
                extracted_fields = $5::jsonb,
                source_payload = $6::jsonb,
                error_message = NULL,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            `,
            [
                jobId,
                claimedBy,
                normalizedPayload.raw_text,
                normalizedPayload.ocr_confidence,
                JSON.stringify(normalizedPayload.extracted_fields || {}),
                JSON.stringify(normalizedPayload.source_payload || {}),
            ]
        );

        await client.query('COMMIT');

        const snapshot = await applicationService.saveApplicationDocumentOcrSnapshot({
            applicationId: job.application_id,
            documentKey: job.document_key,
            rawText: normalizedPayload.raw_text,
        });

        return {
            job: mapJobRow(completedResult.rows[0]),
            snapshot,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createJob: exports.createJob,
    claimNextJob: exports.claimNextJob,
    completeJob: exports.completeJob,
};
