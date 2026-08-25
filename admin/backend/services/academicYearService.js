const pool = require('../config/db');

function toRequiredYear(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        throw new Error(`${fieldName} is required`);
    }

    const num = Number(value);

    if (Number.isNaN(num)) {
        throw new Error(`${fieldName} must be a valid number`);
    }

    return num;
}

function mapAcademicYear(row = {}) {
    return {
        academic_year_id: row.academic_year_id,
        start_year: Number(row.start_year),
        end_year: Number(row.end_year),
        label: row.label || `${row.start_year}-${row.end_year}`,
        is_active: row.is_active === true,
        is_archived: row.is_archived === true,
    };
}

function validateYearRange(startYear, endYear) {
    if (endYear !== startYear + 1) {
        throw new Error('End year must be exactly start year + 1');
    }
}

async function ensureUniqueRange(client, startYear, endYear, excludeId = null) {
    const result = await client.query(
        `
        SELECT academic_year_id
        FROM academic_years
        WHERE start_year = $1
          AND end_year = $2
          AND ($3::uuid IS NULL OR academic_year_id <> $3::uuid)
        LIMIT 1
        `,
        [startYear, endYear, excludeId]
    );

    if (result.rows.length > 0) {
        throw new Error('That academic year already exists');
    }
}

exports.getAcademicYears = async () => {
    const result = await pool.query(
        `
        SELECT
            academic_year_id,
            start_year,
            end_year,
            label,
            is_active,
            is_archived
        FROM academic_years
        ORDER BY is_active DESC, is_archived ASC, start_year DESC
        `
    );

    return result.rows.map(mapAcademicYear);
};

exports.createAcademicYear = async (payload = {}) => {
    const startYear = toRequiredYear(payload.start_year, 'Start year');
    const endYear = toRequiredYear(payload.end_year, 'End year');
    const isActive = payload.is_active === true;

    validateYearRange(startYear, endYear);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await ensureUniqueRange(client, startYear, endYear);

        if (isActive) {
            await client.query(
                `
                UPDATE academic_years
                SET is_active = false
                WHERE is_active = true
                `
            );
        }

        const result = await client.query(
            `
            INSERT INTO academic_years (
                start_year,
                end_year,
                is_active,
                is_archived
            )
            VALUES ($1, $2, $3, false)
            RETURNING
                academic_year_id,
                start_year,
                end_year,
                label,
                is_active,
                is_archived
            `,
            [startYear, endYear, isActive]
        );

        await client.query('COMMIT');

        return mapAcademicYear(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

exports.updateAcademicYear = async (academicYearId, payload = {}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const existingResult = await client.query(
            `
            SELECT
                academic_year_id,
                start_year,
                end_year,
                label,
                is_active,
                is_archived
            FROM academic_years
            WHERE academic_year_id = $1
            FOR UPDATE
            `,
            [academicYearId]
        );

        const existing = existingResult.rows[0];

        if (!existing) {
            await client.query('ROLLBACK');
            return null;
        }

        if (existing.is_archived === true) {
            throw new Error('Cannot update an archived academic year. Restore it first.');
        }

        const startYear =
            payload.start_year !== undefined
                ? toRequiredYear(payload.start_year, 'Start year')
                : Number(existing.start_year);

        const endYear =
            payload.end_year !== undefined
                ? toRequiredYear(payload.end_year, 'End year')
                : Number(existing.end_year);

        const isActive =
            payload.is_active !== undefined
                ? payload.is_active === true
                : existing.is_active === true;

        validateYearRange(startYear, endYear);

        await ensureUniqueRange(client, startYear, endYear, academicYearId);

        if (isActive) {
            await client.query(
                `
                UPDATE academic_years
                SET is_active = false
                WHERE is_active = true
                  AND academic_year_id <> $1
                `,
                [academicYearId]
            );
        }

        const updateResult = await client.query(
            `
            UPDATE academic_years
            SET
                start_year = $1,
                end_year = $2,
                is_active = $3
            WHERE academic_year_id = $4
            RETURNING
                academic_year_id,
                start_year,
                end_year,
                label,
                is_active,
                is_archived
            `,
            [startYear, endYear, isActive, academicYearId]
        );

        await client.query('COMMIT');

        return updateResult.rows[0]
            ? mapAcademicYear(updateResult.rows[0])
            : null;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

exports.activateAcademicYear = async (academicYearId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const existingResult = await client.query(
            `
            SELECT
                academic_year_id,
                is_archived
            FROM academic_years
            WHERE academic_year_id = $1
            FOR UPDATE
            `,
            [academicYearId]
        );

        const existing = existingResult.rows[0];

        if (!existing) {
            await client.query('ROLLBACK');
            return null;
        }

        if (existing.is_archived === true) {
            throw new Error('Cannot activate an archived academic year. Restore it first.');
        }

        await client.query(
            `
            UPDATE academic_years
            SET is_active = false
            WHERE is_active = true
              AND academic_year_id <> $1
            `,
            [academicYearId]
        );

        const result = await client.query(
            `
            UPDATE academic_years
            SET is_active = true
            WHERE academic_year_id = $1
            RETURNING
                academic_year_id,
                start_year,
                end_year,
                label,
                is_active,
                is_archived
            `,
            [academicYearId]
        );

        await client.query('COMMIT');

        return result.rows[0] ? mapAcademicYear(result.rows[0]) : null;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

exports.archiveAcademicYear = async (academicYearId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const existingResult = await client.query(
            `
            SELECT
                academic_year_id,
                is_active,
                is_archived
            FROM academic_years
            WHERE academic_year_id = $1
            FOR UPDATE
            `,
            [academicYearId]
        );

        const existing = existingResult.rows[0];

        if (!existing) {
            await client.query('ROLLBACK');
            return null;
        }

        if (existing.is_active === true) {
            throw new Error('Cannot archive the active academic year. Set another academic year as active first.');
        }

        const result = await client.query(
            `
            UPDATE academic_years
            SET
                is_archived = true,
                is_active = false
            WHERE academic_year_id = $1
            RETURNING
                academic_year_id,
                start_year,
                end_year,
                label,
                is_active,
                is_archived
            `,
            [academicYearId]
        );

        await client.query('COMMIT');

        return result.rows[0] ? mapAcademicYear(result.rows[0]) : null;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

exports.restoreAcademicYear = async (academicYearId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const existingResult = await client.query(
            `
            SELECT
                academic_year_id
            FROM academic_years
            WHERE academic_year_id = $1
            FOR UPDATE
            `,
            [academicYearId]
        );

        const existing = existingResult.rows[0];

        if (!existing) {
            await client.query('ROLLBACK');
            return null;
        }

        const result = await client.query(
            `
            UPDATE academic_years
            SET is_archived = false
            WHERE academic_year_id = $1
            RETURNING
                academic_year_id,
                start_year,
                end_year,
                label,
                is_active,
                is_archived
            `,
            [academicYearId]
        );

        await client.query('COMMIT');

        return result.rows[0] ? mapAcademicYear(result.rows[0]) : null;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};