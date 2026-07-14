const socketEvents = require('../utils/socketEvents');
const auditLogService = require('../services/auditLogService');
const generalSettingService = require('../services/generalSettingService');

function getActorUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

async function writeGeneralSettingAudit(req, result) {
  try {
    if (typeof auditLogService?.logAudit !== 'function') return;

    await auditLogService.logAudit({
      req,
      userId: getActorUserId(req),
      actionTaken: 'UPDATE_GENERAL_SETTINGS',
      module: 'Maintenance - General Settings',
      entityType: 'general_settings',
      entityId: 'general_settings',
      description: 'Updated public general system settings.',
      metadata: {
        changes: req.body || {},
        updated_at: result?.updated_at || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('GENERAL SETTINGS AUDIT ERROR:', error.message);
  }
}

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
    const publicResult = await generalSettingService.getPublicGeneralSettings();

    const io = req.app.get('io');
    socketEvents.maintenanceUpdated(io, {
      source: 'general_settings',
      updated_at: result.updated_at || new Date().toISOString(),
      settings: publicResult,
    });

    socketEvents.reportUpdated(io, {
      module: 'reports',
      source: 'general_settings',
      action: 'updated',
      updated_at: result.updated_at || new Date().toISOString(),
    });

    await writeGeneralSettingAudit(req, result);

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
