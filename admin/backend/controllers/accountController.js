const accountService = require('../services/accountService');
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
        const account = await accountService.createStaffAccount(req.body);

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
        const account = await accountService.updateStaffAccount(req.params.id, req.body);

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Staff account not found.',
                error: {
                    message: 'Staff account not found.',
                },
            });
        }

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

exports.deleteStaffAccount = async (req, res) => {
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

        emitAccountUpdate(req, 'delete', account);

        return res.status(200).json({
            success: true,
            data: account,
            message: 'Staff account archived successfully.',
        });
    } catch (err) {
        console.error('DELETE STAFF ACCOUNT ERROR:', err);
        return sendError(res, err, 'Failed to delete staff account');
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