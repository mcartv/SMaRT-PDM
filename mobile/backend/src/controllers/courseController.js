const courseService = require('../services/courseService');

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