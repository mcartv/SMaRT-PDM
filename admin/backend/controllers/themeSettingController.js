const socketEvents = require('../utils/socketEvents');
const themeSettingService = require('../services/themeSettingService');

function getSafeStatusCode(error) {
  const parsed = Number.parseInt(error?.statusCode, 10);
  return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599 ? parsed : 500;
}

async function getPublicThemeSetting(req, res) {
  try {
    const result = await themeSettingService.getPublicThemeSetting(req.params.portalKey);
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET PUBLIC THEME SETTING ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load theme setting.',
    });
  }
}

async function getThemeSettings(req, res) {
  try {
    const result = await themeSettingService.getThemeSettings();
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET THEME SETTINGS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load theme settings.',
    });
  }
}

async function getThemeHistory(req, res) {
  try {
    const result = await themeSettingService.getThemeHistory(req.query?.portalKey || null);
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET THEME HISTORY ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load theme history.',
    });
  }
}

async function updateThemeSetting(req, res) {
  try {
    const result = await themeSettingService.updateThemeSetting(
      req.params.portalKey,
      req.body?.preset_key,
      req.user || {}
    );

    const io = req.app.get('io');
    socketEvents.maintenanceUpdated(io, {
      source: 'theme_settings',
      portal_key: result.portal_key,
      preset_key: result.preset_key,
      updated_at: result.updated_at || new Date().toISOString(),
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('UPDATE THEME SETTING ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to update theme setting.',
    });
  }
}

module.exports = {
  getPublicThemeSetting,
  getThemeSettings,
  getThemeHistory,
  updateThemeSetting,
};
