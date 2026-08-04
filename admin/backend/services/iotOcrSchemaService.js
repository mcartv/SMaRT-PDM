const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const MIGRATION_PATH = path.resolve(
    __dirname,
    '../sql/20260804_fix_iot_ocr_request_and_snapshot_provenance.sql'
);

let schemaPromise = null;

async function runMigration() {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    const client = await pool.connect();

    try {
        await client.query(sql);
        console.log('IOT_OCR_SCHEMA_COMPATIBILITY=PASSED');
    } catch (error) {
        try {
            await client.query('ROLLBACK');
            console.log('IOT_OCR_SCHEMA_ROLLBACK=PASSED');
        } catch (rollbackError) {
            console.error('IOT_OCR_SCHEMA_ROLLBACK=FAILED', {
                message: rollbackError.message,
                code: rollbackError.code || null,
            });
        }

        throw error;
    } finally {
        client.release();
    }
}

async function ensureIotOcrSchema() {
    if (!schemaPromise) {
        schemaPromise = runMigration().catch((error) => {
            schemaPromise = null;
            error.message = `IoT OCR schema compatibility failed: ${error.message}`;
            throw error;
        });
    }

    return schemaPromise;
}

module.exports = {
    MIGRATION_PATH,
    ensureIotOcrSchema,
};
