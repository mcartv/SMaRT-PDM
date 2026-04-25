const pool = require('../config/db');
const documentTypes = require('../utils/documentTypes');

function buildHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function mapRequestRow(row) {
    if (!row) return null;

    return {
        request_id: row.request_id,
        application_id: row.application_id,
        student_id: row.student_id,
        student_name: row.student_name || null,
        document_key: row.document_key,
        document_type: row.document_type,
        status: row.status || 'pending',
        requested_by: row.requested_by || null,
        claimed_by: row.claimed_by || null,
        error_message: row.error_message || null,
        created_at: row.created_at || null,
        claimed_at: row.claimed_at || null,
        completed_at: row.completed_at || null,
        updated_at: row.updated_at || null,
    };
}

function isUuid(value) {
    if (!value) return false;

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(String(value).trim());
}

function normalizeCreateInput(input = {}) {
    return {
        applicationId: input.applicationId || input.application_id || null,
        documentKey: input.documentKey || input.document_key || null,
        requestedBy: input.requestedBy || input.requested_by || null,
    };
}

function normalizeCompleteInput(input = {}) {
    return {
        requestId: input.requestId || input.request_id || null,
        status: String(input.status || '').trim().toLowerCase(),
        rawText: input.rawText ?? input.raw_text ?? '',
        ocrConfidence: input.ocrConfidence ?? input.ocr_confidence ?? null,
        extractedFields: input.extractedFields ?? input.extracted_fields ?? {},
        sourcePayload: input.sourcePayload ?? input.source_payload ?? {},
        errorMessage: input.errorMessage ?? input.error_message ?? null,
        claimedBy: input.claimedBy || input.claimed_by || null,
    };
}

async function resolveRequestContext(client, { applicationId, documentKey }) {
    if (!applicationId) {
        throw buildHttpError(400, 'application_id is required');
    }

    const normalizedDocumentKey = documentTypes.normalizeDocumentType(documentKey);
    if (!normalizedDocumentKey) {
        throw buildHttpError(400, 'document_key is required');
    }

    if (normalizedDocumentKey === 'application_form') {
        throw buildHttpError(400, 'IoT OCR is only available for camera-scannable documents');
    }

    const documentTypeName = documentTypes.DOCUMENT_TYPE_TO_NAME[normalizedDocumentKey];
    if (!documentTypeName) {
        throw buildHttpError(400, 'Invalid document_key');
    }

    const applicationResult = await client.query(
        `
        SELECT
            a.application_id::uuid AS application_id,
            a.student_id::uuid AS student_id,
            TRIM(CONCAT_WS(' ', st.first_name, st.middle_name, st.last_name)) AS student_name
        FROM applications a
        LEFT JOIN students st
            ON st.student_id = a.student_id
        WHERE a.application_id = $1::uuid
        LIMIT 1
        `,
        [applicationId]
    );

    if (!applicationResult.rows.length) {
        throw buildHttpError(404, 'Application not found');
    }

    const row = applicationResult.rows[0];
    if (!row.student_id) {
        throw buildHttpError(409, 'Application is missing student_id');
    }

    return {
        application_id: row.application_id,
        student_id: row.student_id,
        student_name: row.student_name || 'Unknown Student',
        document_key: normalizedDocumentKey,
        document_type: documentTypeName,
    };
}

exports.createRequest = async (input = {}) => {
    const { applicationId, documentKey, requestedBy = null } = normalizeCreateInput(input);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const context = await resolveRequestContext(client, {
            applicationId,
            documentKey,
        });

        const existingResult = await client.query(
            `
            SELECT *
            FROM iot_ocr_requests
            WHERE application_id = $1::uuid
              AND document_key = $2
              AND status IN ('pending', 'claimed')
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [context.application_id, context.document_key]
        );

        if (existingResult.rows.length) {
            await client.query('COMMIT');
            const request = mapRequestRow(existingResult.rows[0]);
            return {
                created: false,
                request,
                ...request,
            };
        }

        const requestedByUuid = isUuid(requestedBy) ? String(requestedBy).trim() : null;

        const insertResult = await client.query(
            `
            INSERT INTO iot_ocr_requests (
                application_id,
                student_id,
                student_name,
                document_key,
                document_type,
                status,
                requested_by
            )
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'pending', $6::uuid)
            RETURNING *
            `,
            [
                context.application_id,
                context.student_id,
                context.student_name,
                context.document_key,
                context.document_type,
                requestedByUuid,
            ]
        );

        await client.query('COMMIT');
        const request = mapRequestRow(insertResult.rows[0]);

        return {
            created: true,
            request,
            ...request,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

exports.claimNextRequest = async ({ claimedBy = null } = {}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const claimResult = await client.query(
            `
            WITH next_request AS (
                SELECT request_id
                FROM iot_ocr_requests
                WHERE status = 'pending'
                ORDER BY created_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE iot_ocr_requests
            SET
                status = 'claimed',
                claimed_by = $1,
                claimed_at = NOW(),
                updated_at = NOW()
            WHERE request_id IN (SELECT request_id FROM next_request)
            RETURNING *
            `,
            [claimedBy || null]
        );

        if (!claimResult.rows.length) {
            throw buildHttpError(404, 'No IoT OCR request available');
        }

        await client.query('COMMIT');
        return mapRequestRow(claimResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

exports.completeRequest = async (input = {}) => {
    const {
        requestId,
        status,
        rawText,
        ocrConfidence,
        extractedFields,
        sourcePayload,
        errorMessage,
        claimedBy,
    } = normalizeCompleteInput(input);

    if (!requestId) {
        throw buildHttpError(400, 'request id is required');
    }

    if (!['completed', 'failed', 'cancelled'].includes(status)) {
        throw buildHttpError(400, 'status must be completed, failed, or cancelled');
    }

    const client = await pool.connect();

    try {
        const applicationService = require('./applicationService');
        await client.query('BEGIN');

        const requestResult = await client.query(
            `
            SELECT *
            FROM iot_ocr_requests
            WHERE request_id = $1::uuid
            FOR UPDATE
            `,
            [requestId]
        );

        if (!requestResult.rows.length) {
            throw buildHttpError(404, 'IoT OCR request not found');
        }

        const requestRow = requestResult.rows[0];

        if (!['pending', 'claimed'].includes(requestRow.status)) {
            throw buildHttpError(409, 'IoT OCR request is already finalized');
        }

        if (status === 'completed') {
            const normalizedPayload = applicationService.normalizeOcrPayload({
                raw_text: rawText,
                ocr_confidence: ocrConfidence,
                extracted_fields: extractedFields,
                source_payload: sourcePayload,
            });

            const snapshot = await applicationService.saveApplicationDocumentOcrSnapshot({
                applicationId: requestRow.application_id,
                documentKey: requestRow.document_key,
                rawText: normalizedPayload.raw_text,
                ocrConfidence: normalizedPayload.ocr_confidence,
                extractedFields: normalizedPayload.extracted_fields,
                scannedViaIot: true,
                iotDeviceId: claimedBy || requestRow.claimed_by || null,
                scannedAt: new Date().toISOString(),
            });

            const completedResult = await client.query(
                `
                UPDATE iot_ocr_requests
                SET
                    status = 'completed',
                    claimed_by = COALESCE($2, claimed_by),
                    error_message = NULL,
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE request_id = $1::uuid
                RETURNING *
                `,
                [requestId, claimedBy || null]
            );

            await client.query('COMMIT');

            return {
                request: mapRequestRow(completedResult.rows[0]),
                snapshot,
            };
        }

        const failedResult = await client.query(
            `
            UPDATE iot_ocr_requests
            SET
                status = $2,
                claimed_by = COALESCE($3, claimed_by),
                error_message = $4,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE request_id = $1::uuid
            RETURNING *
            `,
            [
                requestId,
                status,
                claimedBy || null,
                String(errorMessage || (status === 'cancelled' ? 'OCR request cancelled' : 'OCR request failed')),
            ]
        );

        await client.query('COMMIT');

        return {
            request: mapRequestRow(failedResult.rows[0]),
            snapshot: null,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

exports.getLatestRequestForDocument = async ({
    applicationId,
    documentKey,
}) => {
    if (!applicationId || !documentKey) {
        return null;
    }

    const client = await pool.connect();

    try {
        const normalizedDocumentKey = documentTypes.normalizeDocumentType(documentKey);
        if (!normalizedDocumentKey) return null;

        const requestResult = await client.query(
            `
            SELECT *
            FROM iot_ocr_requests
            WHERE application_id = $1::uuid
              AND document_key = $2
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [applicationId, normalizedDocumentKey]
        );

        return mapRequestRow(requestResult.rows[0] || null);
    } finally {
        client.release();
    }
};

module.exports = {
    createRequest: exports.createRequest,
    claimNextRequest: exports.claimNextRequest,
    completeRequest: exports.completeRequest,
    getLatestRequestForDocument: exports.getLatestRequestForDocument,
};
