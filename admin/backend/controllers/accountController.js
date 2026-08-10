const accountService = require('../services/accountService');
const auditLogService = require('../services/auditLogService');
const notificationService = require('../services/notificationService');
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

        if (
            ['profile_update', 'profile_photo_update', 'profile_photo_remove'].includes(action) &&
            account?.user_id &&
            socketEvents?.profileUpdated
        ) {
            socketEvents.profileUpdated(io, account.user_id, {
                user_id: account.user_id,
                action,
                profile: account,
                profile_photo_url: account.profile_photo_url || null,
                avatar_url: account.avatar_url || null,
            });
        }

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

function emitCreatedNotifications(req, notifications = []) {
    const io = req.app.get('io');

    notifications.forEach((notification) => {
        const targetUserId =
            notification.target_user_id || notification.user_id || null;

        if (targetUserId) {
            socketEvents.notificationCreated(io, targetUserId, notification);
        }
    });
}

async function notifyOwnAccountActivity(
    req,
    profile,
    {
        title,
        message,
        adminTitle,
        adminMessage,
        referenceType = 'staff_profile',
    }
) {
    const actorUserId = getActorUserId(req);
    if (!actorUserId) return;

    try {
        const ownNotification = await notificationService.createUserNotification({
            userId: actorUserId,
            type: 'Account Activity',
            title,
            message,
            referenceId: profile?.user_id || actorUserId,
            referenceType,
        });

        const adminNotifications =
            await notificationService.createStaffNotifications({
                roles: ['admin'],
                type: 'Staff Account',
                title: adminTitle,
                message: adminMessage,
                referenceId: profile?.user_id || actorUserId,
                referenceType: 'staff_account',
                excludeUserIds: [actorUserId],
            });

        emitCreatedNotifications(req, [
            {
                ...ownNotification,
                target_user_id: actorUserId,
            },
            ...adminNotifications,
        ]);
    } catch (error) {
        console.error('STAFF PROFILE NOTIFICATION ERROR:', error.message || error);
    }
}

async function notifyAdminManagedAccountChange(req, account, actionLabel) {
    const actorUserId = getActorUserId(req);
    const targetUserId = account?.user_id;

    if (!targetUserId || String(targetUserId) === String(actorUserId)) return;

    try {
        const notification = await notificationService.createUserNotification({
            userId: targetUserId,
            type: 'Account Activity',
            title: `Account ${actionLabel}`,
            message: `A system administrator ${actionLabel.toLowerCase()} your staff account.`,
            referenceId: targetUserId,
            referenceType: 'staff_account',
        });

        emitCreatedNotifications(req, [
            {
                ...notification,
                target_user_id: targetUserId,
            },
        ]);
    } catch (error) {
        console.error('MANAGED ACCOUNT NOTIFICATION ERROR:', error.message || error);
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
        await notifyAdminManagedAccountChange(req, account, 'Created');

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
        await notifyAdminManagedAccountChange(req, account, 'Updated');

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
        await notifyAdminManagedAccountChange(req, account, 'Archived');

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
        await notifyAdminManagedAccountChange(req, account, 'Restored');

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
        await notifyOwnAccountActivity(req, profile, {
            title: 'Profile updated',
            message: 'Your staff profile information was updated successfully.',
            adminTitle: 'Staff profile updated',
            adminMessage: `${profile?.name || profile?.email || 'A staff member'} updated their profile information.`,
        });

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


exports.verifyCurrentStaffPassword = async (req, res) => {
    try {
        await accountService.verifyCurrentStaffPassword(getActorUserId(req), req.body || {});
        return res.status(200).json({ success: true, verified: true, message: 'Current password verified.' });
    } catch (err) {
        console.error('VERIFY CURRENT STAFF PASSWORD ERROR:', err);
        return sendError(res, err, 'Failed to verify current password');
    }
};


exports.changeCurrentStaffPassword = async (req, res) => {
    try {
        await accountService.changeCurrentStaffPassword(getActorUserId(req), req.body || {});

        const actorUserId = getActorUserId(req);
        if (actorUserId) {
            try {
                const notification = await notificationService.createUserNotification({
                    userId: actorUserId,
                    type: 'Security',
                    title: 'Password changed',
                    message: 'Your staff account password was changed successfully.',
                    referenceId: actorUserId,
                    referenceType: 'staff_profile',
                });
                emitCreatedNotifications(req, [{ ...notification, target_user_id: actorUserId }]);
            } catch (notificationError) {
                console.error('PASSWORD CHANGE NOTIFICATION ERROR:', notificationError.message || notificationError);
            }
        }

        return res.status(200).json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        console.error('CHANGE CURRENT STAFF PASSWORD ERROR:', err);
        return sendError(res, err, 'Failed to change password');
    }
};

exports.uploadCurrentStaffProfilePhoto = async (req, res) => {
    try {
        const profile = await accountService.uploadCurrentStaffProfilePhoto(
            getActorUserId(req),
            req.file
        );

        emitAccountUpdate(req, 'profile_photo_update', profile);
        await notifyOwnAccountActivity(req, profile, {
            title: 'Profile photo updated',
            message: 'Your staff profile photo was changed successfully.',
            adminTitle: 'Staff profile photo updated',
            adminMessage: `${profile?.name || profile?.email || 'A staff member'} changed their profile photo.`,
            referenceType: 'staff_profile',
        });

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
        await notifyOwnAccountActivity(req, profile, {
            title: 'Profile photo removed',
            message: 'Your staff profile photo was removed successfully.',
            adminTitle: 'Staff profile photo removed',
            adminMessage: `${profile?.name || profile?.email || 'A staff member'} removed their profile photo.`,
            referenceType: 'staff_profile',
        });

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
