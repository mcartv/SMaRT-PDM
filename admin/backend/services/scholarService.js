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
        JOIN academic_course ac ON st.course_id = ac.course_id
        WHERE COALESCE(st.is_archived, false) = false;
    `);

    return result.rows[0];
};

exports.fetchAllScholars = async () => {
    const result = await db.query(`
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
      latest_sdo.record_id AS sdo_record_id,
      latest_sdo.offense_level,
      latest_sdo.offense_description AS sdo_comment,
      latest_sdo.date_reported AS sdo_comment_date,
      latest_sdo.status AS sdo_record_status,
      u.email,
      u.phone_number,
      ac.course_code AS program_name
    FROM scholars s
    JOIN students st ON s.student_id = st.student_id
    LEFT JOIN users u ON st.user_id = u.user_id
    LEFT JOIN LATERAL (
      SELECT record_id, offense_level, offense_description, date_reported, status
      FROM sdo_records
      WHERE student_id = st.student_id
      ORDER BY
        CASE WHEN status = 'Active' THEN 0 ELSE 1 END,
        date_reported DESC
      LIMIT 1
    ) latest_sdo ON true
    JOIN academic_course ac ON st.course_id = ac.course_id
    WHERE COALESCE(st.is_archived, false) = false
    ORDER BY st.last_name ASC;
  `);

    return result.rows.map((row) => ({
        ...row,
        sdu_level: mapSdoLevelFromRecord(row.offense_level, row.sdo_record_status, row.sdo_status),
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
      st.first_name || ' ' || st.last_name AS student_name,
      st.gwa,
      st.sdo_status,
      latest_sdo.record_id AS sdo_record_id,
      latest_sdo.offense_level,
      latest_sdo.offense_description AS sdo_comment,
      latest_sdo.date_reported AS sdo_comment_date,
      latest_sdo.status AS sdo_record_status,
      u.email,
      u.phone_number,
      ac.course_code AS program_name
    FROM scholars s
    JOIN students st ON s.student_id = st.student_id
    LEFT JOIN users u ON st.user_id = u.user_id
    LEFT JOIN LATERAL (
      SELECT record_id, offense_level, offense_description, date_reported, status
      FROM sdo_records
      WHERE student_id = st.student_id
      ORDER BY
        CASE WHEN status = 'Active' THEN 0 ELSE 1 END,
        date_reported DESC
      LIMIT 1
    ) latest_sdo ON true
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
        sdu_level: mapSdoLevelFromRecord(scholar.offense_level, scholar.sdo_record_status, scholar.sdo_status),
        activity_logs: logs,
    };
};

exports.fetchSdoStats = async () => {
    const result = await db.query(`
        WITH latest_sdo AS (
            SELECT DISTINCT ON (student_id)
                student_id,
                offense_level,
                status,
                date_reported
            FROM sdo_records
            ORDER BY student_id,
                     CASE WHEN status = 'Active' THEN 0 ELSE 1 END,
                     date_reported DESC
        )
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (
                WHERE ls.student_id IS NULL OR ls.status <> 'Active'
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
        WHERE COALESCE(st.is_archived, false) = false;
    `);

    return result.rows[0];
};

exports.updateScholarSdoStatus = async (scholarId, payload, actor = {}) => {
    const normalizedStatus = String(payload?.status || '').trim().toLowerCase();
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
