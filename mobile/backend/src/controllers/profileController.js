const profileService = require('../services/profileService');
const { getSafeStatusCode } = require('../utils/httpStatus');

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
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load profile.',
        });
    }
}

async function setupMyProfile(req, res) {
    try {
        const userId = getRequestUserId(req);
        const result = await profileService.setupMyProfile(userId, req.body || {});

        return res.status(200).json({
            message: 'Profile completed successfully.',
            profile: result?.profile || result,
        });
    } catch (error) {
        console.error('PROFILE SETUP ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to complete profile.',
        });
    }
}

async function updateMyProfile(req, res) {
    try {
        const userId = getRequestUserId(req);
        // Profile & Account may update contact/address information only.
        // Student identity, registered email and academic program are sourced
        // from the authoritative registry/onboarding workflow and must not be
        // mutable through the regular profile PATCH endpoint.
        const body = req.body || {};
        const allowedPayload = {};

        [
            'phone_number',
            'street_address',
            'subdivision',
            'barangay',
            'city',
            'province',
            'zip_code',
        ].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(body, key)) {
                allowedPayload[key] = body[key];
            }
        });

        const ignoredFields = Object.keys(body).filter(
            (key) => !Object.prototype.hasOwnProperty.call(allowedPayload, key)
        );
        const result = await profileService.updateMyProfile(userId, allowedPayload);

        return res.status(200).json({
            ...result,
            ...(ignoredFields.length > 0
                ? {
                    warning: 'Only phone number and address were updated.',
                    ignored_fields: ignoredFields,
                }
                : {}),
        });
    } catch (error) {
        console.error('PROFILE UPDATE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to update profile.',
        });
    }
}

async function getMyOnboardingPreference(req, res) {
    try {
        const result = await profileService.getMyOnboardingPreference(
            getRequestUserId(req)
        );
        return res.status(200).json(result);
    } catch (error) {
        console.error('ONBOARDING PREFERENCE FETCH ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load onboarding preference.',
        });
    }
}

async function markMyOnboardingSeen(req, res) {
    try {
        const result = await profileService.markMyOnboardingSeen(
            getRequestUserId(req)
        );
        return res.status(200).json(result);
    } catch (error) {
        console.error('ONBOARDING PREFERENCE UPDATE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to save onboarding preference.',
        });
    }
}

async function uploadAvatar(req, res) {
    try {
        const userId = getRequestUserId(req);
        const result = await profileService.uploadAvatar(userId, req.file);

        return res.status(200).json(result);
    } catch (error) {
        console.error('AVATAR UPLOAD ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to upload avatar.',
        });
    }
}

module.exports = {
    getMyProfile,
    getMyOnboardingPreference,
    markMyOnboardingSeen,
    setupMyProfile,
    updateMyProfile,
    uploadAvatar,
};
