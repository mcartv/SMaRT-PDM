const roSettingService = require('../services/roSettingService');

function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);
    return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
        ? parsed
        : 500;
}

async function getSettings(req, res) {
    try {
        const result = await roSettingService.getSettings();
        return res.status(200).json(result);
    } catch (error) {
        console.error('GET RO SETTINGS ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load RO settings.',
        });
    }
}

async function getActiveSetting(req, res) {
    try {
        const result = await roSettingService.getActiveSetting();
        return res.status(200).json(result);
    } catch (error) {
        console.error('GET ACTIVE RO SETTING ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load active RO setting.',
        });
    }
}

async function createSetting(req, res) {
    try {
        const result = await roSettingService.createSetting(req.body || {});
        return res.status(201).json(result);
    } catch (error) {
        console.error('CREATE RO SETTING ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to create RO setting.',
        });
    }
}

async function updateSetting(req, res) {
    try {
        const result = await roSettingService.updateSetting(
            req.params.settingId,
            req.body || {}
        );
        return res.status(200).json(result);
    } catch (error) {
        console.error('UPDATE RO SETTING ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to update RO setting.',
        });
    }
}

async function activateSetting(req, res) {
    try {
        const result = await roSettingService.activateSetting(req.params.settingId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('ACTIVATE RO SETTING ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to activate RO setting.',
        });
    }
}

async function getDepartments(req, res) {
    try {
        const result = await roSettingService.getDepartments();
        return res.status(200).json(result);
    } catch (error) {
        console.error('GET RO DEPARTMENTS ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load RO departments.',
        });
    }
}

async function createDepartment(req, res) {
    try {
        const result = await roSettingService.createDepartment(req.body || {});
        return res.status(201).json(result);
    } catch (error) {
        console.error('CREATE RO DEPARTMENT ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to create RO department.',
        });
    }
}

async function updateDepartment(req, res) {
    try {
        const result = await roSettingService.updateDepartment(
            req.params.departmentId,
            req.body || {}
        );
        return res.status(200).json(result);
    } catch (error) {
        console.error('UPDATE RO DEPARTMENT ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to update RO department.',
        });
    }
}

async function toggleDepartment(req, res) {
    try {
        const result = await roSettingService.toggleDepartment(req.params.departmentId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('TOGGLE RO DEPARTMENT ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to update RO department status.',
        });
    }
}

module.exports = {
    getSettings,
    getActiveSetting,
    createSetting,
    updateSetting,
    activateSetting,
    getDepartments,
    createDepartment,
    updateDepartment,
    toggleDepartment
};