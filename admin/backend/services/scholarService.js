const db = require('../config/db');
const supabase = require('../config/supabase');

const SDO_STATUS_MAP = {
  clear: 'Clear',
  minor: 'Minor Offense',
  major: 'Major Offense',
};

const SDO_OFFENSE_LEVEL_MAP = {
  minor: 'Minor (P1)',
  major: 'Major (P2)',
};

function mapSdoLevelFromRecord(offenseLevel, status, studentStatus) {
  if (status !== 'Active') {
    if (studentStatus === 'Minor Offense') return 'minor';
    if (studentStatus === 'Major Offense') return 'major';
    return 'none';
  }

  if (offenseLevel === 'Minor (P1)') return 'minor';
  if (offenseLevel === 'Major (P2)') return 'major';
  if (studentStatus === 'Minor Offense') return 'minor';
  if (studentStatus === 'Major Offense') return 'major';

  return 'none';
}

function mapStudentStatusFromLevel(level) {
  if (level === 'minor') return SDO_STATUS_MAP.minor;
  if (level === 'major') return SDO_STATUS_MAP.major;
  return SDO_STATUS_MAP.clear;
}

function extractAvatarStoragePath(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;

  if (!/^https?:\/\//i.test(rawValue)) {
    return rawValue.replace(/^avatars\//, '');
  }

  const markers = [
    '/storage/v1/object/public/avatars/',
    '/storage/v1/object/sign/avatars/',
    '/storage/v1/object/authenticated/avatars/',
  ];

  for (const marker of markers) {
    const markerIndex = rawValue.indexOf(marker);
    if (markerIndex >= 0) {
      return rawValue.slice(markerIndex + marker.length).split('?')[0];
    }
  }

  return null;
}

async function resolveAvatarUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;

  const storagePath = extractAvatarStoragePath(rawValue);
  if (!storagePath) {
    return rawValue;
  }

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (error) {
    return rawValue;
  }

  return data?.signedUrl || rawValue;
}

exports.fetchScholarStats = async () => {
  const result = await db.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE COALESCE(st.scholarship_status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
          AND COALESCE(st.scholar_is_archived, false) = false
      ) AS total_scholar_records,
      COUNT(*) FILTER (
        WHERE COALESCE(st.scholarship_status, 'None') = 'Active'
          AND COALESCE(st.scholar_is_archived, false) = false
      ) AS active,
      COUNT(*) FILTER (
        WHERE COALESCE(st.scholarship_status, 'None') = 'Active'
          AND COALESCE(st.scholar_is_archived, false) = false
          AND st.gwa >= 2.0
      ) AS at_risk,
      ROUND(
        AVG(NULLIF(st.gwa, 0)) FILTER (
          WHERE COALESCE(st.scholarship_status, 'None') = 'Active'
            AND COALESCE(st.scholar_is_archived, false) = false
        )::numeric,
        2
      ) AS avg_gwa
    FROM students st
    WHERE COALESCE(st.is_archived, false) = false;
  `);

  return result.rows[0];
};

exports.fetchAllScholars = async () => {
  let result;

  try {
    result = await db.query(`
      SELECT
        st.student_id,
        cs.application_id AS application_id,
        cs.program_id AS program_id,
        cs.status AS status,
        cs.academic_year_id AS academic_year_id,
        cs.period_id AS period_id,
        ay.label AS academic_year,
        ap.term AS semester,
        cs.date_awarded,
        COALESCE(cs.ro_progress, 0) AS ro_progress,
        cs.remarks,
        cs.is_archived,

        st.user_id,
        st.pdm_id AS student_number,
        TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) AS student_name,
        st.first_name,
        st.last_name,
        st.gwa,
        st.sdo_status,
        COALESCE(st.section, '') AS section,

        latest_sdo.record_id AS sdo_record_id,
        latest_sdo.offense_level,
        latest_sdo.offense_description AS sdo_comment,
        latest_sdo.date_reported AS sdo_comment_date,
        latest_sdo.status AS sdo_record_status,

        u.email,
        u.phone_number,
        st.profile_photo_url,

        sp.program_name

      FROM students st
      JOIN current_scholars cs
        ON cs.student_id = st.student_id
      LEFT JOIN users u
        ON st.user_id = u.user_id
      LEFT JOIN scholarship_program sp
        ON cs.program_id = sp.program_id
      LEFT JOIN academic_years ay
        ON cs.academic_year_id = ay.academic_year_id
      LEFT JOIN academic_period ap
        ON cs.period_id = ap.period_id
      LEFT JOIN LATERAL (
        SELECT
          record_id,
          offense_level,
          offense_description,
          date_reported,
          status
        FROM sdo_records
        WHERE student_id = st.student_id
        ORDER BY
          CASE WHEN status = 'Active' THEN 0 ELSE 1 END,
          date_reported DESC
        LIMIT 1
      ) latest_sdo ON true
      WHERE COALESCE(st.is_archived, false) = false
        AND COALESCE(cs.is_archived, false) = false
        AND COALESCE(cs.status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
      ORDER BY st.last_name ASC, st.first_name ASC;
    `);
  } catch (err) {
    const errorText = String(err?.message || '').toLowerCase();
    const isCurrentSchemaMismatch =
      errorText.includes('current_scholars') ||
      errorText.includes('cs.application_id') ||
      errorText.includes('cs.program_id') ||
      errorText.includes('cs.status') ||
      errorText.includes('cs.academic_year_id') ||
      errorText.includes('cs.period_id');

    if (isCurrentSchemaMismatch) {
      if (err.message && err.message.includes('st.section')) {
        result = await db.query(`
          SELECT
            st.student_id,
            st.current_application_id AS application_id,
            st.current_program_id AS program_id,
            st.scholarship_status AS status,
            st.active_academic_year_id AS academic_year_id,
            st.active_period_id AS period_id,
            ay.label AS academic_year,
            ap.term AS semester,
            st.date_awarded,
            COALESCE(st.ro_progress, 0) AS ro_progress,
            st.scholar_remarks AS remarks,
            st.scholar_is_archived AS is_archived,

            st.user_id,
            st.pdm_id AS student_number,
            TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) AS student_name,
            st.first_name,
            st.last_name,
            st.gwa,
            st.sdo_status,
            '' AS section,

            latest_sdo.record_id AS sdo_record_id,
            latest_sdo.offense_level,
            latest_sdo.offense_description AS sdo_comment,
            latest_sdo.date_reported AS sdo_comment_date,
            latest_sdo.status AS sdo_record_status,

            u.email,
            u.phone_number,
            st.profile_photo_url,

            sp.program_name

          FROM students st
          LEFT JOIN users u
            ON st.user_id = u.user_id
          LEFT JOIN scholarship_program sp
            ON st.current_program_id = sp.program_id
          LEFT JOIN academic_years ay
            ON st.active_academic_year_id = ay.academic_year_id
          LEFT JOIN academic_period ap
            ON st.active_period_id = ap.period_id
          LEFT JOIN LATERAL (
            SELECT
              record_id,
              offense_level,
              offense_description,
              date_reported,
              status
            FROM sdo_records
            WHERE student_id = st.student_id
            ORDER BY
              CASE WHEN status = 'Active' THEN 0 ELSE 1 END,
              date_reported DESC
            LIMIT 1
          ) latest_sdo ON true
          WHERE COALESCE(st.is_archived, false) = false
            AND COALESCE(st.scholar_is_archived, false) = false
            AND COALESCE(st.scholarship_status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
          ORDER BY st.last_name ASC, st.first_name ASC;
        `);
      } else {
        result = await db.query(`
          SELECT
            st.student_id,
            st.current_application_id AS application_id,
            st.current_program_id AS program_id,
            st.scholarship_status AS status,
            st.active_academic_year_id AS academic_year_id,
            st.active_period_id AS period_id,
            ay.label AS academic_year,
            ap.term AS semester,
            st.date_awarded,
            COALESCE(st.ro_progress, 0) AS ro_progress,
            st.scholar_remarks AS remarks,
            st.scholar_is_archived AS is_archived,

            st.user_id,
            st.pdm_id AS student_number,
            TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) AS student_name,
            st.first_name,
            st.last_name,
            st.gwa,
            st.sdo_status,
            COALESCE(st.section, '') AS section,

            latest_sdo.record_id AS sdo_record_id,
            latest_sdo.offense_level,
            latest_sdo.offense_description AS sdo_comment,
            latest_sdo.date_reported AS sdo_comment_date,
            latest_sdo.status AS sdo_record_status,

            u.email,
            u.phone_number,
            st.profile_photo_url,

            sp.program_name

          FROM students st
          LEFT JOIN users u
            ON st.user_id = u.user_id
          LEFT JOIN scholarship_program sp
            ON st.current_program_id = sp.program_id
          LEFT JOIN academic_years ay
            ON st.active_academic_year_id = ay.academic_year_id
          LEFT JOIN academic_period ap
            ON st.active_period_id = ap.period_id
          LEFT JOIN LATERAL (
            SELECT
              record_id,
              offense_level,
              offense_description,
              date_reported,
              status
            FROM sdo_records
            WHERE student_id = st.student_id
            ORDER BY
              CASE WHEN status = 'Active' THEN 0 ELSE 1 END,
              date_reported DESC
            LIMIT 1
          ) latest_sdo ON true
          WHERE COALESCE(st.is_archived, false) = false
            AND COALESCE(st.scholar_is_archived, false) = false
            AND COALESCE(st.scholarship_status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
          ORDER BY st.last_name ASC, st.first_name ASC;
        `);
      }
    } else if (err.message && err.message.includes('st.section')) {
      result = await db.query(`
        SELECT
          st.student_id,
          st.current_application_id AS application_id,
          st.current_program_id AS program_id,
          st.scholarship_status AS status,
          st.active_academic_year_id AS academic_year_id,
          st.active_period_id AS period_id,
          ay.label AS academic_year,
          ap.term AS semester,
          st.date_awarded,
          COALESCE(st.ro_progress, 0) AS ro_progress,
          st.scholar_remarks AS remarks,
          st.scholar_is_archived AS is_archived,

          st.user_id,
          st.pdm_id AS student_number,
          TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) AS student_name,
          st.first_name,
          st.last_name,
          st.gwa,
          st.sdo_status,
          '' AS section,

          latest_sdo.record_id AS sdo_record_id,
          latest_sdo.offense_level,
          latest_sdo.offense_description AS sdo_comment,
          latest_sdo.date_reported AS sdo_comment_date,
          latest_sdo.status AS sdo_record_status,

          u.email,
          u.phone_number,
          st.profile_photo_url,

          sp.program_name

        FROM students st
        LEFT JOIN users u
          ON st.user_id = u.user_id
        LEFT JOIN scholarship_program sp
          ON st.current_program_id = sp.program_id
        LEFT JOIN academic_years ay
          ON st.active_academic_year_id = ay.academic_year_id
        LEFT JOIN academic_period ap
          ON st.active_period_id = ap.period_id
        LEFT JOIN LATERAL (
          SELECT
            record_id,
            offense_level,
            offense_description,
            date_reported,
            status
          FROM sdo_records
          WHERE student_id = st.student_id
          ORDER BY
            CASE WHEN status = 'Active' THEN 0 ELSE 1 END,
            date_reported DESC
          LIMIT 1
        ) latest_sdo ON true
        WHERE COALESCE(st.is_archived, false) = false
          AND COALESCE(st.scholar_is_archived, false) = false
          AND COALESCE(st.scholarship_status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
        ORDER BY st.last_name ASC, st.first_name ASC;
      `);
    } else {
      throw err;
    }
  }

  return Promise.all(
    result.rows.map(async (row) => ({
      scholar_id: row.student_id,
      student_id: row.student_id,
      application_id: row.application_id,
      program_id: row.program_id,
      status: row.status,
      academic_year_id: row.academic_year_id,
      period_id: row.period_id,
      academic_year: row.academic_year,
      batch_year: row.academic_year || null,
      semester: row.semester,
      date_awarded: row.date_awarded,
      ro_progress: row.ro_progress,
      remarks: row.remarks,

      user_id: row.user_id,
      student_number: row.student_number,
      student_name: row.student_name,
      first_name: row.first_name,
      last_name: row.last_name,
      gwa: row.gwa,
      sdo_status: row.sdo_status,
      section: row.section || '',

      sdo_record_id: row.sdo_record_id,
      offense_level: row.offense_level,
      sdo_comment: row.sdo_comment || '',
      sdo_comment_date: row.sdo_comment_date,
      sdo_record_status: row.sdo_record_status,

      email: row.email,
      phone_number: row.phone_number,
      profile_photo_url: row.profile_photo_url,
      avatar_url: await resolveAvatarUrl(row.profile_photo_url),
      program_name: row.program_name || 'N/A',

      sdu_level: mapSdoLevelFromRecord(
        row.offense_level,
        row.sdo_record_status,
        row.sdo_status
      ),
    }))
  );
};

exports.fetchScholarById = async (studentId) => {
  const scholarResult = await db.query(
    `
    SELECT
      st.student_id,
      st.current_application_id AS application_id,
      st.current_program_id AS program_id,
      st.scholarship_status AS status,
      st.active_academic_year_id AS academic_year_id,
      st.active_period_id AS period_id,
      ay.label AS academic_year,
      ap.term AS semester,
      st.date_awarded,
      COALESCE(st.ro_progress, 0) AS ro_progress,
      st.scholar_remarks AS remarks,

      st.user_id,
      st.pdm_id AS student_number,
      st.first_name,
      st.last_name,
      TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) AS student_name,
      st.gwa,
      st.sdo_status,
      st.profile_photo_url,

      u.email,
      u.phone_number,

      spf.*,

      sp.program_name,

      latest_sdo.record_id AS sdo_record_id,
      latest_sdo.offense_level,
      latest_sdo.offense_description AS sdo_comment,
      latest_sdo.date_reported AS sdo_comment_date,
      latest_sdo.status AS sdo_record_status

    FROM students st
    LEFT JOIN users u
      ON st.user_id = u.user_id
    LEFT JOIN student_profiles spf
      ON st.student_id = spf.student_id
    LEFT JOIN scholarship_program sp
      ON st.current_program_id = sp.program_id
    LEFT JOIN academic_years ay
      ON st.active_academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap
      ON st.active_period_id = ap.period_id
    LEFT JOIN LATERAL (
      SELECT
        record_id,
        offense_level,
        offense_description,
        date_reported,
        status
      FROM sdo_records
      WHERE student_id = st.student_id
      ORDER BY
        CASE WHEN status = 'Active' THEN 0 ELSE 1 END,
        date_reported DESC
      LIMIT 1
    ) latest_sdo ON true
    WHERE st.student_id = $1
      AND COALESCE(st.is_archived, false) = false
      AND COALESCE(st.scholar_is_archived, false) = false
      AND COALESCE(st.scholarship_status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
    LIMIT 1;
    `,
    [studentId]
  );

  if (!scholarResult.rows.length) {
    throw new Error('Scholar not found');
  }

  const row = scholarResult.rows[0];

  const addressSummary = [
    row.street_address,
    row.subdivision,
    row.city,
    row.province,
    row.zip_code,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    scholar_id: row.student_id,
    student_id: row.student_id,
    application_id: row.application_id,
    program_id: row.program_id,

    status: row.status,
    academic_year_id: row.academic_year_id,
    period_id: row.period_id,
    academic_year: row.academic_year || null,
    semester: row.semester || null,
    batch_year: row.academic_year || null,

    date_awarded: row.date_awarded || null,
    ro_progress: Number(row.ro_progress || 0),
    remarks: row.remarks || null,

    student_number: row.student_number || 'N/A',
    student_name: row.student_name || 'Unknown Scholar',
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    gwa: row.gwa ?? null,
    sdo_status: row.sdo_status || 'Clear',
    sdu_level:
      String(row.offense_level || '').toLowerCase().includes('major')
        ? 'major'
        : String(row.offense_level || '').toLowerCase().includes('minor')
          ? 'minor'
          : 'none',

    email: row.email || 'N/A',
    phone_number: row.phone_number || 'N/A',
    avatar_url: await resolveAvatarUrl(row.profile_photo_url),

    program_name: row.program_name || 'N/A',
    address_summary: addressSummary || 'Not available',

    student_profile: {
      profile_id: row.profile_id || null,
      date_of_birth: row.date_of_birth || null,
      place_of_birth: row.place_of_birth || null,
      sex: row.sex || null,
      civil_status: row.civil_status || null,
      maiden_name: row.maiden_name || null,
      religion: row.religion || null,
      citizenship: row.citizenship || null,
      street_address: row.street_address || null,
      subdivision: row.subdivision || null,
      city: row.city || null,
      province: row.province || null,
      zip_code: row.zip_code || null,
      landline_number: row.landline_number || null,
      learners_reference_number: row.learners_reference_number || null,
      financial_support_type: row.financial_support_type || null,
      financial_support_other: row.financial_support_other || null,
      has_prior_scholarship: row.has_prior_scholarship ?? false,
      prior_scholarship_details: row.prior_scholarship_details || null,
      has_disciplinary_record: row.has_disciplinary_record ?? false,
      disciplinary_details: row.disciplinary_details || null,
      self_description: row.self_description || null,
      aims_and_ambitions: row.aims_and_ambitions || null,
      applicant_signature_url: row.applicant_signature_url || null,
      guardian_signature_url: row.guardian_signature_url || null,
    },

    activity_logs: [],
  };
};

exports.fetchScholarRenewalDocuments = async (studentId) => {
  const scholarResult = await db.query(
    `
    SELECT
      st.student_id,
      st.current_application_id AS application_id,
      st.pdm_id AS student_number,
      st.first_name,
      st.last_name,
      TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) AS student_name,
      st.gwa,
      st.sdo_status
    FROM students st
    WHERE st.student_id = $1
      AND COALESCE(st.is_archived, false) = false
      AND COALESCE(st.scholar_is_archived, false) = false
      AND COALESCE(st.scholarship_status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
    LIMIT 1;
    `,
    [studentId]
  );

  if (!scholarResult.rows.length) {
    throw new Error('Scholar not found');
  }

  const scholar = scholarResult.rows[0];

  try {
    const docsResult = await db.query(
      `
      SELECT
        d.document_id AS id,
        COALESCE(r.requirement_name, d.document_type, 'Renewal Document') AS document_type,
        COALESCE(d.file_name, r.requirement_name, d.document_type, 'Document') AS document_name,
        d.file_url,
        COALESCE(d.document_status, 'Pending Review') AS status,
        d.created_at AS uploaded_at,
        COALESCE(d.ocr_status, 'Not Analyzed') AS ocr_status,
        COALESCE(d.extracted_text, '') AS extracted_text,
        COALESCE(d.ocr_fields, '{}'::jsonb) AS ocr_fields,
        COALESCE(d.remarks, '') AS remarks,
        d.confidence
      FROM documents d
      LEFT JOIN document_requirements r
        ON d.requirement_id = r.requirement_id
      WHERE d.student_id = $1
        AND COALESCE(d.is_archived, false) = false
        AND (
          COALESCE(d.is_renewal_document, true) = true
          OR COALESCE(r.category, '') = 'Renewal'
        )
      ORDER BY d.created_at DESC;
      `,
      [scholar.student_id]
    );

    if (docsResult.rows.length > 0) {
      return docsResult.rows.map((doc) => ({
        id: doc.id,
        name: doc.document_name,
        type: doc.document_type,
        url: doc.file_url,
        status: doc.status,
        uploaded_at: doc.uploaded_at,
        ocr_status: doc.ocr_status,
        extracted_text: doc.extracted_text,
        ocr_fields: doc.ocr_fields || {},
        remarks: doc.remarks,
        confidence: doc.confidence,
      }));
    }
  } catch (err) {
    console.warn('RENEWAL DOCUMENTS FALLBACK MODE:', err.message);
  }

  if (scholar.application_id) {
    const applicationDocs = await db.query(
      `
      SELECT
        ad.document_id AS id,
        ad.document_type,
        COALESCE(ad.file_name, ad.document_type, 'Document') AS document_name,
        ad.file_url,
        ad.submitted_at AS uploaded_at,
        COALESCE(ad.notes, '') AS remarks
      FROM application_documents ad
      WHERE ad.application_id = $1
      ORDER BY ad.submitted_at DESC NULLS LAST, ad.document_id ASC;
      `,
      [scholar.application_id]
    );

    if (applicationDocs.rows.length > 0) {
      return applicationDocs.rows.map((doc) => ({
        id: doc.id,
        name: doc.document_name,
        type: doc.document_type,
        url: doc.file_url || '',
        status: doc.file_url ? 'Uploaded' : 'Missing',
        uploaded_at: doc.uploaded_at,
        ocr_status: doc.file_url ? 'Ready for OCR' : 'Not Available',
        extracted_text: '',
        ocr_fields: {},
        remarks: doc.remarks || '',
        confidence: null,
      }));
    }
  }

  return [];
};

exports.fetchSdoStats = async () => {
  let result;

  try {
    result = await db.query(`
      WITH latest_sdo AS (
        SELECT DISTINCT ON (sr.student_id)
          sr.student_id,
          sr.offense_level,
          sr.status
        FROM sdo_records sr
        ORDER BY sr.student_id,
                 CASE WHEN sr.status = 'Active' THEN 0 ELSE 1 END,
                 sr.date_reported DESC
      )
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE COALESCE(st.sdo_status, 'Clear') = 'Clear'
        ) AS clear_count,
        COUNT(*) FILTER (
          WHERE ls.status = 'Active' AND ls.offense_level = 'Minor (P1)'
        ) AS minor_count,
        COUNT(*) FILTER (
          WHERE ls.status = 'Active' AND ls.offense_level = 'Major (P2)'
        ) AS major_count,
        COUNT(*) FILTER (
          WHERE ls.status = 'Active'
        ) AS on_probation,
        COUNT(*) FILTER (
          WHERE COALESCE(cs.status, 'None') = 'Active'
            AND COALESCE(cs.is_archived, false) = false
        ) AS active_scholars
      FROM students st
      JOIN current_scholars cs
        ON cs.student_id = st.student_id
      LEFT JOIN latest_sdo ls ON ls.student_id = st.student_id
      WHERE COALESCE(st.is_archived, false) = false
        AND COALESCE(cs.is_archived, false) = false;
    `);
  } catch (err) {
    const errorText = String(err?.message || '').toLowerCase();
    const isCurrentSchemaMismatch =
      errorText.includes('current_scholars') ||
      errorText.includes('cs.status') ||
      errorText.includes('cs.is_archived');

    if (!isCurrentSchemaMismatch) {
      throw err;
    }

    result = await db.query(`
      WITH latest_sdo AS (
        SELECT DISTINCT ON (sr.student_id)
          sr.student_id,
          sr.offense_level,
          sr.status
        FROM sdo_records sr
        ORDER BY sr.student_id,
                 CASE WHEN sr.status = 'Active' THEN 0 ELSE 1 END,
                 sr.date_reported DESC
      )
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(st.scholarship_status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
            AND COALESCE(st.scholar_is_archived, false) = false
        ) AS total,
        COUNT(*) FILTER (
          WHERE COALESCE(st.sdo_status, 'Clear') = 'Clear'
        ) AS clear_count,
        COUNT(*) FILTER (
          WHERE ls.status = 'Active' AND ls.offense_level = 'Minor (P1)'
        ) AS minor_count,
        COUNT(*) FILTER (
          WHERE ls.status = 'Active' AND ls.offense_level = 'Major (P2)'
        ) AS major_count,
        COUNT(*) FILTER (
          WHERE ls.status = 'Active'
        ) AS on_probation,
        COUNT(*) FILTER (
          WHERE COALESCE(st.scholarship_status, 'None') = 'Active'
            AND COALESCE(st.scholar_is_archived, false) = false
        ) AS active_scholars
      FROM students st
      LEFT JOIN latest_sdo ls ON ls.student_id = st.student_id
      WHERE COALESCE(st.is_archived, false) = false;
    `);
  }

  return result.rows[0];
};

exports.updateScholarSdoStatus = async (studentId, payload, actor = {}) => {
  const normalizedStatus = String(payload?.status || '')
    .trim()
    .toLowerCase();
  const comment = String(payload?.comment || '').trim();

  if (!['clear', 'minor', 'major'].includes(normalizedStatus)) {
    throw new Error('Invalid SDO status value');
  }

  let scholarResult;

  try {
    scholarResult = await db.query(
      `
      SELECT
        st.student_id,
        st.first_name,
        st.last_name
      FROM students st
      JOIN current_scholars cs
        ON cs.student_id = st.student_id
      WHERE st.student_id = $1
        AND COALESCE(st.is_archived, false) = false
        AND COALESCE(cs.is_archived, false) = false
        AND COALESCE(cs.status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
      LIMIT 1;
      `,
      [studentId]
    );
  } catch (err) {
    const errorText = String(err?.message || '').toLowerCase();
    const isCurrentSchemaMismatch =
      errorText.includes('current_scholars') ||
      errorText.includes('cs.status') ||
      errorText.includes('cs.is_archived');

    if (!isCurrentSchemaMismatch) {
      throw err;
    }

    scholarResult = await db.query(
      `
      SELECT
        st.student_id,
        st.first_name,
        st.last_name
      FROM students st
      WHERE st.student_id = $1
        AND COALESCE(st.is_archived, false) = false
        AND COALESCE(st.scholar_is_archived, false) = false
        AND COALESCE(st.scholarship_status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
      LIMIT 1;
      `,
      [studentId]
    );
  }

  const scholar = scholarResult.rows[0];
  if (!scholar) {
    return null;
  }

  const studentStatus = mapStudentStatusFromLevel(normalizedStatus);
  const offenseLevel = SDO_OFFENSE_LEVEL_MAP[normalizedStatus];
  const actorUserId = actor?.userId || null;

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
      UPDATE sdo_records
      SET status = 'Lifted'
      WHERE student_id = $1
        AND status = 'Active';
      `,
      [scholar.student_id]
    );

    await client.query(
      `
      UPDATE students
      SET sdo_status = $2
      WHERE student_id = $1;
      `,
      [scholar.student_id, studentStatus]
    );

    if (normalizedStatus !== 'clear') {
      await client.query(
        `
        INSERT INTO sdo_records (
          student_id,
          reported_by,
          offense_level,
          offense_description,
          date_reported,
          status
        )
        VALUES ($1, $2, $3, $4, NOW(), 'Active');
        `,
        [
          scholar.student_id,
          actorUserId,
          offenseLevel,
          comment || `Status updated to ${studentStatus}`,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    scholar_id: scholar.student_id,
    student_id: scholar.student_id,
    student_name: `${scholar.first_name} ${scholar.last_name}`,
    sdo_status: studentStatus,
    sdu_level: normalizedStatus,
    comment,
  };
};

async function getLatestRenewalByStudentId(studentId) {
  const { data, error } = await supabase
    .from('renewals')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

exports.getLatestRenewalByStudentId = getLatestRenewalByStudentId;
