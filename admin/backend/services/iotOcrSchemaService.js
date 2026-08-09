const pool = require('../config/db');

let schemaPromise = null;

async function verifyRuntimeSchema() {
    const result = await pool.query(`
        SELECT
            to_regclass('public.iot_ocr_candidates') IS NOT NULL AS has_candidates,
            to_regclass('public.iot_ocr_reviews') IS NOT NULL AS has_reviews,
            EXISTS (
                SELECT 1 FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname = 'iot_ocr_candidates'
                  AND t.tgname = 'trg_iot_ocr_candidates_immutable'
                  AND NOT t.tgisinternal
            ) AS has_immutability_trigger
    `);
    const row = result.rows[0] || {};
    if (!row.has_candidates || !row.has_reviews || !row.has_immutability_trigger) {
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
