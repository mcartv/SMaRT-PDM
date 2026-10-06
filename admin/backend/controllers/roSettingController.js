// SMaRT-PDM: Return of Obligations — ro Setting Controller (admin backend controller); handles HTTP input/output and delegates business logic.
const roSettingService = require('../services/roSettingService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');
const studentRealtimeRelayService = require('../services/studentRealtimeRelayService');

// getActorUserId: reads and returns get actor user id for the Return of Obligations flow.
function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// getSafeStatusCode: reads and returns get safe status code for the Return of Obligations flow.
function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);

    return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
        ? parsed
        : 500;
}

// writeRoSettingAudit: handles write ro setting audit for the Return of Obligations flow.
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

// emitRoSettingUpdate: handles emit ro setting update for the Return of Obligations flow.
function emitRoSettingUpdate(req, payload = {}) {
    const updatedAt = new Date().toISOString();

    try {
        const io = req.app?.get?.('io');

        if (io) {
            const eventPayload = {
                updated_at: updatedAt,
                ...payload,
            };

            if (typeof socketEvents?.roUpdated === 'function') {
                socketEvents.roUpdated(io, eventPayload);
            } else if (typeof socketEvents?.emitEvent === 'function') {
                socketEvents.emitEvent(io, 'ro:updated', eventPayload);
                socketEvents.emitEvent(io, 'roUpdated', eventPayload);
            } else {
                io.emit('ro:updated', eventPayload);
                io.emit('roUpdated', eventPayload);
            }
        }
    } catch (error) {
        console.error('RO SETTINGS SOCKET ERROR:', error.message);
    }

    studentRealtimeRelayService
        .relayModuleEvent({
            event: 'ro:settings-updated',
            payload: {
                source: payload?.source || 'ro_setting',
                action: payload?.action || 'updated',
                setting_id:
                    payload?.setting_id ||
                    payload?.data?.setting?.setting_id ||
                    null,
                updated_at: updatedAt,
            },
        })
        .catch((error) => {
            console.error(
                'RO SETTINGS STUDENT REALTIME RELAY ERROR:',
                error.message
            );
        });
}

// getSettings: reads and returns get settings for the Return of Obligations flow.
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

// getActiveSetting: reads and returns get active setting for the Return of Obligations flow.
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

// createSetting: creates create setting for the Return of Obligations flow.
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

// updateSetting: updates update setting for the Return of Obligations flow.
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

// activateSetting: handles activate setting for the Return of Obligations flow.
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

// applyActiveSettingToPending: handles apply active setting to pending for the Return of Obligations flow.
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

// getDepartments: reads and returns get departments for the Return of Obligations flow.
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

// setDepartmentCoordinator: sets set department coordinator for the Return of Obligations flow.
async function setDepartmentCoordinator(req, res) {
    try {
        const result = await roSettingService.setDepartmentCoordinator(
            req.params.departmentId,
            req.body || {},
            getActorUserId(req)
        );

        emitRoSettingUpdate(req, {
            source: 'ro_area_coordinator',
            action: 'assign',
            department_id: req.params.departmentId,
            data: result,
        });

        await writeRoSettingAudit(
            req,
            'ASSIGN_RO_AREA_COORDINATOR',
            'Updated an RO Area personnel-in-charge assignment.',
            'ro_area',
            req.params.departmentId,
            result,
            req.body || {}
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('SET RO AREA COORDINATOR ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to update the RO Area personnel-in-charge.',
        });
    }
}

// createDepartment: creates create department for the Return of Obligations flow.
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

// updateDepartment: updates update department for the Return of Obligations flow.
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

// toggleDepartment: handles toggle department for the Return of Obligations flow.
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
    setDepartmentCoordinator,
    createDepartment,
    updateDepartment,
    toggleDepartment,
};
