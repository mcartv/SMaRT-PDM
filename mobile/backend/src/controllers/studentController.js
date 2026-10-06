// SMaRT-PDM: student Controller — student Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const studentService = require('../services/studentService');

// getRequestUserId: reads and returns get request user id for the student Controller flow.
function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// getSafeStatusCode: reads and returns get safe status code for the student Controller flow.
function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);
    return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
        ? parsed
        : 500;
}

// getMyStatus: reads and returns get my status for the student Controller flow.
async function getMyStatus(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await studentService.getMyStatus(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('GET STUDENT STATUS ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load student status.',
        });
    }
}

module.exports = {
    getMyStatus,
};