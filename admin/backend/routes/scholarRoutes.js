const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET scholar stats
router.get('/stats', async (req, res) => {
    try {
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

        res.json(result.rows[0]);
    } catch (err) {
        console.error("DATABASE STATS ERROR:", err.message);
        res.status(500).json({ message: "Database stats error", error: err.message });
    }
});

// GET all scholars with Joined data
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        s.scholar_id,
        s.status,
        s.batch_year,
        s.date_awarded,
        st.pdm_id AS student_number,
        st.first_name || ' ' || st.last_name AS student_name,
        st.gwa,
        st.sdo_status,

        CASE 
          WHEN st.sdo_status = 'Minor Offense' THEN 'minor'
          WHEN st.sdo_status = 'Major Offense' THEN 'major'
          ELSE 'none'
        END AS sdu_level,

        ac.course_code AS program_name
      FROM scholars s
      JOIN students st ON s.student_id = st.student_id
      JOIN academic_course ac ON st.course_id = ac.course_id
      WHERE st.is_archived = false
      ORDER BY st.last_name ASC;
    `);

        res.json(result.rows);
    } catch (err) {
        console.error("DATABASE QUERY ERROR:", err.message);
        res.status(500).json({ message: "Database error", error: err.message });
    }
});

module.exports = router;