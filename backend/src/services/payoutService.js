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

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

async function requireAdminProfile(adminUserId) {
    if (!adminUserId) throw createHttpError(401, 'Authentication required.');

    const { data, error } = await supabase
        .from('admin_profiles')
        .select('admin_id')
        .eq('user_id', adminUserId)
        .maybeSingle();

    if (error) throw error;
    if (!data?.admin_id) {
        throw createHttpError(403, 'An active administrator profile is required.');
    }
    return data.admin_id;
}

async function createPayoutBatch({ adminUserId, body = {} }) {
    const adminId = await requireAdminProfile(adminUserId);
    const programId = safeText(body.program_id);
    const openingId = safeText(body.opening_id) || null;
    const academicYearId = safeText(body.academic_year_id);
    const periodId = safeText(body.period_id) || null;
    const scholarIds = [...new Set((body.scholar_ids || []).map(safeText).filter(Boolean))];
    const amountPerScholar = Number(body.amount_per_scholar || 0);

    if (!programId) throw createHttpError(400, 'Program ID is required.');
    if (!academicYearId) throw createHttpError(400, 'Academic year is required.');
    if (scholarIds.length === 0) throw createHttpError(400, 'Select at least one scholar.');
    if (!Number.isFinite(amountPerScholar) || amountPerScholar <= 0) {
        throw createHttpError(400, 'Amount per scholar must be greater than zero.');
    }

    const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('student_id, current_application_id, user_id')
        .in('student_id', scholarIds)
        .eq('is_active_scholar', true);
    if (studentsError) throw studentsError;
    if ((students || []).length !== scholarIds.length) {
        throw createHttpError(409, 'One or more selected scholars are no longer eligible.');
    }

    const payoutDate = safeText(body.payout_date) || null;
    const { data: batch, error: batchError } = await supabase
        .from('payout_batches')
        .insert({
            program_id: programId,
            opening_id: openingId,
            academic_year_id: academicYearId,
            period_id: periodId,
            payout_title: safeText(body.payout_title) || 'Scholarship Payout',
            payout_date: payoutDate,
            payment_mode: safeText(body.payment_mode) || 'Cash',
            amount_per_scholar: amountPerScholar,
            total_amount: amountPerScholar * students.length,
            batch_status: payoutDate ? 'In Release' : 'Draft',
            remarks: safeText(body.remarks),
        })
        .select('*')
        .single();
    if (batchError) throw batchError;

    const entries = students.map((student) => ({
        payout_batch_id: batch.payout_batch_id,
        student_id: student.student_id,
        program_id: programId,
        application_id: student.current_application_id,
        amount_received: amountPerScholar,
        release_status: 'Pending',
    }));
    const { error: entriesError } = await supabase.from('payout_batch_students').insert(entries);
    if (entriesError) {
        await supabase.from('payout_batches').delete().eq('payout_batch_id', batch.payout_batch_id);
        throw entriesError;
    }

    return {
        message: 'Payout batch created.',
        batch,
        scholars_count: students.length,
        created_by: adminId,
    };
}

async function schedulePayoutBatch({ adminUserId, payoutBatchId, body = {} }) {
    await requireAdminProfile(adminUserId);
    const payoutDate = safeText(body.payout_date);
    if (!payoutBatchId) throw createHttpError(400, 'Payout batch ID is required.');
    if (!payoutDate) throw createHttpError(400, 'Payout date is required.');

    const { data: batch, error } = await supabase
        .from('payout_batches')
        .update({
            payout_date: payoutDate,
            batch_status: 'In Release',
            remarks: safeText(body.remarks),
            updated_at: new Date().toISOString(),
        })
        .eq('payout_batch_id', payoutBatchId)
        .select('*')
        .single();
    if (error) throw error;
    return { message: 'Payout batch scheduled.', batch };
}

async function updatePayoutEntryStatus({ adminUserId, payoutEntryId, body = {} }) {
    await requireAdminProfile(adminUserId);
    const status = safeText(body.release_status || body.status);
    const allowedStatuses = new Set(['Pending', 'Released', 'Absent', 'On Hold', 'Cancelled']);
    if (!payoutEntryId) throw createHttpError(400, 'Payout entry ID is required.');
    if (!allowedStatuses.has(status)) throw createHttpError(400, 'Invalid payout release status.');

    const { data: entry, error } = await supabase
        .from('payout_batch_students')
        .update({
            release_status: status,
            released_at: status === 'Released' ? new Date().toISOString() : null,
            remarks: safeText(body.remarks) || null,
        })
        .eq('payout_entry_id', payoutEntryId)
        .select('*')
        .single();
    if (error) throw error;
    return { message: 'Payout status updated.', entry };
}

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
      pbs.check_number,
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
      pb.payout_date,
      pb.payment_mode,
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
        payment_mode: row.payment_mode || '-',
        batch_status: row.batch_status || 'Pending',
        release_status: row.release_status || 'Pending',
        acknowledgement_status: row.acknowledgement_status || 'Pending',

        academic_year:
            row.academic_year_label ||
            (row.start_year && row.end_year
                ? `${row.start_year}-${row.end_year}`
                : '-'),

        semester: row.semester || '-',

        reference: row.check_number || row.payout_entry_id,
        remarks: row.entry_remarks || row.batch_remarks || '',
        released_at: row.released_at || null,
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


function sanitizeFileName(value) {
    const original = path.basename(safeText(value) || 'payout-proof');
    const extension = path.extname(original).toLowerCase();
    const base = path.basename(original, extension)
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'payout-proof';
    return `${base}${extension}`;
}

async function uploadMyPayoutProof(userId, payoutEntryId, file) {
    if (!userId) throw createHttpError(401, 'Authentication required.');
    if (!file?.buffer?.length) throw createHttpError(400, 'Select a payout proof file to upload.');
    if (!ALLOWED_PROOF_MIME_TYPES.has(file.mimetype)) {
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
            contentType: file.mimetype,
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
                file.mimetype,
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

module.exports = {
    createPayoutBatch,
    schedulePayoutBatch,
    updatePayoutEntryStatus,
    getMyPayouts,
    uploadMyPayoutProof,
};
