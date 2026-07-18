const roSettingService = require('../services/roSettingService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);

    return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
        ? parsed
        : 500;
}

async function writeRoSettingAudit(
    req,
    actionTaken,
    description,
    entityType,
    entityId,
    result,
    changes = {}
) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') return;

        await auditLogService.logAudit({
            req,
            userId: getActorUserId(req),
            actionTaken,
            module: 'Maintenance - RO Settings',
            entityType,
            entityId: entityId ? String(entityId) : null,
            description,
            metadata: {
                result,
                changes,
            },
        });
    } catch (error) {
        console.error('RO SETTINGS AUDIT ERROR:', error.message);
    }
}

function emitRoSettingUpdate(req, payload = {}) {
    try {
        const io = req.app?.get?.('io');

        if (!io) return;

        const eventPayload = {
            updated_at: new Date().toISOString(),
            ...payload,
        };

        if (typeof socketEvents?.roUpdated === 'function') {
            socketEvents.roUpdated(io, eventPayload);
            return;
        }

        if (typeof socketEvents?.emitEvent === 'function') {
            socketEvents.emitEvent(io, 'ro:updated', eventPayload);
            socketEvents.emitEvent(io, 'roUpdated', eventPayload);
            return;
        }

        io.emit('ro:updated', eventPayload);
        io.emit('roUpdated', eventPayload);
    } catch (error) {
        console.error('RO SETTINGS SOCKET ERROR:', error.message);
    }
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

        emitRoSettingUpdate(req, {
            source: 'ro_setting',
            action: 'create',
            data: result,
        });

        await writeRoSettingAudit(
            req,
            'CREATE_RO_SETTING',
            'Created RO setting.',
            'ro_setting',
            result?.setting?.setting_id || null,
            result,
            req.body || {}
        );

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

        emitRoSettingUpdate(req, {
            source: 'ro_setting',
            action: 'update',
            setting_id: req.params.settingId,
            data: result,
        });

        await writeRoSettingAudit(
            req,
            'UPDATE_RO_SETTING',
            'Updated RO setting.',
            'ro_setting',
            req.params.settingId,
            result,
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

        emitRoSettingUpdate(req, {
            source: 'ro_setting',
            action: 'activate',
            setting_id: req.params.settingId,
            data: result,
        });

        await writeRoSettingAudit(
            req,
            'ACTIVATE_RO_SETTING',
            'Activated RO setting and applied it to pending RO records.',
            'ro_setting',
            req.params.settingId,
            result,
            {}
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('ACTIVATE RO SETTING ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to activate RO setting.',
        });
    }
}

async function applyActiveSettingToPending(req, res) {
    try {
        const result = await roSettingService.applyActiveSettingToPending();

        emitRoSettingUpdate(req, {
            source: 'ro_setting',
            action: 'apply_active_to_pending',
            data: result,
        });

        await writeRoSettingAudit(
            req,
            'APPLY_ACTIVE_RO_SETTING_TO_PENDING',
            'Applied the active RO setting to pending RO records.',
            'ro_setting',
            result?.setting?.setting_id || null,
            result,
            {}
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('APPLY ACTIVE RO SETTING ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to apply active RO setting.',
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

        emitRoSettingUpdate(req, {
            source: 'ro_department',
            action: 'create',
            data: result,
        });

        await writeRoSettingAudit(
            req,
            'CREATE_RO_DEPARTMENT',
            'Created RO department.',
            'ro_department',
            result?.department?.department_id || null,
            result,
            req.body || {}
        );

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

        emitRoSettingUpdate(req, {
            source: 'ro_department',
            action: 'update',
            department_id: req.params.departmentId,
            data: result,
        });

        await writeRoSettingAudit(
            req,
            'UPDATE_RO_DEPARTMENT',
            'Updated RO department.',
            'ro_department',
            req.params.departmentId,
            result,
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

        emitRoSettingUpdate(req, {
            source: 'ro_department',
            action: 'toggle',
            department_id: req.params.departmentId,
            data: result,
        });

        await writeRoSettingAudit(
            req,
            'TOGGLE_RO_DEPARTMENT',
            'Toggled RO department active state.',
            'ro_department',
            req.params.departmentId,
            result,
            {}
        );

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
    applyActiveSettingToPending,
    getDepartments,
    createDepartment,
    updateDepartment,
    toggleDepartment,
};