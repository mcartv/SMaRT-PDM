// SMaRT-PDM: OCR — iot Ocr Schema Service (admin backend service); contains business logic and data operations.
const pool = require('../config/db');

let schemaPromise = null;

// verifyRuntimeSchema: verifies verify runtime schema for the OCR flow.
async function verifyRuntimeSchema() {
    const result = await pool.query(`
        SELECT
            to_regclass('public.iot_ocr_candidates') IS NOT NULL AS has_candidates,
            to_regclass('public.iot_ocr_reviews') IS NOT NULL AS has_reviews,
            to_regclass('public.iot_ocr_capture_artifacts') IS NOT NULL AS has_artifacts,
            to_regclass('public.iot_ocr_review_exceptions') IS NOT NULL AS has_exceptions,
            to_regclass('public.iot_ocr_review_events') IS NOT NULL AS has_review_events,
            (
                SELECT COUNT(*) = 6
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'iot_ocr_requests'
                  AND column_name IN (
                    'processing_owner', 'processing_claimed_at',
                    'processing_attempt_count', 'processing_retry_at',
                    'processing_last_error_code', 'processing_last_error_at'
                  )
            ) AS has_processing_recovery_columns,
            EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'iot_ocr_requests'
                  AND indexname = 'idx_iot_ocr_processing_owner'
            ) AS has_processing_owner_index,
            EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'iot_ocr_requests'
                  AND indexname = 'idx_iot_ocr_processing_retry'
            ) AS has_processing_retry_index,
            EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'iot_ocr_requests'
                  AND column_name = 'ocr_processing_metadata'
                  AND data_type = 'jsonb'
            ) AS has_request_processing_metadata,
            EXISTS (
                SELECT 1 FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname = 'iot_ocr_candidates'
                  AND t.tgname = 'trg_iot_ocr_candidates_immutable'
                  AND NOT t.tgisinternal
            ) AS has_immutability_trigger,
            EXISTS (
                SELECT 1 FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname = 'iot_ocr_review_events'
                  AND t.tgname = 'trg_iot_ocr_review_events_immutable'
                  AND NOT t.tgisinternal
            ) AS has_review_event_trigger
    `);
    const row = result.rows[0] || {};
    if (!row.has_candidates || !row.has_reviews || !row.has_artifacts
        || !row.has_exceptions || !row.has_review_events
        || !row.has_processing_recovery_columns
        || !row.has_processing_owner_index || !row.has_processing_retry_index
        || !row.has_request_processing_metadata
        || !row.has_immutability_trigger || !row.has_review_event_trigger) {
        const error = new Error(`Canonical IoT OCR schema is not ready: ${JSON.stringify({
            has_processing_recovery_columns: row.has_processing_recovery_columns,
            has_processing_owner_index: row.has_processing_owner_index,
            has_processing_retry_index: row.has_processing_retry_index,
            has_request_processing_metadata: row.has_request_processing_metadata,
        })}`);
        error.statusCode = 503;
        throw error;
    }
}

// ensureIotOcrSchema: ensures ensure iot ocr schema for the OCR flow.
async function ensureIotOcrSchema() {
    if (!schemaPromise) {
        schemaPromise = verifyRuntimeSchema().catch((error) => {
            schemaPromise = null;
            throw error;
        });
    }
    return schemaPromise;
}

module.exports = { ensureIotOcrSchema, verifyRuntimeSchema };
