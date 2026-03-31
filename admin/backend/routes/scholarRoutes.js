const express = require('express');
const router = express.Router();
const pool = require('../config/db');

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