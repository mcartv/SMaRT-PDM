const pool = require('../config/db');

let schemaPromise = null;

async function verifyRuntimeSchema() {
    const result = await pool.query(`
        SELECT
            to_regclass('public.iot_ocr_candidates') IS NOT NULL AS has_candidates,
            to_regclass('public.iot_ocr_reviews') IS NOT NULL AS has_reviews,
            to_regclass('public.iot_ocr_capture_artifacts') IS NOT NULL AS has_artifacts,
            to_regclass('public.iot_ocr_review_exceptions') IS NOT NULL AS has_exceptions,
            to_regclass('public.iot_ocr_review_events') IS NOT NULL AS has_review_events,
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
        || !row.has_immutability_trigger || !row.has_review_event_trigger) {
        const error = new Error('Canonical IoT OCR schema is not ready');
        error.statusCode = 503;
        throw error;
    }
}

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
