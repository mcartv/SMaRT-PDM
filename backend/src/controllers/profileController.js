const profileService = require('../services/profileService');

function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

async function getMyProfile(req, res) {
    try {
        const userId = getRequestUserId(req);
        const result = await profileService.getMyProfile(userId);

        return res.status(200).json(result);
    } catch (error) {
        console.error('PROFILE FETCH ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to load profile.',
        });
    }
}

async function updateMyProfile(req, res) {
    try {
        const userId = getRequestUserId(req);
        const result = await profileService.updateMyProfile(userId, req.body || {});

        return res.status(200).json(result);
    } catch (error) {
        console.error('PROFILE UPDATE ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to update profile.',
        });
    }
}

module.exports = {
    getMyProfile,
    updateMyProfile,
};