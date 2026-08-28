const fs = require('fs');
const socketEvents = require('../utils/socketEvents');
const auditLogService = require('../services/auditLogService');
const systemMaintenanceService = require('../services/systemMaintenanceService');
const systemActivityService = require('../services/systemActivityService');

function actorUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function statusCode(error) {
  const parsed = Number.parseInt(error?.statusCode, 10);
  return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599 ? parsed : 500;
}

async function audit(req, payload) {
  try {
    if (typeof auditLogService?.logAudit !== 'function') return;
    await auditLogService.logAudit({
      req,
      userId: actorUserId(req),
      ...payload,
    });
  } catch (error) {
    console.error('SYSTEM MAINTENANCE AUDIT ERROR:', error.message);
  }
}

async function getPublicState(_req, res) {
  try {
    const result = await systemMaintenanceService.getMaintenanceState();
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET PUBLIC SYSTEM MAINTENANCE ERROR:', error);
    return res.status(statusCode(error)).json({
      error: error.message || 'Failed to load maintenance status.',
    });
  }
}

async function getState(_req, res) {
  try {
    const result = await systemMaintenanceService.getMaintenanceState();
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET SYSTEM MAINTENANCE ERROR:', error);
    return res.status(statusCode(error)).json({
      error: error.message || 'Failed to load maintenance status.',
    });
  }
}

async function updateState(req, res) {
  try {
    if (typeof req.body?.maintenance_mode !== 'boolean') {
      return res.status(400).json({
        error: 'maintenance_mode must be true or false.',
      });
    }

    const result = await systemMaintenanceService.updateMaintenanceState({
      maintenanceMode: req.body.maintenance_mode,
      maintenanceMessage: req.body.maintenance_message,
      actorUserId: actorUserId(req),
    });

    const io = req.app.get('io');
    socketEvents.maintenanceUpdated(io, {
      source: 'system_maintenance',
      maintenance_mode: result.maintenance_mode,
      updated_at: result.updated_at || new Date().toISOString(),
    });

    await audit(req, {
      actionTaken: result.maintenance_mode
        ? 'ENABLE_MAINTENANCE_MODE'
        : 'DISABLE_MAINTENANCE_MODE',
      module: 'Maintenance - System',
      entityType: 'system_maintenance',
      entityId: 'general_settings',
      description: result.maintenance_mode
        ? 'Enabled student mobile application maintenance mode.'
        : 'Disabled student mobile application maintenance mode.',
      metadata: {
        maintenance_mode: result.maintenance_mode,
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('UPDATE SYSTEM MAINTENANCE ERROR:', error);
    return res.status(statusCode(error)).json({
      error: error.message || 'Failed to update maintenance mode.',
    });
  }
}

async function getStatus(_req, res) {
  try {
    const result = await systemMaintenanceService.getSystemStatus();
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET SYSTEM STATUS ERROR:', error);
    return res.status(statusCode(error)).json({
      error: error.message || 'Failed to load system status.',
    });
  }
}

async function recordPublicVisit(req, res) {
  try {
    await systemActivityService.recordPublicVisit({
      visitorId: req.body?.visitor_id,
      path: req.body?.path,
    });
    return res.sendStatus(204);
  } catch (error) {
    const code = statusCode(error);
    if (code >= 500) {
      console.error('PUBLIC WEB VISIT TRACK ERROR:', error);
    }
    return res.status(code).json({
      error: error.message || 'Failed to record web visit.',
    });
  }
}

async function getPublicVisitorCounts(_req, res) {
  try {
    const result = await systemActivityService.getPublicVisitorCounts();
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET PUBLIC VISITOR COUNTS ERROR:', error);
    return res.status(statusCode(error)).json({
      error: error.message || 'Failed to load website visitor counts.',
    });
  }
}

async function heartbeatActivity(_req, res) {
  return res.sendStatus(204);
}

async function downloadBackup(req, res) {
  let backup = null;

  try {
    backup = await systemMaintenanceService.createDatabaseBackup();

    await audit(req, {
      actionTaken: 'EXPORT_DATABASE_BACKUP',
      module: 'Maintenance - System',
      entityType: 'database_backup',
      entityId: backup.fileName,
      description: 'Downloaded a manual PostgreSQL SQL backup.',
      metadata: {
        backup_mode: backup.mode,
        bytes: backup.bytes,
      },
    });

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('X-SMaRT-PDM-Backup-Mode', backup.mode);

    return res.download(backup.filePath, backup.fileName, (error) => {
      try {
        if (backup?.filePath && fs.existsSync(backup.filePath)) {
          fs.unlinkSync(backup.filePath);
        }
      } catch (cleanupError) {
        console.warn('DATABASE BACKUP CLEANUP ERROR:', cleanupError.message);
      }

      if (error && !res.headersSent) {
        res.status(500).json({ error: 'Failed to send database backup.' });
      }
    });
  } catch (error) {
    try {
      if (backup?.filePath && fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
      }
    } catch {}

    console.error('DATABASE BACKUP ERROR:', error);
    return res.status(statusCode(error)).json({
      error: error.message || 'Failed to create database backup.',
    });
  }
}

module.exports = {
  getPublicState,
  getState,
  updateState,
  getStatus,
  getPublicVisitorCounts,
  recordPublicVisit,
  heartbeatActivity,
  downloadBackup,
};
