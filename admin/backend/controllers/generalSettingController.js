const socketEvents = require('../utils/socketEvents');
const generalSettingService = require('../services/generalSettingService');

function getSafeStatusCode(error) {
  const parsed = Number.parseInt(error?.statusCode, 10);
  return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599 ? parsed : 500;
}

async function getPublicGeneralSettings(req, res) {
  try {
    const result = await generalSettingService.getPublicGeneralSettings();
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET PUBLIC GENERAL SETTINGS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load general settings.',
    });
  }
}

async function getGeneralSettings(req, res) {
  try {
    const result = await generalSettingService.getGeneralSettings();
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET GENERAL SETTINGS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load general settings.',
    });
  }
}

async function updateGeneralSettings(req, res) {
  try {
    const result = await generalSettingService.updateGeneralSettings(req.body || {}, req.user || {});

    const io = req.app.get('io');
    socketEvents.maintenanceUpdated(io, {
      source: 'general_settings',
      updated_at: result.updated_at || new Date().toISOString(),
      settings: result,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('UPDATE GENERAL SETTINGS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to update general settings.',
    });
  }
}

module.exports = {
  getPublicGeneralSettings,
  getGeneralSettings,
  updateGeneralSettings,
};
