const accountService = require('../services/accountService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || null;
}

function sendError(res, err, fallbackMessage) {
    const message = err?.message || fallbackMessage || 'Unknown backend error';

    return res.status(err.statusCode || 500).json({
        success: false,
        message,
        error: {
            message,
        },
    });
}

function emitAccountUpdate(req, action, account = null) {
    const io = req.app.get('io');

    const payload = {
        module: 'accounts',
        entity: 'staff_account',
        action,
        id: account?.user_id || null,
        account,
        updated_at: new Date().toISOString(),
    };

    if (socketEvents?.maintenanceUpdated) {
        socketEvents.maintenanceUpdated(io, payload);
        socketEvents.endorsementUpdated(io, {
            source: 'pd_course_assignment',
            action,
            pd_user_id: account?.role === 'pd' ? account.user_id : null,
        });
        socketEvents.dashboardUpdated(io, { source: 'pd_course_assignment', action });
        socketEvents.reportUpdated(io, { source: 'pd_course_assignment', action });
        return;
    }

    if (io) {
        io.emit('maintenance:updated', payload);
    }
}

exports.getStaffAccounts = async (req, res) => {
    try {
        const accounts = await accountService.listStaffAccounts();

        return res.status(200).json({
            success: true,
            data: accounts,
        });
    } catch (err) {
        console.error('GET STAFF ACCOUNTS ERROR:', err);
        return sendError(res, err, 'Failed to load staff accounts');
    }
};

exports.createStaffAccount = async (req, res) => {
    try {
        const account = await accountService.createStaffAccount(req.body, getActorUserId(req));

        await auditLogService.logAudit({
            req,
            actionTaken: 'CREATE_STAFF_ACCOUNT',
            module: 'Accounts',
            entityType: 'staff_account',
            entityId: account?.user_id || null,
            description: `Created staff account for ${account?.email || 'unknown email'}.`,
            metadata: {
                user_id: account?.user_id || null,
                email: account?.email || null,
                role: account?.role || null,
                department: account?.department || null,
                position: account?.position || null,
            },
        }).catch((auditError) => {
            console.error('CREATE STAFF ACCOUNT AUDIT ERROR:', auditError.message);
        });

        emitAccountUpdate(req, 'create', account);

        return res.status(201).json({
            success: true,
            data: account,
            message: 'Staff account created successfully.',
        });
    } catch (err) {
        console.error('CREATE STAFF ACCOUNT ERROR:', err);
        return sendError(res, err, 'Failed to create staff account');
    }
};

exports.updateStaffAccount = async (req, res) => {
    try {
        const account = await accountService.updateStaffAccount(req.params.id, req.body, getActorUserId(req));

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Staff account not found.',
                error: {
                    message: 'Staff account not found.',
                },
            });
        }

        await auditLogService.logAudit({
            req,
            actionTaken: 'UPDATE_STAFF_ACCOUNT',
            module: 'Accounts',
            entityType: 'staff_account',
            entityId: account.user_id || req.params.id,
            description: `Updated staff account: ${account.email || req.params.id}.`,
            metadata: {
                user_id: account.user_id || req.params.id,
                email: account.email || null,
                role: account.role || null,
                changes: {
                    ...req.body,
                    password: req.body?.password ? '[REDACTED]' : undefined,
                    confirm_password: req.body?.confirm_password ? '[REDACTED]' : undefined,
                },
            },
        }).catch((auditError) => {
            console.error('UPDATE STAFF ACCOUNT AUDIT ERROR:', auditError.message);
        });

        emitAccountUpdate(req, 'update', account);

        return res.status(200).json({
            success: true,
            data: account,
            message: 'Staff account updated successfully.',
        });
    } catch (err) {
        console.error('UPDATE STAFF ACCOUNT ERROR:', err);
        return sendError(res, err, 'Failed to update staff account');
    }
};

exports.archiveStaffAccount = async (req, res) => {
    try {
        const account = await accountService.archiveStaffAccount(
            req.params.id,
            getActorUserId(req)
        );

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Staff account not found.',
                error: {
                    message: 'Staff account not found.',
                },
            });
        }

        await auditLogService.logAudit({
            req,
            actionTaken: 'ARCHIVE_STAFF_ACCOUNT',
            module: 'Accounts',
            entityType: 'staff_account',
            entityId: account.user_id || req.params.id,
            description: `Archived staff account: ${account.email || req.params.id}.`,
            metadata: {
                user_id: account.user_id || req.params.id,
                email: account.email || null,
                role: account.role || null,
            },
        }).catch((auditError) => {
            console.error('ARCHIVE STAFF ACCOUNT AUDIT ERROR:', auditError.message);
        });

        emitAccountUpdate(req, 'archive', account);

        return res.status(200).json({
            success: true,
            data: account,
            message: 'Staff account archived successfully.',
        });
    } catch (err) {
        console.error('ARCHIVE STAFF ACCOUNT ERROR:', err);
        return sendError(res, err, 'Failed to archive staff account');
    }
};

exports.restoreStaffAccount = async (req, res) => {
    try {
        const account = await accountService.restoreStaffAccount(req.params.id);

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Staff account not found.',
                error: {
                    message: 'Staff account not found.',
                },
            });
        }

        await auditLogService.logAudit({
            req,
            actionTaken: 'RESTORE_STAFF_ACCOUNT',
            module: 'Accounts',
            entityType: 'staff_account',
            entityId: account.user_id || req.params.id,
            description: `Restored staff account: ${account.email || req.params.id}.`,
            metadata: {
                user_id: account.user_id || req.params.id,
                email: account.email || null,
                role: account.role || null,
            },
        }).catch((auditError) => {
            console.error('RESTORE STAFF ACCOUNT AUDIT ERROR:', auditError.message);
        });

        emitAccountUpdate(req, 'restore', account);

        return res.status(200).json({
            success: true,
            data: account,
            message: 'Staff account restored successfully.',
        });
    } catch (err) {
        console.error('RESTORE STAFF ACCOUNT ERROR:', err);
        return sendError(res, err, 'Failed to restore staff account');
    }
};

exports.getCurrentStaffProfile = async (req, res) => {
    try {
        const profile = await accountService.getCurrentStaffProfile(getActorUserId(req));

        return res.status(200).json({
            success: true,
            data: profile,
        });
    } catch (err) {
        console.error('GET CURRENT STAFF PROFILE ERROR:', err);
        return sendError(res, err, 'Failed to load current staff profile');
    }
};

exports.updateCurrentStaffProfile = async (req, res) => {
    try {
        const profile = await accountService.updateCurrentStaffProfile(
            getActorUserId(req),
            req.body
        );

        emitAccountUpdate(req, 'profile_update', profile);

        return res.status(200).json({
            success: true,
            data: profile,
            message: 'Profile updated successfully.',
        });
    } catch (err) {
        console.error('UPDATE CURRENT STAFF PROFILE ERROR:', err);
        return sendError(res, err, 'Failed to update current staff profile');
    }
};

exports.uploadCurrentStaffProfilePhoto = async (req, res) => {
    try {
        const profile = await accountService.uploadCurrentStaffProfilePhoto(
            getActorUserId(req),
            req.file
        );

        emitAccountUpdate(req, 'profile_photo_update', profile);

        return res.status(200).json({
            success: true,
            data: profile,
            message: 'Profile photo updated successfully.',
        });
    } catch (err) {
        console.error('UPLOAD CURRENT STAFF PROFILE PHOTO ERROR:', err);
        return sendError(res, err, 'Failed to update profile photo');
    }
};

exports.removeCurrentStaffProfilePhoto = async (req, res) => {
    try {
        const profile = await accountService.removeCurrentStaffProfilePhoto(
            getActorUserId(req)
        );

        emitAccountUpdate(req, 'profile_photo_remove', profile);

        return res.status(200).json({
            success: true,
            data: profile,
            message: 'Profile photo removed successfully.',
        });
    } catch (err) {
        console.error('REMOVE CURRENT STAFF PROFILE PHOTO ERROR:', err);
        return sendError(res, err, 'Failed to remove profile photo');
    }
};
