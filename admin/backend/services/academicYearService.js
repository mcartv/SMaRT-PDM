const pool = require('../config/db');

const DEFAULT_TERMS = ['First Semester', 'Second Semester'];
const APPROVED_APPLICATION_STATUSES = ['Approved', 'Approved Scholar', 'Accepted'];
const REQUIRED_RENEWAL_DOCUMENTS = [
    'Copy of Grades',
    'Certificate of Enrollment / Registration',
];

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function toRequiredYear(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        throw createHttpError(400, `${fieldName} is required`);
    }

    const num = Number(value);

    if (!Number.isInteger(num)) {
        throw createHttpError(400, `${fieldName} must be a valid number`);
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

function mapAcademicPeriod(row = {}) {
    return {
        period_id: row.period_id,
        academic_year_id: row.academic_year_id,
        academic_year_label:
            row.academic_year_label ||
            (row.start_year && row.end_year
                ? `${row.start_year}-${row.end_year}`
                : ''),
        term: row.term,
        is_active: row.is_active === true,
        is_historical: row.is_active !== true,
        activated_by: row.activated_by || null,
        activated_at: row.activated_at || null,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
    };
}

function validateYearRange(startYear, endYear) {
    if (endYear !== startYear + 1) {
        throw createHttpError(
            400,
            'End year must be exactly start year + 1'
        );
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
        throw createHttpError(400, 'That academic year already exists');
    }
}

async function ensureDefaultPeriods(client, academicYearId) {
    for (const term of DEFAULT_TERMS) {
        await client.query(
            `
            INSERT INTO academic_period (
                academic_year_id,
                term,
                is_active,
                created_at,
                updated_at
            )
            VALUES ($1, $2, false, NOW(), NOW())
            ON CONFLICT (academic_year_id, term) DO NOTHING
            `,
            [academicYearId, term]
        );
    }
}

async function getPeriodForUpdate(client, periodId) {
    const result = await client.query(
        `
        SELECT
            ap.period_id,
            ap.academic_year_id,
            ap.term,
            ap.is_active,
            ap.activated_by,
            ap.activated_at,
            ap.created_at,
            ap.updated_at,
            ay.start_year,
            ay.end_year,
            ay.label AS academic_year_label,
            ay.is_archived AS academic_year_archived
        FROM academic_period ap
        JOIN academic_years ay
          ON ay.academic_year_id = ap.academic_year_id
        WHERE ap.period_id = $1
        FOR UPDATE OF ap, ay
        `,
        [periodId]
    );

    return result.rows[0] || null;
}

async function getPeriodCycleSetting(client, period) {
    const result = await client.query(
        `
        SELECT
            setting_id,
            required_hours,
            allow_carry_over
        FROM ro_settings
        WHERE is_active = true
          AND (
                period_id = $1
                OR (
                    period_id IS NULL
                    AND academic_year_id = $2
                )
                OR (
                    period_id IS NULL
                    AND academic_year_id IS NULL
                )
          )
        ORDER BY
            CASE
                WHEN period_id = $1 THEN 0
                WHEN academic_year_id = $2 THEN 1
                ELSE 2
            END,
            updated_at DESC
        LIMIT 1
        `,
        [period.period_id, period.academic_year_id]
    );

    return (
        result.rows[0] || {
            setting_id: null,
            required_hours: 0,
            allow_carry_over: false,
        }
    );
}

async function ensurePeriodCycles(client, period) {
    const eligibleResult = await client.query(
        `
        SELECT
            s.student_id,
            COALESCE(a.application_id, s.current_application_id) AS application_id,
            COALESCE(a.program_id, s.current_program_id) AS program_id,
            a.opening_id
        FROM students s
        LEFT JOIN LATERAL (
            SELECT
                app.application_id,
                app.program_id,
                app.opening_id
            FROM applications app
            WHERE app.student_id = s.student_id
              AND COALESCE(app.is_archived, false) = false
              AND app.application_status = ANY($1::text[])
            ORDER BY
                app.submission_date DESC NULLS LAST,
                app.created_at DESC NULLS LAST
            LIMIT 1
        ) a ON true
        WHERE s.is_active_scholar = true
          AND COALESCE(s.is_archived, false) = false
          AND COALESCE(s.scholar_is_archived, false) = false
        `,
        [APPROVED_APPLICATION_STATUSES]
    );

    const eligible = eligibleResult.rows || [];

    if (!eligible.length) {
        return {
            eligible_scholars: 0,
            renewals_created: 0,
            ro_cycles_created: 0,
        };
    }

    const renewalResult = await client.query(
        `
        WITH eligible AS (
            SELECT
                s.student_id,
                COALESCE(a.application_id, s.current_application_id) AS application_id,
                COALESCE(a.program_id, s.current_program_id) AS program_id
            FROM students s
            LEFT JOIN LATERAL (
                SELECT
                    app.application_id,
                    app.program_id
                FROM applications app
                WHERE app.student_id = s.student_id
                  AND COALESCE(app.is_archived, false) = false
                  AND app.application_status = ANY($3::text[])
                ORDER BY
                    app.submission_date DESC NULLS LAST,
                    app.created_at DESC NULLS LAST
                LIMIT 1
            ) a ON true
            WHERE s.is_active_scholar = true
              AND COALESCE(s.is_archived, false) = false
              AND COALESCE(s.scholar_is_archived, false) = false
        )
        INSERT INTO renewals (
            student_id,
            program_id,
            application_id,
            academic_year_id,
            period_id,
            status,
            submitted_on,
            created_at,
            updated_at
        )
        SELECT
            e.student_id,
            e.program_id,
            e.application_id,
            $1,
            $2,
            'Pending Submission',
            NULL,
            NOW(),
            NOW()
        FROM eligible e
        ON CONFLICT (student_id, period_id) DO NOTHING
        RETURNING renewal_id
        `,
        [
            period.academic_year_id,
            period.period_id,
            APPROVED_APPLICATION_STATUSES,
        ]
    );

    await client.query(
        `
        INSERT INTO renewal_documents (
            renewal_id,
            document_type,
            is_submitted,
            review_status,
            admin_comment,
            submitted_at,
            reviewed_at,
            remarks,
            created_at,
            updated_at
        )
        SELECT
            r.renewal_id,
            docs.document_type,
            false,
            'pending',
            NULL,
            NULL,
            NULL,
            NULL,
            NOW(),
            NOW()
        FROM renewals r
        CROSS JOIN (
            VALUES
                ($2::varchar),
                ($3::varchar)
        ) AS docs(document_type)
        WHERE r.period_id = $1
          AND NOT EXISTS (
              SELECT 1
              FROM renewal_documents rd
              WHERE rd.renewal_id = r.renewal_id
                AND LOWER(rd.document_type) = LOWER(docs.document_type)
          )
        `,
        [
            period.period_id,
            REQUIRED_RENEWAL_DOCUMENTS[0],
            REQUIRED_RENEWAL_DOCUMENTS[1],
        ]
    );

    const roSetting = await getPeriodCycleSetting(client, period);
    const requiredHours = Math.max(
        0,
        Number(roSetting.required_hours || 0)
    );

    const roResult = await client.query(
        `
        WITH eligible AS (
            SELECT
                s.student_id,
                COALESCE(a.application_id, s.current_application_id) AS application_id,
                COALESCE(a.program_id, s.current_program_id) AS program_id,
                a.opening_id
            FROM students s
            LEFT JOIN LATERAL (
                SELECT
                    app.application_id,
                    app.program_id,
                    app.opening_id
                FROM applications app
                WHERE app.student_id = s.student_id
                  AND COALESCE(app.is_archived, false) = false
                  AND app.application_status = ANY($5::text[])
                ORDER BY
                    app.submission_date DESC NULLS LAST,
                    app.created_at DESC NULLS LAST
                LIMIT 1
            ) a ON true
            WHERE s.is_active_scholar = true
              AND COALESCE(s.is_archived, false) = false
              AND COALESCE(s.scholar_is_archived, false) = false
        )
        INSERT INTO return_of_obligations (
            student_id,
            application_id,
            opening_id,
            program_id,
            academic_year_id,
            period_id,
            ro_status,
            setting_id,
            required_hours,
            progress_status,
            submitted_minutes,
            validated_minutes,
            assignment_status,
            coordinator_status,
            created_at,
            updated_at
        )
        SELECT
            e.student_id,
            e.application_id,
            e.opening_id,
            e.program_id,
            $1,
            $2,
            'Pending',
            $3,
            $4,
            'Not Started',
            0,
            0,
            'Unassigned',
            'Pending',
            NOW(),
            NOW()
        FROM eligible e
        ON CONFLICT (student_id, period_id) WHERE period_id IS NOT NULL DO NOTHING
        RETURNING ro_id
        `,
        [
            period.academic_year_id,
            period.period_id,
            roSetting.setting_id,
            requiredHours,
            APPROVED_APPLICATION_STATUSES,
        ]
    );

    await client.query(
        `
        UPDATE students s
        SET
            active_academic_year_id = $1,
            active_period_id = $2,
            ro_status = COALESCE(ro.ro_status, 'Pending'),
            ro_progress = CASE
                WHEN COALESCE(ro.required_hours, 0) <= 0 THEN 0
                ELSE LEAST(
                    100,
                    GREATEST(
                        0,
                        ROUND(
                            (
                                COALESCE(ro.validated_minutes, 0)::numeric
                                / (ro.required_hours * 60)
                            ) * 100
                        )
                    )
                )::integer
            END,
            updated_at = NOW()
        FROM return_of_obligations ro
        WHERE ro.student_id = s.student_id
          AND ro.period_id = $2
          AND s.is_active_scholar = true
          AND COALESCE(s.is_archived, false) = false
          AND COALESCE(s.scholar_is_archived, false) = false
        `,
        [period.academic_year_id, period.period_id]
    );

    return {
        eligible_scholars: eligible.length,
        renewals_created: renewalResult.rowCount,
        ro_cycles_created: roResult.rowCount,
    };
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

exports.getAcademicPeriods = async () => {
    const result = await pool.query(
        `
        SELECT
            ap.period_id,
            ap.academic_year_id,
            ap.term,
            ap.is_active,
            ap.activated_by,
            ap.activated_at,
            ap.created_at,
            ap.updated_at,
            ay.start_year,
            ay.end_year,
            ay.label AS academic_year_label,
            ay.is_archived AS academic_year_archived
        FROM academic_period ap
        JOIN academic_years ay
          ON ay.academic_year_id = ap.academic_year_id
        ORDER BY
            ap.is_active DESC,
            ay.start_year DESC,
            CASE ap.term
                WHEN 'First Semester' THEN 1
                WHEN 'Second Semester' THEN 2
                WHEN 'Summer' THEN 3
                ELSE 4
            END
        `
    );

    return result.rows.map((row) => ({
        ...mapAcademicPeriod(row),
        academic_year_archived: row.academic_year_archived === true,
    }));
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

        await ensureDefaultPeriods(
            client,
            result.rows[0].academic_year_id
        );

        if (isActive) {
            // Changing the active school year alone must not silently keep a
            // semester from the previous school year actionable. The admin
            // explicitly chooses the working semester afterwards.
            await client.query(
                `
                UPDATE academic_period
                SET is_active = false,
                    updated_at = NOW()
                WHERE is_active = true
                  AND academic_year_id <> $1
                `,
                [result.rows[0].academic_year_id]
            );
        }

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
            throw createHttpError(
                400,
                'Cannot update an archived academic year. Restore it first.'
            );
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

        await ensureUniqueRange(
            client,
            startYear,
            endYear,
            academicYearId
        );

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
                is_active = $3,
                updated_at = NOW()
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

        await ensureDefaultPeriods(client, academicYearId);

        if (isActive) {
            await client.query(
                `
                UPDATE academic_period
                SET is_active = false,
                    updated_at = NOW()
                WHERE is_active = true
                  AND academic_year_id <> $1
                `,
                [academicYearId]
            );
        }

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
            throw createHttpError(
                400,
                'Cannot activate an archived academic year. Restore it first.'
            );
        }

        await client.query(
            `
            UPDATE academic_years
            SET is_active = (academic_year_id = $1),
                updated_at = NOW()
            WHERE is_active = true
               OR academic_year_id = $1
            `,
            [academicYearId]
        );

        await ensureDefaultPeriods(client, academicYearId);

        await client.query(
            `
            UPDATE academic_period
            SET is_active = false,
                updated_at = NOW()
            WHERE is_active = true
              AND academic_year_id <> $1
            `,
            [academicYearId]
        );

        const result = await client.query(
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
            `,
            [academicYearId]
        );

        await client.query('COMMIT');

        return result.rows[0]
            ? mapAcademicYear(result.rows[0])
            : null;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

exports.activateAcademicPeriod = async (
    periodId,
    actorUserId = null
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const period = await getPeriodForUpdate(
            client,
            periodId
        );

        if (!period) {
            throw createHttpError(
                404,
                'Academic period not found'
            );
        }

        if (period.academic_year_archived === true) {
            throw createHttpError(
                400,
                'Restore the academic year before activating one of its semesters.'
            );
        }

        await client.query(
            `
            UPDATE academic_years
            SET is_active = (academic_year_id = $1),
                updated_at = NOW()
            WHERE is_active = true
               OR academic_year_id = $1
            `,
            [period.academic_year_id]
        );

        await client.query(
            `
            UPDATE academic_period
            SET
                is_active = false,
                updated_at = NOW()
            WHERE is_active = true
              AND period_id <> $1
            `,
            [period.period_id]
        );

        const activatedResult = await client.query(
            `
            UPDATE academic_period
            SET
                is_active = true,
                activated_by = $2,
                activated_at = NOW(),
                updated_at = NOW()
            WHERE period_id = $1
            RETURNING *
            `,
            [period.period_id, actorUserId]
        );

        const cycleSummary = await ensurePeriodCycles(
            client,
            period
        );

        await client.query('COMMIT');

        return {
            period: mapAcademicPeriod({
                ...period,
                ...activatedResult.rows[0],
                academic_year_label:
                    period.academic_year_label,
            }),
            cycle_summary: cycleSummary,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

exports.resetAcademicPeriodForTesting = async (
    periodId,
    actorUserId = null
) => {
    const allowReset =
        process.env.NODE_ENV !== 'production' ||
        String(
            process.env.ENABLE_ACADEMIC_CYCLE_TEST_RESET || ''
        ).toLowerCase() === 'true';

    if (!allowReset) {
        throw createHttpError(
            403,
            'Academic cycle reset is disabled in production. Set ENABLE_ACADEMIC_CYCLE_TEST_RESET=true only in a controlled test environment.'
        );
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const period = await getPeriodForUpdate(
            client,
            periodId
        );

        if (!period) {
            throw createHttpError(
                404,
                'Academic period not found'
            );
        }

        if (period.is_active !== true) {
            throw createHttpError(
                400,
                'Set this semester as the current period before resetting its test cycle.'
            );
        }

        const renewalDelete = await client.query(
            `
            DELETE FROM renewals
            WHERE period_id = $1
            RETURNING renewal_id
            `,
            [period.period_id]
        );

        const roDelete = await client.query(
            `
            DELETE FROM return_of_obligations
            WHERE period_id = $1
            RETURNING ro_id
            `,
            [period.period_id]
        );

        await client.query(
            `
            UPDATE students
            SET
                active_academic_year_id = $1,
                active_period_id = $2,
                ro_status = 'Pending',
                ro_progress = 0,
                updated_at = NOW()
            WHERE is_active_scholar = true
              AND COALESCE(is_archived, false) = false
              AND COALESCE(scholar_is_archived, false) = false
            `,
            [
                period.academic_year_id,
                period.period_id,
            ]
        );

        const cycleSummary = await ensurePeriodCycles(
            client,
            period
        );

        await client.query('COMMIT');

        return {
            period: mapAcademicPeriod(period),
            deleted: {
                renewals: renewalDelete.rowCount,
                ro_cycles: roDelete.rowCount,
            },
            regenerated: cycleSummary,
            reset_by: actorUserId || null,
        };
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
            throw createHttpError(
                400,
                'Cannot archive the active academic year. Set another academic year as active first.'
            );
        }

        const activePeriod = await client.query(
            `
            SELECT period_id
            FROM academic_period
            WHERE academic_year_id = $1
              AND is_active = true
            LIMIT 1
            `,
            [academicYearId]
        );

        if (activePeriod.rows.length) {
            throw createHttpError(
                400,
                'Cannot archive an academic year that contains the current semester.'
            );
        }

        const result = await client.query(
            `
            UPDATE academic_years
            SET
                is_archived = true,
                is_active = false,
                updated_at = NOW()
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

        return result.rows[0]
            ? mapAcademicYear(result.rows[0])
            : null;
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
            SELECT academic_year_id
            FROM academic_years
            WHERE academic_year_id = $1
            FOR UPDATE
            `,
            [academicYearId]
        );

        if (!existingResult.rows[0]) {
            await client.query('ROLLBACK');
            return null;
        }

        const result = await client.query(
            `
            UPDATE academic_years
            SET
                is_archived = false,
                updated_at = NOW()
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

        await ensureDefaultPeriods(client, academicYearId);
        await client.query('COMMIT');

        return result.rows[0]
            ? mapAcademicYear(result.rows[0])
            : null;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};
