// SMaRT-PDM: public Settings Controller — public Settings Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const publicSettingsService = require('../services/publicSettingsService');
const { getSafeStatusCode } = require('../utils/httpStatus');

// getPublicGeneralSettings: reads and returns get public general settings for the public Settings Controller flow.
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

// getPublicMaintenanceState: reads and returns get public maintenance state for the public Settings Controller flow.
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

// getScholarshipPrograms: reads and returns get scholarship programs for the public Settings Controller flow.
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
