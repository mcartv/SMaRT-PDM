const socketEvents = require('../utils/socketEvents');
const auditLogService = require('../services/auditLogService');
const themeSettingService = require('../services/themeSettingService');

function getActorUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

async function writeThemeSettingAudit(req, result) {
  try {
    if (typeof auditLogService?.logAudit !== 'function') return;

    await auditLogService.logAudit({
      req,
      userId: getActorUserId(req),
      actionTaken: 'UPDATE_THEME_SETTING',
      module: 'Maintenance - Theme Settings',
      entityType: 'theme_setting',
      entityId: result?.portal_key || req.params.portalKey || null,
      description: `Updated theme setting for ${result?.portal_key || req.params.portalKey || 'portal'}.`,
      metadata: {
        portal_key: result?.portal_key || req.params.portalKey || null,
        preset_key: result?.preset_key || req.body?.preset_key || null,
        custom_colors: result?.custom_colors || req.body?.custom_colors || null,
        changes: req.body || {},
      },
    });
  } catch (error) {
    console.error('THEME SETTINGS AUDIT ERROR:', error.message);
  }
}

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
    const result = await themeSettingService.getThemeSettings(req.user || {});
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET THEME SETTINGS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load theme settings.',
    });
  }
}

async function getCurrentThemeSetting(req, res) {
  try {
    const result = await themeSettingService.getPersonalThemeSetting(
      req.params.portalKey,
      req.user || {}
    );
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET PERSONAL THEME SETTING ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load personal theme setting.',
    });
  }
}

async function updateThemeSetting(req, res) {
  try {
    const result = await themeSettingService.updateThemeSetting(
      req.params.portalKey,
      req.body?.preset_key,
      req.user || {},
      req.body?.custom_colors || null
    );

    const io = req.app.get('io');
    socketEvents.maintenanceUpdated(io, {
      source: 'theme_settings',
      portal_key: result.portal_key,
      preset_key: result.preset_key,
      custom_colors: result.custom_colors || null,
      user_id: result.user_id || getActorUserId(req),
      is_personal: result.is_personal === true,
      updated_at: result.updated_at || new Date().toISOString(),
    });

    socketEvents.reportUpdated(io, {
      module: 'reports',
      source: 'theme_settings',
      action: 'updated',
      portal_key: result.portal_key,
      updated_at: result.updated_at || new Date().toISOString(),
    });

    await writeThemeSettingAudit(req, result);

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
  getCurrentThemeSetting,
  getThemeSettings,
  updateThemeSetting,
};
