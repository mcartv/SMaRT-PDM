// SMaRT-PDM: Payout — payout Service (mobile backend service); contains mobile-facing business logic and data operations.
const path = require('path');
const pool = require('../config/db');
const supabase = require('../config/supabase');

const PAYOUT_PROOF_BUCKET = process.env.PAYOUT_PROOF_BUCKET || 'payout-proofs';
const ALLOWED_PROOF_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
]);

// inferProofMimeType: handles infer proof mime type for the Payout flow.
function inferProofMimeType(file = {}) {
    const provided = safeText(file.mimetype).toLowerCase();
    if (ALLOWED_PROOF_MIME_TYPES.has(provided)) return provided;

    const extension = path.extname(safeText(file.originalname)).toLowerCase();
    if (extension === '.pdf') return 'application/pdf';
    if (extension === '.png') return 'image/png';
    if (extension === '.webp') return 'image/webp';
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';

    return provided || 'application/octet-stream';
}

// createHttpError: creates create http error for the Payout flow.
function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// safeText: handles safe text for the Payout flow.
function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

// getMyPayouts: reads and returns get my payouts for the Payout flow.
async function getMyPayouts(userId) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const studentResult = await pool.query(
        `
    SELECT
      student_id,
      user_id,
      is_active_scholar,
      scholarship_status
    FROM students
    WHERE user_id = $1
    LIMIT 1;
    `,
        [userId]
    );

    const student = studentResult.rows[0];

    if (!student) {
        throw createHttpError(404, 'Student profile not found.');
    }

    if (
        student.is_active_scholar !== true &&
        String(student.scholarship_status || '') !== 'Active'
    ) {
        return {
            items: [],
            message: 'Payouts are available after your application is approved.',
        };
    }

    const payoutResult = await pool.query(
        `
    SELECT
      pbs.payout_entry_id,
      pbs.payout_batch_id,
      pbs.student_id,
      pbs.application_id,
      pbs.amount_received,
      pbs.release_status,
      pbs.released_at,
      pbs.claimed_at,
      pbs.remarks AS entry_remarks,
      pbs.created_at,

      pp.payout_proof_id,
      pp.file_name AS proof_file_name,
      pp.proof_status,
      pp.submitted_at AS proof_submitted_at,
      pp.reviewed_at AS proof_reviewed_at,
      pp.admin_comment AS proof_admin_comment,
      pp.rejection_reason AS proof_rejection_reason,

      pb.payout_title,
      pb.payout_code,
      pb.payout_date,
      pb.payout_time,

      pb.payout_venue,
      pb.payment_mode,
      pb.payment_mode_other,
      pb.amount_per_scholar,
      pb.total_amount,
      pb.batch_status,
      pb.acknowledgement_status,
      pb.remarks AS batch_remarks,

      sp.program_id,
      sp.program_name,

      po.opening_id,
      po.opening_title,

      ay.academic_year_id,
      ay.label AS academic_year_label,
      ay.start_year,
      ay.end_year,

      ap.period_id,
      ap.term AS semester
    FROM payout_batch_students pbs
    INNER JOIN payout_batches pb
      ON pb.payout_batch_id = pbs.payout_batch_id
    LEFT JOIN payout_proofs pp
      ON pp.payout_entry_id = pbs.payout_entry_id
    LEFT JOIN scholarship_program sp
      ON sp.program_id = pb.program_id
    LEFT JOIN program_openings po
      ON po.opening_id = pb.opening_id
    LEFT JOIN academic_years ay
      ON ay.academic_year_id = pb.academic_year_id
    LEFT JOIN academic_period ap
      ON ap.period_id = pb.period_id
    WHERE pbs.student_id = $1
      AND COALESCE(pb.is_archived, FALSE) = FALSE
    ORDER BY pb.created_at DESC, pbs.created_at DESC;
    `,
        [student.student_id]
    );

    const items = payoutResult.rows.map((row) => ({
        payout_entry_id: row.payout_entry_id,
        payout_batch_id: row.payout_batch_id,
        application_id: row.application_id,

        title: row.payout_title || 'Scholarship Payout',
        program_name: row.program_name || 'Scholarship Program',
        opening_title: row.opening_title || '',

        amount: Number(row.amount_received || row.amount_per_scholar || 0),
        amount_received: Number(row.amount_received || 0),
        amount_per_scholar: Number(row.amount_per_scholar || 0),

        payout_date: row.payout_date || null,
        payout_time: row.payout_time || null,

        payout_venue: row.payout_venue,
        payment_mode: row.payment_mode || '-',
        payment_mode_other: row.payment_mode_other || '',
        batch_status: row.batch_status || 'Pending',
        release_status: row.release_status || 'Pending',
        acknowledgement_status: row.acknowledgement_status || 'Pending',

        academic_year:
            row.academic_year_label ||
            (row.start_year && row.end_year
                ? `${row.start_year}-${row.end_year}`
                : '-'),

        semester: row.semester || '-',

        payout_code: row.payout_code || '',
        reference: row.payout_code || '',
        remarks: row.entry_remarks || row.batch_remarks || '',
        released_at: row.released_at || null,
        claimed_at: row.claimed_at || null,
        created_at: row.created_at,
        proof: row.payout_proof_id
            ? {
                payout_proof_id: row.payout_proof_id,
                file_name: row.proof_file_name,
                proof_status: row.proof_status || 'Pending Review',
                submitted_at: row.proof_submitted_at || null,
                reviewed_at: row.proof_reviewed_at || null,
                admin_comment: row.proof_admin_comment || '',
                rejection_reason: row.proof_rejection_reason || '',
              }
            : null,
    }));

    return { items };
}


// sanitizeFileName: handles sanitize file name for the Payout flow.
function sanitizeFileName(value) {
    const original = path.basename(safeText(value) || 'payout-proof');
    const extension = path.extname(original).toLowerCase();
    const base = path.basename(original, extension)
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'payout-proof';
    return `${base}${extension}`;
}

// uploadMyPayoutProof: uploads upload my payout proof for the Payout flow.
async function uploadMyPayoutProof(userId, payoutEntryId, file) {
    if (!userId) throw createHttpError(401, 'Authentication required.');
    if (!file?.buffer?.length) throw createHttpError(400, 'Select a payout proof file to upload.');
    const proofMimeType = inferProofMimeType(file);
    if (!ALLOWED_PROOF_MIME_TYPES.has(proofMimeType)) {
        throw createHttpError(400, 'Only PDF, JPG, PNG, or WEBP payout proof files are allowed.');
    }

    const ownership = await pool.query(
        `
        SELECT
          pbs.payout_entry_id,
          pbs.payout_batch_id,
          pbs.student_id,
          pbs.application_id,
          pbs.release_status,
          st.user_id,
          pp.file_path AS existing_file_path
        FROM payout_batch_students pbs
        INNER JOIN students st ON st.student_id = pbs.student_id
        LEFT JOIN payout_proofs pp ON pp.payout_entry_id = pbs.payout_entry_id
        WHERE pbs.payout_entry_id = $1
          AND st.user_id = $2
        LIMIT 1
        `,
        [payoutEntryId, userId]
    );

    const entry = ownership.rows[0];
    if (!entry) throw createHttpError(404, 'Payout record not found.');
    if (String(entry.release_status || '').toLowerCase() !== 'released') {
        throw createHttpError(409, 'Proof can be submitted only after the payout is marked as released.');
    }

    const safeName = sanitizeFileName(file.originalname);
    const storagePath = `${entry.student_id}/${entry.payout_entry_id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
        .from(PAYOUT_PROOF_BUCKET)
        .upload(storagePath, file.buffer, {
            contentType: proofMimeType,
            upsert: false,
        });

    if (uploadError) {
        throw createHttpError(500, `Failed to upload payout proof: ${uploadError.message}`);
    }

    try {
        const result = await pool.query(
            `
            INSERT INTO payout_proofs (
              payout_entry_id,
              payout_batch_id,
              student_id,
              application_id,
              file_name,
              file_path,
              mime_type,
              file_size_bytes,
              proof_status,
              submitted_at,
              reviewed_by,
              reviewed_at,
              admin_comment,
              rejection_reason,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending Review', now(), NULL, NULL, NULL, NULL, now())
            ON CONFLICT (payout_entry_id)
            DO UPDATE SET
              file_name = EXCLUDED.file_name,
              file_path = EXCLUDED.file_path,
              mime_type = EXCLUDED.mime_type,
              file_size_bytes = EXCLUDED.file_size_bytes,
              proof_status = 'Pending Review',
              submitted_at = now(),
              reviewed_by = NULL,
              reviewed_at = NULL,
              admin_comment = NULL,
              rejection_reason = NULL,
              updated_at = now()
            RETURNING *
            `,
            [
                entry.payout_entry_id,
                entry.payout_batch_id,
                entry.student_id,
                entry.application_id,
                safeName,
                storagePath,
                proofMimeType,
                file.size || file.buffer.length,
            ]
        );

        if (entry.existing_file_path && entry.existing_file_path !== storagePath) {
            await supabase.storage
                .from(PAYOUT_PROOF_BUCKET)
                .remove([entry.existing_file_path])
                .catch(() => null);
        }

        return {
            message: 'Payout proof submitted for OSFA review.',
            proof: result.rows[0],
        };
    } catch (error) {
        await supabase.storage.from(PAYOUT_PROOF_BUCKET).remove([storagePath]).catch(() => null);
        throw error;
    }
}

// SMARTPDM_CLAIM_20261014: authenticated, one-time student receipt acknowledgement.
async function claimMyPayout(userId, payoutEntryId) {
    if (!userId) throw createHttpError(401, 'Authentication required.');
    if (!/^[0-9a-f-]{36}$/i.test(String(payoutEntryId || ''))) throw createHttpError(400, 'Invalid payout entry ID.');
    const result = await pool.query(
        `UPDATE payout_batch_students pbs SET claimed_at = NOW()
         FROM students st
         WHERE pbs.payout_entry_id = $1 AND st.student_id = pbs.student_id
           AND st.user_id = $2 AND LOWER(TRIM(COALESCE(pbs.release_status, ''))) = 'released'
           AND pbs.claimed_at IS NULL
         RETURNING pbs.payout_entry_id, pbs.claimed_at`, [payoutEntryId, userId]);
    if (result.rowCount) {
        // SMARTPDM_CLAIM_NOTIFY_20261014: only the first successful claim produces an OSFA alert.
        // A repeated claim returns already_claimed and does not notify again.
        try {
            const claimInfo = await pool.query(`
                SELECT pbs.payout_batch_id, pb.payout_title,
                       st.pdm_id, st.first_name, st.last_name
                FROM payout_batch_students pbs
                JOIN payout_batches pb ON pb.payout_batch_id = pbs.payout_batch_id
                JOIN students st ON st.student_id = pbs.student_id
                WHERE pbs.payout_entry_id = $1 AND st.user_id = $2
                LIMIT 1
            `, [payoutEntryId, userId]);
            const info = claimInfo.rows[0];
            if (info) {
                const notificationService = require('./notificationService');
                const scholarName = [info.first_name, info.last_name].filter(Boolean).join(' ').trim();
                await notificationService.createStaffNotifications({
                    roles: ['admin'],
                    type: 'Payout Claimed',
                    title: 'Scholar confirmed payout receipt',
                    message: [scholarName || info.pdm_id || 'A scholar', info.pdm_id ? '(' + info.pdm_id + ')' : '', 'confirmed receipt of', info.payout_title || 'a scholarship payout'].filter(Boolean).join(' ') + '.',
                    referenceId: info.payout_batch_id,
                    referenceType: 'payout_batch',
                });
            }
        } catch (notificationError) {
            // Do not undo a successful financial receipt acknowledgement if notifications fail.
            console.error('PAYOUT CLAIM STAFF NOTIFICATION ERROR:', notificationError);
        }
        return { message: 'Payout receipt confirmed.', claimed_at: result.rows[0].claimed_at };
    }
    const existing = await pool.query(
        `SELECT pbs.claimed_at, pbs.release_status FROM payout_batch_students pbs
         JOIN students st ON st.student_id = pbs.student_id
         WHERE pbs.payout_entry_id = $1 AND st.user_id = $2 LIMIT 1`, [payoutEntryId, userId]);
    if (!existing.rowCount) throw createHttpError(404, 'Payout not found.');
    if (existing.rows[0].claimed_at) return { message: 'Payout was already confirmed.', claimed_at: existing.rows[0].claimed_at, already_claimed: true };
    throw createHttpError(409, 'Payout must be released before you can confirm receiving it.');
}

module.exports = {
    getMyPayouts,
    claimMyPayout,
    uploadMyPayoutProof,
};
