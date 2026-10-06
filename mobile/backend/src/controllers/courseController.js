// SMaRT-PDM: Courses — course Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const courseService = require('../services/courseService');

// getCourses: reads and returns get courses for the Courses flow.
async function getCourses(req, res) {
    try {
        const result = await courseService.getCourses();
        return res.status(200).json(result);
    } catch (error) {
        console.error('COURSES ROUTE ERROR:', error);
        return res.status(500).json({
            error: error.message || 'Failed to load courses.',
        });
    }
}

module.exports = {
    getCourses,
};