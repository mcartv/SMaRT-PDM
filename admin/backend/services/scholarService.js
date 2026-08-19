const db = require('../config/db');
const supabase = require('../config/supabase');

const SDO_STATUS_MAP = {
  clear: 'Clear',
  minor: 'Minor Offense',
  major: 'Major Offense',
};

function mapSdoLevelFromStudentStatus(studentStatus) {
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

  if (!rawValue) {
    return null;
  }

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
      return rawValue
        .slice(markerIndex + marker.length)
        .split('?')[0];
    }
  }

  return null;
}

async function resolveAvatarUrl(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return null;
  }

  const storagePath = extractAvatarStoragePath(rawValue);

  if (!storagePath) {
    return rawValue;
  }

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(
      storagePath,
      60 * 60 * 24 * 7
    );

  if (error) {
    console.warn(
      'SCHOLAR AVATAR SIGNED URL ERROR:',
      error.message
    );

    return rawValue;
  }

  return data?.signedUrl || rawValue;
}

function normalizeScholarRow(row) {
  return {
    scholar_id: row.student_id,
    student_id: row.student_id,
    application_id: row.application_id || null,
    program_id: row.program_id || null,

    status: row.status || 'None',
    academic_year_id: row.academic_year_id || null,
    period_id: row.period_id || null,
    academic_year: row.academic_year || null,
    batch_year: row.academic_year || null,
    semester: row.semester || null,

    date_awarded: row.date_awarded || null,
    ro_status: row.ro_status || 'Pending',
    remarks: row.remarks || null,

    user_id: row.user_id || null,
    student_number: row.student_number || 'N/A',
    student_name: row.student_name || 'Unknown Scholar',
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    gwa: row.gwa ?? null,

    sdo_status: row.sdo_status || 'Clear',
    sdu_level: mapSdoLevelFromStudentStatus(
      row.sdo_status
    ),

    course_id: row.course_id || null,
    course_code: row.course_code || '',
    course_name: row.course_name || '',

    /*
     * These fields are retained for frontend compatibility.
     * The sdo_records table is intentionally no longer used.
     */
    sdo_record_id: null,
    offense_level: null,
    sdo_comment: '',
    sdo_comment_date: null,
    sdo_record_status: null,

    email: row.email || 'N/A',
    phone_number: row.phone_number || 'N/A',
    profile_photo_url: row.profile_photo_url || null,

    program_name: row.program_name || 'N/A',
  };
}

exports.fetchScholarStats = async () => {
  const result = await db.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE COALESCE(
          st.scholarship_status,
          'None'
        ) IN (
          'Active',
          'On Hold',
          'Inactive',
          'Removed'
        )
        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false
      ) AS total,

      COUNT(*) FILTER (
        WHERE COALESCE(
          st.scholarship_status,
          'None'
        ) IN (
          'Active',
          'On Hold',
          'Inactive',
          'Removed'
        )
        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false
      ) AS total_scholar_records,

      COUNT(*) FILTER (
        WHERE COALESCE(
          st.scholarship_status,
          'None'
        ) = 'Active'
        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false
      ) AS active,

      COUNT(*) FILTER (
        WHERE COALESCE(
          st.scholarship_status,
          'None'
        ) = 'Active'
        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false
        AND st.gwa >= 2.0
      ) AS at_risk,

      ROUND(
        AVG(
          NULLIF(st.gwa, 0)
        ) FILTER (
          WHERE COALESCE(
            st.scholarship_status,
            'None'
          ) = 'Active'
          AND COALESCE(
            st.scholar_is_archived,
            false
          ) = false
        )::numeric,
        2
      ) AS avg_gwa

    FROM students st

    WHERE COALESCE(
      st.is_archived,
      false
    ) = false;
  `);

  return result.rows[0];
};

exports.fetchAllScholars = async () => {
  const result = await db.query(`
    SELECT
      st.student_id,

      st.current_application_id
        AS application_id,

      st.current_program_id
        AS program_id,

      st.scholarship_status
        AS status,

      st.active_academic_year_id
        AS academic_year_id,

      st.active_period_id
        AS period_id,

      ay.label
        AS academic_year,

      ap.term
        AS semester,

      st.date_awarded,

      COALESCE(
        st.ro_status,
        'Pending'
      ) AS ro_status,

      st.scholar_remarks
        AS remarks,

      st.scholar_is_archived
        AS is_archived,

      st.user_id,

      st.pdm_id
        AS student_number,

      TRIM(
        CONCAT(
          COALESCE(st.first_name, ''),
          ' ',
          COALESCE(st.last_name, '')
        )
      ) AS student_name,

      st.first_name,
      st.last_name,
      st.gwa,
      st.sdo_status,

      COALESCE(st.course_id, smr.course_id) AS course_id,
      ac.course_code,
      ac.course_name,

      u.email,

      COALESCE(
        st.phone_number,
        u.phone_number
      ) AS phone_number,

      st.profile_photo_url,

      sp.program_name

    FROM students st

    LEFT JOIN users u
      ON u.user_id = st.user_id

    LEFT JOIN scholarship_program sp
      ON sp.program_id =
        st.current_program_id

    LEFT JOIN student_master_records smr
      ON smr.master_student_id = st.master_student_id

    LEFT JOIN academic_course ac
      ON ac.course_id = COALESCE(st.course_id, smr.course_id)

    LEFT JOIN academic_years ay
      ON ay.academic_year_id =
        st.active_academic_year_id

    LEFT JOIN academic_period ap
      ON ap.period_id =
        st.active_period_id

    WHERE COALESCE(
      st.is_archived,
      false
    ) = false

      AND COALESCE(
        st.scholar_is_archived,
        false
      ) = false

      AND COALESCE(
        st.scholarship_status,
        'None'
      ) IN (
        'Active',
        'On Hold',
        'Inactive',
        'Removed'
      )

    ORDER BY
      st.last_name ASC,
      st.first_name ASC;
  `);

  return Promise.all(
    result.rows.map(async (row) => {
      const scholar = normalizeScholarRow(row);

      scholar.avatar_url =
        await resolveAvatarUrl(
          row.profile_photo_url
        );

      return scholar;
    })
  );
};

exports.fetchScholarById = async (studentId) => {
  const scholarResult = await db.query(
    `
    SELECT
      st.student_id,

      st.current_application_id
        AS application_id,

      st.current_program_id
        AS program_id,

      st.scholarship_status
        AS status,

      st.active_academic_year_id
        AS academic_year_id,

      st.active_period_id
        AS period_id,

      ay.label
        AS academic_year,

      ap.term
        AS semester,

      st.date_awarded,

      COALESCE(
        st.ro_status,
        'Pending'
      ) AS ro_status,

      st.scholar_remarks
        AS remarks,

      st.user_id,

      st.pdm_id
        AS student_number,

      st.first_name,
      st.last_name,

      TRIM(
        CONCAT(
          COALESCE(st.first_name, ''),
          ' ',
          COALESCE(st.last_name, '')
        )
      ) AS student_name,

      st.gwa,
      st.sdo_status,
      COALESCE(st.course_id, smr.course_id) AS course_id,
      ac.course_code,
      ac.course_name,
      st.profile_photo_url,

      u.email,

      COALESCE(
        st.phone_number,
        u.phone_number
      ) AS phone_number,

      spf.*,

      sp.program_name

    FROM students st

    LEFT JOIN users u
      ON u.user_id = st.user_id

    LEFT JOIN student_profiles spf
      ON spf.student_id =
        st.student_id

    LEFT JOIN scholarship_program sp
      ON sp.program_id =
        st.current_program_id

    LEFT JOIN student_master_records smr
      ON smr.master_student_id = st.master_student_id

    LEFT JOIN academic_course ac
      ON ac.course_id = COALESCE(st.course_id, smr.course_id)

    LEFT JOIN academic_years ay
      ON ay.academic_year_id =
        st.active_academic_year_id

    LEFT JOIN academic_period ap
      ON ap.period_id =
        st.active_period_id

    WHERE st.student_id = $1

      AND COALESCE(
        st.is_archived,
        false
      ) = false

      AND COALESCE(
        st.scholar_is_archived,
        false
      ) = false

      AND COALESCE(
        st.scholarship_status,
        'None'
      ) IN (
        'Active',
        'On Hold',
        'Inactive',
        'Removed'
      )

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

    application_id:
      row.application_id || null,

    program_id:
      row.program_id || null,

    status:
      row.status || 'None',

    academic_year_id:
      row.academic_year_id || null,

    period_id:
      row.period_id || null,

    academic_year:
      row.academic_year || null,

    semester:
      row.semester || null,

    batch_year:
      row.academic_year || null,

    date_awarded:
      row.date_awarded || null,

    ro_status:
      row.ro_status || 'Pending',

    remarks:
      row.remarks || null,

    user_id:
      row.user_id || null,

    student_number:
      row.student_number || 'N/A',

    student_name:
      row.student_name ||
      'Unknown Scholar',

    first_name:
      row.first_name || null,

    last_name:
      row.last_name || null,

    gwa:
      row.gwa ?? null,

    sdo_status:
      row.sdo_status || 'Clear',

    sdu_level:
      mapSdoLevelFromStudentStatus(
        row.sdo_status
      ),

    /*
     * Retained for frontend compatibility.
     * No sdo_records table is queried.
     */
    sdo_record_id: null,
    offense_level: null,
    sdo_comment: '',
    sdo_comment_date: null,
    sdo_record_status: null,

    email:
      row.email || 'N/A',

    phone_number:
      row.phone_number || 'N/A',

    profile_photo_url:
      row.profile_photo_url || null,

    avatar_url:
      await resolveAvatarUrl(
        row.profile_photo_url
      ),

    program_name:
      row.program_name || 'N/A',

    course_id:
      row.course_id || null,

    course_code:
      row.course_code || '',

    course_name:
      row.course_name || '',

    address_summary:
      addressSummary || 'Not available',

    student_profile: {
      profile_id:
        row.profile_id || null,

      date_of_birth:
        row.date_of_birth || null,

      place_of_birth:
        row.place_of_birth || null,

      sex:
        row.sex || null,

      civil_status:
        row.civil_status || null,

      maiden_name:
        row.maiden_name || null,

      religion:
        row.religion || null,

      citizenship:
        row.citizenship || null,

      street_address:
        row.street_address || null,

      subdivision:
        row.subdivision || null,

      city:
        row.city || null,

      province:
        row.province || null,

      zip_code:
        row.zip_code || null,

      landline_number:
        row.landline_number || null,

      learners_reference_number:
        row.learners_reference_number ||
        null,

      financial_support_type:
        row.financial_support_type ||
        null,

      financial_support_other:
        row.financial_support_other ||
        null,

      has_prior_scholarship:
        row.has_prior_scholarship ??
        false,

      prior_scholarship_details:
        row.prior_scholarship_details ||
        null,

      has_disciplinary_record:
        row.has_disciplinary_record ??
        false,

      disciplinary_details:
        row.disciplinary_details ||
        null,

      self_description:
        row.self_description || null,

      aims_and_ambitions:
        row.aims_and_ambitions || null,

      applicant_signature_url:
        row.applicant_signature_url ||
        null,

      guardian_signature_url:
        row.guardian_signature_url ||
        null,
    },

    activity_logs: [],
  };
};

exports.fetchScholarRenewalDocuments =
  async (studentId) => {
    const scholarResult = await db.query(
      `
      SELECT
        st.student_id,

        st.current_application_id
          AS application_id,

        st.pdm_id
          AS student_number,

        st.first_name,
        st.last_name,

        TRIM(
          CONCAT(
            COALESCE(st.first_name, ''),
            ' ',
            COALESCE(st.last_name, '')
          )
        ) AS student_name,

        st.gwa,
        st.sdo_status

      FROM students st

      WHERE st.student_id = $1

        AND COALESCE(
          st.is_archived,
          false
        ) = false

        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false

        AND COALESCE(
          st.scholarship_status,
          'None'
        ) IN (
          'Active',
          'On Hold',
          'Inactive',
          'Removed'
        )

      LIMIT 1;
      `,
      [studentId]
    );

    if (!scholarResult.rows.length) {
      throw new Error('Scholar not found');
    }

    const scholar =
      scholarResult.rows[0];

    try {
      const docsResult = await db.query(
        `
        SELECT
          d.document_id
            AS id,

          COALESCE(
            r.requirement_name,
            d.document_type,
            'Renewal Document'
          ) AS document_type,

          COALESCE(
            d.file_name,
            r.requirement_name,
            d.document_type,
            'Document'
          ) AS document_name,

          d.file_url,

          COALESCE(
            d.document_status,
            'Pending Review'
          ) AS status,

          d.created_at
            AS uploaded_at,

          COALESCE(
            d.ocr_status,
            'Not Analyzed'
          ) AS ocr_status,

          COALESCE(
            d.extracted_text,
            ''
          ) AS extracted_text,

          COALESCE(
            d.ocr_fields,
            '{}'::jsonb
          ) AS ocr_fields,

          COALESCE(
            d.remarks,
            ''
          ) AS remarks,

          d.confidence

        FROM documents d

        LEFT JOIN document_requirements r
          ON r.requirement_id =
            d.requirement_id

        WHERE d.student_id = $1

          AND COALESCE(
            d.is_archived,
            false
          ) = false

          AND (
            COALESCE(
              d.is_renewal_document,
              true
            ) = true

            OR COALESCE(
              r.category,
              ''
            ) = 'Renewal'
          )

        ORDER BY
          d.created_at DESC;
        `,
        [scholar.student_id]
      );

      if (docsResult.rows.length > 0) {
        return docsResult.rows.map(
          (document) => ({
            id: document.id,

            name:
              document.document_name,

            type:
              document.document_type,

            url:
              document.file_url || '',

            status:
              document.status,

            uploaded_at:
              document.uploaded_at,

            ocr_status:
              document.ocr_status,

            extracted_text:
              document.extracted_text,

            ocr_fields:
              document.ocr_fields || {},

            remarks:
              document.remarks || '',

            confidence:
              document.confidence ?? null,
          })
        );
      }
    } catch (error) {
      console.warn(
        'RENEWAL DOCUMENTS FALLBACK MODE:',
        error.message
      );
    }

    if (scholar.application_id) {
      const applicationDocs =
        await db.query(
          `
          SELECT
            ad.document_id
              AS id,

            ad.document_type,

            COALESCE(
              ad.file_name,
              ad.document_type,
              'Document'
            ) AS document_name,

            ad.file_url,

            ad.submitted_at
              AS uploaded_at,

            COALESCE(
              ad.notes,
              ''
            ) AS remarks

          FROM application_documents ad

          WHERE ad.application_id = $1

          ORDER BY
            ad.submitted_at DESC
              NULLS LAST,

            ad.document_id ASC;
          `,
          [scholar.application_id]
        );

      if (
        applicationDocs.rows.length > 0
      ) {
        return applicationDocs.rows.map(
          (document) => ({
            id: document.id,

            name:
              document.document_name,

            type:
              document.document_type,

            url:
              document.file_url || '',

            status:
              document.file_url
                ? 'Uploaded'
                : 'Missing',

            uploaded_at:
              document.uploaded_at,

            ocr_status:
              document.file_url
                ? 'Ready for OCR'
                : 'Not Available',

            extracted_text: '',
            ocr_fields: {},

            remarks:
              document.remarks || '',

            confidence: null,
          })
        );
      }
    }

    return [];
  };

exports.fetchSdoStats = async () => {
  const result = await db.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE COALESCE(
          st.scholarship_status,
          'None'
        ) IN (
          'Active',
          'On Hold',
          'Inactive',
          'Removed'
        )

        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false
      ) AS total,

      COUNT(*) FILTER (
        WHERE COALESCE(
          st.sdo_status,
          'Clear'
        ) = 'Clear'

        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false
      ) AS clear_count,

      COUNT(*) FILTER (
        WHERE st.sdo_status =
          'Minor Offense'

        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false
      ) AS minor_count,

      COUNT(*) FILTER (
        WHERE st.sdo_status =
          'Major Offense'

        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false
      ) AS major_count,

      COUNT(*) FILTER (
        WHERE st.sdo_status IN (
          'Minor Offense',
          'Major Offense'
        )

        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false
      ) AS on_probation,

      COUNT(*) FILTER (
        WHERE COALESCE(
          st.scholarship_status,
          'None'
        ) = 'Active'

        AND COALESCE(
          st.scholar_is_archived,
          false
        ) = false
      ) AS active_scholars

    FROM students st

    WHERE COALESCE(
      st.is_archived,
      false
    ) = false;
  `);

  return result.rows[0];
};

exports.updateScholarSdoStatus =
  async (
    studentId,
    payload,
    actor = {}
  ) => {
    const normalizedStatus = String(
      payload?.status || ''
    )
      .trim()
      .toLowerCase();

    const comment = String(
      payload?.comment || ''
    ).trim();

    if (
      ![
        'clear',
        'minor',
        'major',
      ].includes(normalizedStatus)
    ) {
      throw new Error(
        'Invalid SDO status value'
      );
    }

    const studentStatus =
      mapStudentStatusFromLevel(
        normalizedStatus
      );

    const result = await db.query(
      `
      UPDATE students

      SET
        sdo_status = $2,

        scholar_remarks =
          CASE
            WHEN $3::text <> ''
              THEN $3
            ELSE scholar_remarks
          END,

        updated_at = NOW()

      WHERE student_id = $1

        AND COALESCE(
          is_archived,
          false
        ) = false

        AND COALESCE(
          scholar_is_archived,
          false
        ) = false

        AND COALESCE(
          scholarship_status,
          'None'
        ) IN (
          'Active',
          'On Hold',
          'Inactive',
          'Removed'
        )

      RETURNING
        student_id,
        first_name,
        last_name,
        sdo_status,
        ro_status;
      `,
      [
        studentId,
        studentStatus,
        comment,
      ]
    );

    const scholar = result.rows[0];

    if (!scholar) {
      return null;
    }

    return {
      scholar_id:
        scholar.student_id,

      student_id:
        scholar.student_id,

      student_name:
        `${scholar.first_name} ${scholar.last_name}`
          .trim(),

      sdo_status:
        scholar.sdo_status,

      sdu_level:
        normalizedStatus,

      ro_status:
        scholar.ro_status ||
        'Pending',

      comment,

      updated_by:
        actor?.user_id ||
        actor?.userId ||
        actor?.id ||
        null,
    };
  };

async function getLatestRenewalByStudentId(
  studentId
) {
  const { data, error } = await supabase
    .from('renewals')
    .select('*')
    .eq('student_id', studentId)
    .order(
      'created_at',
      { ascending: false }
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

exports.getLatestRenewalByStudentId =
  getLatestRenewalByStudentId;

exports.archiveScholarAndReleaseSlot =
  async (
    studentId,
    payload = {},
    actor = {}
  ) => {
    const selectionService =
      require('./selectionService');

    return selectionService
      .releaseScholarSlotAndPromote({
        studentId,
        actor,

        reason:
          payload.reason ||
          'Removed from scholarship',

        notes:
          payload.notes || '',

        archiveStudent:
          payload.archive_student === true,
      });
  };
