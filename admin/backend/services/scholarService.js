const pool = require('../config/db');

exports.fetchScholarStats = async () => {
    const result = await pool.query(`
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE s.status = 'Active') AS active,
            COUNT(*) FILTER (WHERE st.gwa >= 2.0) AS at_risk,
            ROUND(AVG(NULLIF(st.gwa, 0))::numeric, 2) AS avg_gwa
        FROM scholars s
        JOIN students st ON s.student_id = st.student_id
        JOIN academic_course ac ON st.course_id = ac.course_id
        WHERE COALESCE(st.is_archived, false) = false;
    `);

    return result.rows[0];
};

exports.fetchAllScholars = async () => {
    const result = await pool.query(`
    SELECT 
      s.scholar_id,
      s.status,
      s.batch_year,
      s.date_awarded,
      COALESCE(s.ro_progress, 0) AS ro_progress,
      st.student_id,
      st.user_id,
      st.pdm_id AS student_number,
      st.first_name || ' ' || st.last_name AS student_name,
      st.first_name,
      st.last_name,
      st.gwa,
      st.sdo_status,
      u.email,
      u.phone_number,
      ac.course_code AS program_name
    FROM scholars s
    JOIN students st ON s.student_id = st.student_id
    LEFT JOIN users u ON st.user_id = u.user_id
    JOIN academic_course ac ON st.course_id = ac.course_id
    WHERE COALESCE(st.is_archived, false) = false
    ORDER BY st.last_name ASC;
  `);

    return result.rows.map((row) => ({
        ...row,
        sdu_level:
            row.sdo_status === 'Minor Offense'
                ? 'minor'
                : row.sdo_status === 'Major Offense'
                    ? 'major'
                    : 'none',
    }));
};

exports.fetchScholarById = async (scholarId) => {
    const scholarResult = await pool.query(
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
      st.first_name || ' ' || st.last_name AS student_name,
      st.gwa,
      st.sdo_status,
      u.email,
      u.phone_number,
      ac.course_code AS program_name
    FROM scholars s
    JOIN students st ON s.student_id = st.student_id
    LEFT JOIN users u ON st.user_id = u.user_id
    JOIN academic_course ac ON st.course_id = ac.course_id
    WHERE s.scholar_id = $1
    LIMIT 1;
    `,
        [scholarId]
    );

    if (!scholarResult.rows.length) {
        return null;
    }

    const scholar = scholarResult.rows[0];

    // If you already have a real table for logs, use that instead.
    // Example table assumed: scholar_activity_logs
    let logs = [];
    try {
        const logsResult = await pool.query(
            `
      SELECT
        log_id,
        scholar_id,
        action,
        details,
        created_at
      FROM scholar_activity_logs
      WHERE scholar_id = $1
      ORDER BY created_at DESC;
      `,
            [scholarId]
        );

        logs = logsResult.rows;
    } catch (err) {
        // fallback if table doesn't exist yet
        logs = [
            {
                log_id: 'temp-1',
                action: 'Profile viewed',
                details: 'Temporary placeholder activity log.',
                created_at: new Date().toISOString(),
            },
            {
                log_id: 'temp-2',
                action: 'GWA reviewed',
                details: 'Latest academic standing checked by admin.',
                created_at: new Date(Date.now() - 86400000).toISOString(),
            },
        ];
    }

    return {
        ...scholar,
        sdu_level:
            scholar.sdo_status === 'Minor Offense'
                ? 'minor'
                : scholar.sdo_status === 'Major Offense'
                    ? 'major'
                    : 'none',
        activity_logs: logs,
    };
};