const db = require('../config/db');

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

exports.fetchScholarStats = async () => {
  const result = await db.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE s.status = 'Active') AS active,
      COUNT(*) FILTER (WHERE st.gwa >= 2.0) AS at_risk,
      ROUND(AVG(NULLIF(st.gwa, 0))::numeric, 2) AS avg_gwa
    FROM scholars s
    JOIN students st ON s.student_id = st.student_id
    LEFT JOIN academic_course ac ON st.course_id = ac.course_id
    WHERE COALESCE(st.is_archived, false) = false
      AND COALESCE(s.is_archived, false) = false;
  `);

  return result.rows[0];
};

exports.fetchAllScholars = async () => {
  let result;

  try {
    // Preferred query: includes section if the column exists on students
    result = await db.query(`
      SELECT
        s.scholar_id,
        s.student_id,
        s.application_id,
        s.program_id,
        s.status,
        s.batch_year,
        s.date_awarded,
        COALESCE(s.ro_progress, 0) AS ro_progress,
        s.remarks,

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

        ac.course_code AS program_name

      FROM scholars s
      JOIN students st
        ON s.student_id = st.student_id
      LEFT JOIN users u
        ON st.user_id = u.user_id
      LEFT JOIN academic_course ac
        ON st.course_id = ac.course_id
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
        AND COALESCE(s.is_archived, false) = false
      ORDER BY st.last_name ASC, st.first_name ASC;
    `);
  } catch (err) {
    // Fallback if students.section does not exist yet
    if (err.message && err.message.includes('st.section')) {
      result = await db.query(`
        SELECT
          s.scholar_id,
          s.student_id,
          s.application_id,
          s.program_id,
          s.status,
          s.batch_year,
          s.date_awarded,
          COALESCE(s.ro_progress, 0) AS ro_progress,
          s.remarks,

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

          ac.course_code AS program_name

        FROM scholars s
        JOIN students st
          ON s.student_id = st.student_id
        LEFT JOIN users u
          ON st.user_id = u.user_id
        LEFT JOIN academic_course ac
          ON st.course_id = ac.course_id
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
          AND COALESCE(s.is_archived, false) = false
        ORDER BY st.last_name ASC, st.first_name ASC;
      `);
    } else {
      throw err;
    }
  }

  return result.rows.map((row) => ({
    scholar_id: row.scholar_id,
    student_id: row.student_id,
    application_id: row.application_id,
    program_id: row.program_id,
    status: row.status,
    batch_year: row.batch_year,
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
    program_name: row.program_name || 'N/A',

    sdu_level: mapSdoLevelFromRecord(
      row.offense_level,
      row.sdo_record_status,
      row.sdo_status
    ),
  }));
};

exports.fetchScholarById = async (scholarId) => {
  const scholarResult = await db.query(
    `
    SELECT
      s.scholar_id,
      s.status,
      s.batch_year,
      s.date_awarded,
      COALESCE(s.ro_progress, 0) AS ro_progress,
      st.student_id,
      st.user_id,
      st.pdm_id AS student_number,
      st.first_name,
      st.last_name,
      TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) AS student_name,
      st.gwa,
      st.sdo_status,

      st.certificate_of_registration_url,
      st.grade_form_url,
      st.certificate_of_indigency_url,
      st.valid_id_url,

      latest_sdo.record_id AS sdo_record_id,
      latest_sdo.offense_level,
      latest_sdo.offense_description AS sdo_comment,
      latest_sdo.date_reported AS sdo_comment_date,
      latest_sdo.status AS sdo_record_status,
      u.email,
      u.phone_number,
      st.profile_photo_url,
      sp.street_address,
      sp.subdivision,
      sp.city,
      sp.province,
      sp.zip_code,
      sp.date_of_birth,
      sp.place_of_birth,
      sp.sex,
      sp.civil_status,
      sp.religion,
      sp.citizenship,
      ac.course_code AS program_name
    FROM scholars s
    JOIN students st ON s.student_id = st.student_id
    LEFT JOIN users u ON st.user_id = u.user_id
    LEFT JOIN student_profiles sp ON st.student_id = sp.student_id
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
    LEFT JOIN academic_course ac ON st.course_id = ac.course_id
    WHERE s.scholar_id = $1
    LIMIT 1;
    `,
    [scholarId]
  );

  if (!scholarResult.rows.length) {
    return null;
  }

  const scholar = scholarResult.rows[0];

  const logsResult = await db.query(
    `
    SELECT
      record_id AS log_id,
      student_id,
      offense_level,
      offense_description,
      date_reported,
      status
    FROM sdo_records
    WHERE student_id = $1
    ORDER BY date_reported DESC;
    `,
    [scholar.student_id]
  );

  const logs = logsResult.rows.map((row) => ({
    log_id: row.log_id,
    action: `${row.offense_level} • ${row.status}`,
    details: row.offense_description || 'No disciplinary note provided.',
    created_at: row.date_reported,
  }));

  return {
    ...scholar,
    avatar_url: scholar.profile_photo_url || null,
    address_summary:
      [
        scholar.street_address,
        scholar.subdivision,
        scholar.city,
        scholar.province,
      ]
        .filter(Boolean)
        .join(', ') || null,
    student_profile: {
      street_address: scholar.street_address || null,
      subdivision: scholar.subdivision || null,
      city: scholar.city || null,
      province: scholar.province || null,
      zip_code: scholar.zip_code || null,
      date_of_birth: scholar.date_of_birth || null,
      place_of_birth: scholar.place_of_birth || null,
      sex: scholar.sex || null,
      civil_status: scholar.civil_status || null,
      religion: scholar.religion || null,
      citizenship: scholar.citizenship || null,
    },
    sdu_level: mapSdoLevelFromRecord(
      scholar.offense_level,
      scholar.sdo_record_status,
      scholar.sdo_status
    ),
    activity_logs: logs,
  };
};

exports.fetchScholarRenewalDocuments = async (scholarId) => {
  const scholarResult = await db.query(
    `
    SELECT
      s.scholar_id,
      st.student_id,
      st.user_id,
      st.pdm_id AS student_number,
      st.first_name,
      st.last_name,
      TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) AS student_name,
      st.gwa,
      st.sdo_status,
      st.certificate_of_registration_url,
      st.grade_form_url,
      st.certificate_of_indigency_url,
      st.valid_id_url
    FROM scholars s
    JOIN students st ON s.student_id = st.student_id
    WHERE s.scholar_id = $1
    LIMIT 1;
    `,
    [scholarId]
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

  return [
    {
      id: 'cor',
      name: 'Certificate of Registration',
      type: 'COR',
      url: scholar.certificate_of_registration_url || '',
      status: scholar.certificate_of_registration_url ? 'Uploaded' : 'Missing',
      uploaded_at: null,
      ocr_status: scholar.certificate_of_registration_url ? 'Ready for OCR' : 'Not Available',
      extracted_text: '',
      ocr_fields: {},
      remarks: '',
      confidence: null,
    },
    {
      id: 'grades',
      name: 'Grade Form',
      type: 'Grades',
      url: scholar.grade_form_url || '',
      status: scholar.grade_form_url ? 'Uploaded' : 'Missing',
      uploaded_at: null,
      ocr_status: scholar.grade_form_url ? 'Ready for OCR' : 'Not Available',
      extracted_text: '',
      ocr_fields: {},
      remarks: '',
      confidence: null,
    },
    {
      id: 'indigency',
      name: 'Certificate of Indigency',
      type: 'Indigency',
      url: scholar.certificate_of_indigency_url || '',
      status: scholar.certificate_of_indigency_url ? 'Uploaded' : 'Missing',
      uploaded_at: null,
      ocr_status: scholar.certificate_of_indigency_url ? 'Ready for OCR' : 'Not Available',
      extracted_text: '',
      ocr_fields: {},
      remarks: '',
      confidence: null,
    },
    {
      id: 'validid',
      name: 'Valid ID',
      type: 'Identification',
      url: scholar.valid_id_url || '',
      status: scholar.valid_id_url ? 'Uploaded' : 'Missing',
      uploaded_at: null,
      ocr_status: scholar.valid_id_url ? 'Ready for OCR' : 'Not Available',
      extracted_text: '',
      ocr_fields: {},
      remarks: '',
      confidence: null,
    },
  ];
};

exports.fetchSdoStats = async () => {
  const result = await db.query(`
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
      COUNT(*) FILTER (WHERE s.status = 'Active') AS active_scholars
    FROM scholars s
    JOIN students st ON s.student_id = st.student_id
    LEFT JOIN latest_sdo ls ON ls.student_id = st.student_id
    WHERE COALESCE(st.is_archived, false) = false
      AND COALESCE(s.is_archived, false) = false;
  `);

  return result.rows[0];
};

exports.updateScholarSdoStatus = async (scholarId, payload, actor = {}) => {
  const normalizedStatus = String(payload?.status || '')
    .trim()
    .toLowerCase();
  const comment = String(payload?.comment || '').trim();

  if (!['clear', 'minor', 'major'].includes(normalizedStatus)) {
    throw new Error('Invalid SDO status value');
  }

  const scholarResult = await db.query(
    `
    SELECT
      s.scholar_id,
      st.student_id,
      st.first_name,
      st.last_name
    FROM scholars s
    JOIN students st ON s.student_id = st.student_id
    WHERE s.scholar_id = $1
    LIMIT 1;
    `,
    [scholarId]
  );

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
    scholar_id: scholar.scholar_id,
    student_id: scholar.student_id,
    student_name: `${scholar.first_name} ${scholar.last_name}`,
    sdo_status: studentStatus,
    sdu_level: normalizedStatus,
    comment,
  };
};