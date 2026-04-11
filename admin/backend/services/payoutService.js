const pool = require('../config/db');

// =========================
// FETCH PAYOUT BATCHES
// =========================
async function fetchPayoutBatches() {
    const query = `
        SELECT
            pb.payout_batch_id,
            pb.opening_id,
            pb.program_id,
            pb.semester,
            pb.school_year,
            pb.payout_title,
            pb.payout_date,
            pb.payment_mode,
            pb.amount_per_scholar,
            pb.total_amount,
            pb.batch_status,
            pb.remarks,
            pb.created_at,

            sp.program_name,
            b.benefactor_name,

            COALESCE(
                json_agg(
                    json_build_object(
                        'payout_entry_id', pbs.payout_entry_id,
                        'scholar_id', pbs.scholar_id,
                        'amount_received', pbs.amount_received,
                        'release_status', pbs.release_status,
                        'student_name', CONCAT(st.last_name, ', ', st.first_name)
                    )
                ) FILTER (WHERE pbs.payout_entry_id IS NOT NULL),
                '[]'::json
            ) AS scholars

        FROM payout_batches pb
        LEFT JOIN scholarship_program sp
            ON pb.program_id = sp.program_id
        LEFT JOIN benefactors b
            ON sp.benefactor_id = b.benefactor_id
        LEFT JOIN payout_batch_scholars pbs
            ON pb.payout_batch_id = pbs.payout_batch_id
        LEFT JOIN scholars s
            ON pbs.scholar_id = s.scholar_id
        LEFT JOIN students st
            ON s.student_id = st.student_id

        GROUP BY
            pb.payout_batch_id,
            pb.opening_id,
            pb.program_id,
            pb.semester,
            pb.school_year,
            pb.payout_title,
            pb.payout_date,
            pb.payment_mode,
            pb.amount_per_scholar,
            pb.total_amount,
            pb.batch_status,
            pb.remarks,
            pb.created_at,
            sp.program_name,
            b.benefactor_name

        ORDER BY pb.created_at DESC;
    `;

    const { rows } = await pool.query(query);
    return rows;
}

// =========================
// FETCH OPENINGS
// =========================
async function fetchPayoutOpenings() {
    const query = `
        SELECT
            po.opening_id,
            po.program_id,
            po.created_at,

            sp.program_name,
            b.benefactor_name,

            CONCAT(
                COALESCE(sp.program_name, 'Program'),
                ' Opening'
            ) AS opening_title,

            5000::numeric AS amount_per_scholar,
            NULL::text AS semester,
            NULL::text AS school_year,
            'Available'::text AS status

        FROM program_openings po
        LEFT JOIN scholarship_program sp
            ON po.program_id = sp.program_id
        LEFT JOIN benefactors b
            ON sp.benefactor_id = b.benefactor_id

        ORDER BY po.created_at DESC;
    `;

    const { rows } = await pool.query(query);
    return rows;
}

// =========================
// FETCH ELIGIBLE SCHOLARS BY OPENING
// =========================
async function fetchEligibleScholarsByOpening(openingId) {
    const openingQuery = `
        SELECT
            po.opening_id,
            po.program_id,

            sp.program_name,
            b.benefactor_name,

            CONCAT(
                COALESCE(sp.program_name, 'Program'),
                ' Opening'
            ) AS opening_title,

            5000::numeric AS amount_per_scholar,
            NULL::text AS semester,
            NULL::text AS school_year,
            'Available'::text AS status

        FROM program_openings po
        LEFT JOIN scholarship_program sp
            ON po.program_id = sp.program_id
        LEFT JOIN benefactors b
            ON sp.benefactor_id = b.benefactor_id
        WHERE po.opening_id = $1
        LIMIT 1;
    `;

    const openingResult = await pool.query(openingQuery, [openingId]);

    if (!openingResult.rows.length) {
        throw new Error('Opening not found');
    }

    const opening = openingResult.rows[0];

    const scholarQuery = `
        SELECT
            s.scholar_id,
            s.program_id,
            s.batch_year,
            s.status,
            CONCAT(st.last_name, ', ', st.first_name) AS student_name
        FROM scholars s
        INNER JOIN students st
            ON s.student_id = st.student_id
        WHERE s.program_id = $1
        ORDER BY st.last_name, st.first_name;
    `;

    const scholarResult = await pool.query(scholarQuery, [opening.program_id]);

    return {
        opening,
        scholars: scholarResult.rows,
    };
}

// =========================
// CREATE PAYOUT BATCH
// =========================
async function createPayoutBatchFromOpening({
    opening_id,
    semester,
    school_year,
    payout_title,
    payout_date,
    payment_mode,
    remarks,
    scholar_ids,
}) {
    if (!opening_id) {
        throw new Error('opening_id is required');
    }

    const uniqueScholarIds = Array.isArray(scholar_ids)
        ? [...new Set(scholar_ids.filter(Boolean))]
        : [];

    if (!uniqueScholarIds.length) {
        throw new Error('No scholars selected');
    }

    const openingQuery = `
        SELECT
            po.opening_id,
            po.program_id,
            sp.program_name
        FROM program_openings po
        LEFT JOIN scholarship_program sp
            ON po.program_id = sp.program_id
        WHERE po.opening_id = $1
        LIMIT 1;
    `;

    const openingResult = await pool.query(openingQuery, [opening_id]);

    if (!openingResult.rows.length) {
        throw new Error('Opening not found');
    }

    const opening = openingResult.rows[0];

    const amount = 5000; // TEMP until real amount column exists
    const totalAmount = amount * uniqueScholarIds.length;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const batchResult = await client.query(`
            INSERT INTO payout_batches (
                opening_id,
                program_id,
                semester,
                school_year,
                payout_title,
                payout_date,
                payment_mode,
                amount_per_scholar,
                total_amount,
                batch_status,
                remarks
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Draft', $10)
            RETURNING *;
        `, [
            opening.opening_id,
            opening.program_id,
            semester || null,
            school_year || null,
            payout_title || `${opening.program_name || 'Program'} Payout Batch`,
            payout_date || new Date().toISOString().slice(0, 10),
            payment_mode || 'Cash',
            amount,
            totalAmount,
            remarks || null
        ]);

        const batch = batchResult.rows[0];

        for (const scholarId of uniqueScholarIds) {
            await client.query(`
                INSERT INTO payout_batch_scholars (
                    payout_batch_id,
                    scholar_id,
                    amount_received,
                    release_status
                )
                VALUES ($1, $2, $3, 'Pending')
            `, [batch.payout_batch_id, scholarId, amount]);
        }

        await client.query('COMMIT');
        return batch;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// =========================
// UPDATE STATUS
// =========================
async function updateScholarPayoutStatus({ payout_entry_id, next_status }) {
    if (!payout_entry_id) {
        throw new Error('payout_entry_id is required');
    }

    if (!next_status) {
        throw new Error('next_status is required');
    }

    await pool.query(`
        UPDATE payout_batch_scholars
        SET release_status = $2
        WHERE payout_entry_id = $1
    `, [payout_entry_id, next_status]);

    return { success: true };
}

module.exports = {
    fetchPayoutBatches,
    fetchPayoutOpenings,
    fetchEligibleScholarsByOpening,
    createPayoutBatchFromOpening,
    updateScholarPayoutStatus,
};