const publicSettingsService = require('../services/publicSettingsService');
const { getSafeStatusCode } = require('../utils/httpStatus');

async function getPublicGeneralSettings(_req, res) {
    try {
        const result = await publicSettingsService.getPublicGeneralSettings();
        return res.status(200).json(result);
    } catch (error) {
        console.error('GET MOBILE PUBLIC GENERAL SETTINGS ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load public settings.',
        });
    }
}

async function getPublicMaintenanceState(_req, res) {
    try {
        const result = await publicSettingsService.getMaintenanceState();
        return res.status(200).json(result);
    } catch (error) {
        console.error('GET MOBILE PUBLIC MAINTENANCE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load maintenance status.',
        });
    }
}

async function getScholarshipPrograms(_req, res) {
    try {
        const result = await publicSettingsService.getPublishedScholarshipPrograms();
        return res.status(200).json(result);
    } catch (error) {
        console.error('GET MOBILE SCHOLARSHIP PROGRAMS ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load scholarship programs.',
        });
    }
}

module.exports = {
    getPublicGeneralSettings,
    getPublicMaintenanceState,
    getScholarshipPrograms,
};
