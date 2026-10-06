// SMaRT-PDM: Maintenance — general Setting Controller (admin backend controller); handles HTTP input/output and delegates business logic.
const socketEvents = require('../utils/socketEvents');
const auditLogService = require('../services/auditLogService');
const generalSettingService = require('../services/generalSettingService');
const studentRealtimeRelayService = require('../services/studentRealtimeRelayService');

// getActorUserId: reads and returns get actor user id for the Maintenance flow.
function getActorUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// writeGeneralSettingAudit: handles write general setting audit for the Maintenance flow.
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

// getSafeStatusCode: reads and returns get safe status code for the Maintenance flow.
function getSafeStatusCode(error) {
  const parsed = Number.parseInt(error?.statusCode, 10);
  return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599 ? parsed : 500;
}

// getPublicGeneralSettings: reads and returns get public general settings for the Maintenance flow.
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

// getGeneralSettings: reads and returns get general settings for the Maintenance flow.
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

// updateGeneralSettings: updates update general settings for the Maintenance flow.
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
    socketEvents.publicGeneralSettingsUpdated(io, {
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

    // general_settings is not part of the current Supabase realtime publication.
    // Relay only refresh metadata to the student backend; mobile then re-fetches
    // its own public/authenticated settings and FAQ data.
    studentRealtimeRelayService
      .relayModuleEvent({
        event: 'settings:updated',
        payload: {
          source: 'general_settings',
          updated_at: result.updated_at || new Date().toISOString(),
          notifications_enabled: result.notifications_enabled,
        },
      })
      .catch((error) => {
        console.error('GENERAL SETTINGS STUDENT REALTIME RELAY ERROR:', error.message);
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
