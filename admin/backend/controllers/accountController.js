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

function disconnectAccountSockets(
    req,
    userId,
    {
        reason = 'account-session-invalidated',
        code = 'SESSION_REVOKED',
        message = 'Your session is no longer active. Please sign in again.',
    } = {}
) {
    const normalizedUserId = String(userId || '').trim();
    const io = req.app?.get?.('io');

    if (!io || !normalizedUserId) return;

    const room = `user:${normalizedUserId}`;
    console.log(`[Socket] Disconnecting active sessions for user ${normalizedUserId}: ${reason}`);

    // Deliver the invalidation reason before tearing down the transport. A
    // previous fire-and-disconnect flow could race on fast local connections:
    // the socket was closed before the browser processed the logout event.
    // Socket.IO acknowledgements let the browser confirm receipt; the timeout
    // remains a hard fallback so revoked sessions are never kept connected.
    const payload = {
        code,
        message,
        reason,
        user_id: normalizedUserId,
        invalidated_at: new Date().toISOString(),
    };

    let disconnected = false;
    const hardDisconnect = () => {
        if (disconnected) return;
        disconnected = true;
        io.in(room).disconnectSockets(true);
    };

    io.to(room)
        .timeout(1500)
        .emit('session:invalidated', payload, () => {
            hardDisconnect();
        });

    // Defensive fallback in case an adapter/client never resolves the
    // acknowledgement callback.
    setTimeout(hardDisconnect, 1750);
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

function normalizeProfileValue(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function getProfileDisplayName(profile = {}) {
    const name = [
        normalizeProfileValue(profile.first_name),
        normalizeProfileValue(profile.last_name),
    ]
        .filter(Boolean)
        .join(' ')
        .trim();

    return name || normalizeProfileValue(profile.email) || 'A user';
}

function formatProfileFieldList(labels = []) {
    if (labels.length <= 1) return labels[0] || 'profile information';
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function buildProfileChangeMessages(beforeProfile = {}, afterProfile = {}) {
    const actorName = getProfileDisplayName(beforeProfile);

    const fieldDefinitions = [
        ['first_name', 'first name'],
        ['last_name', 'last name'],
        ['email', 'email address'],
        ['phone_number', 'phone number'],
        ['position', 'position'],
    ];

    const changed = fieldDefinitions.filter(([field]) =>
        normalizeProfileValue(beforeProfile[field]) !==
        normalizeProfileValue(afterProfile[field])
    );

    if (changed.length === 0) {
        return {
            adminMessage: `${actorName} updated their profile information.`,
        };
    }

    const changedKeys = changed.map(([field]) => field);
    const changedLabels = changed.map(([, label]) => label);
    const onlyNameChanged =
        changed.length === 2 &&
        changedKeys.includes('first_name') &&
        changedKeys.includes('last_name');

    let adminMessage;

    if (onlyNameChanged) {
        adminMessage =
            `${actorName} updated their name to "${getProfileDisplayName(afterProfile)}".`;
    } else if (changed.length === 1) {
        const [field, label] = changed[0];

        if (field === 'email') {
            adminMessage = `${actorName} updated their email address.`;
        } else if (field === 'phone_number') {
            adminMessage = `${actorName} updated their phone number.`;
        } else {
            const nextValue = normalizeProfileValue(afterProfile[field]) || 'Not specified';
            adminMessage = `${actorName} updated their ${label} to "${nextValue}".`;
        }
    } else {
        adminMessage =
            `${actorName} updated their ${formatProfileFieldList(changedLabels)}.`;
    }

    return {
        adminMessage,
    };
}

async function notifyOwnAccountActivity(
    req,
    profile,
    {
        adminTitle,
        adminMessage,
    }
) {
    const actorUserId = getActorUserId(req);
    if (!actorUserId) return;

    try {
        // Self-service profile changes use immediate UI success feedback instead
        // of adding a redundant notification to the user's notification bell.
        // Admin is still notified so account identity/profile changes remain visible.
        const adminNotifications =
            await notificationService.createStaffNotifications({
                roles: ['admin'],
                type: 'Account Activity',
                title: adminTitle,
                message: adminMessage,
                referenceId: profile?.user_id || actorUserId,
                referenceType: 'staff_account',
                excludeUserIds: [actorUserId],
            });

        emitCreatedNotifications(req, adminNotifications);
    } catch (error) {
        console.error('STAFF PROFILE NOTIFICATION ERROR:', error.message || error);
    }
}

async function notifyAdminManagedAccountChange(req, account, actionLabel) {
    const actorUserId = getActorUserId(req);
    const targetUserId = account?.user_id;

    if (!targetUserId) return;

    try {
        const notifications = [];

        if (String(targetUserId) !== String(actorUserId)) {
            const targetNotification = await notificationService.createUserNotification({
                userId: targetUserId,
                type: 'Account Activity',
                title: `Account ${actionLabel}`,
                message: `An administrator ${actionLabel.toLowerCase()} your account.`,
                referenceId: targetUserId,
                referenceType: 'staff_account',
            });

            notifications.push({
                ...targetNotification,
                target_user_id: targetUserId,
            });
        }

        emitCreatedNotifications(req, notifications);
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
        return sendError(res, err, 'Failed to load accounts');
    }
};

exports.createStaffAccount = async (req, res) => {
    try {
        const account = await accountService.createStaffAccount(req.body, getActorUserId(req));

        await auditLogService.logAudit({
            req,
            actionTaken: 'CREATE_ACCOUNT',
            module: 'Accounts',
            entityType: 'staff_account',
            entityId: account?.user_id || null,
            description: `Created account for ${account?.email || 'unknown email'}.`,
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
            message: 'Account created successfully.',
        });
    } catch (err) {
        console.error('CREATE STAFF ACCOUNT ERROR:', err);
        return sendError(res, err, 'Failed to create account');
    }
};

exports.createAdminAccount = async (req, res) => {
    try {
        const account = await accountService.createAdminAccount(req.body, getActorUserId(req));

        await auditLogService.logAudit({
            req,
            actionTaken: 'CREATE_ACCOUNT',
            module: 'Accounts',
            entityType: 'staff_account',
            entityId: account?.user_id || null,
            description: `Created Admin account for ${account?.email || 'unknown email'}.`,
            metadata: {
                user_id: account?.user_id || null,
                email: account?.email || null,
                role: 'admin',
                department: account?.department || null,
                position: account?.position || null,
            },
        }).catch((auditError) => {
            console.error('CREATE ADMIN ACCOUNT AUDIT ERROR:', auditError.message);
        });

        emitAccountUpdate(req, 'create_admin', account);
        await notifyAdminManagedAccountChange(req, account, 'Created');

        return res.status(201).json({
            success: true,
            data: account,
            message: 'Admin account created successfully.',
        });
    } catch (err) {
        console.error('CREATE ADMIN ACCOUNT ERROR:', err);
        return sendError(res, err, 'Failed to create Admin account');
    }
};

exports.updateStaffAccount = async (req, res) => {
    try {
        const actorUserId = getActorUserId(req);
        const passwordResetRequested = Boolean(String(req.body?.password || '').trim());
        const isSelfUpdate = Boolean(
            actorUserId && String(actorUserId) === String(req.params.id)
        );
        const account = await accountService.updateStaffAccount(req.params.id, req.body, actorUserId);

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found.',
                error: {
                    message: 'Account not found.',
                },
            });
        }

        await auditLogService.logAudit({
            req,
            actionTaken: 'UPDATE_ACCOUNT',
            module: 'Accounts',
            entityType: 'staff_account',
            entityId: account.user_id || req.params.id,
            description: `Updated account: ${account.email || req.params.id}.`,
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

        if (passwordResetRequested) {
            if (isSelfUpdate) {
                await auditLogService.logAudit({
                    req,
                    actionTaken: 'CHANGE_OWN_PASSWORD',
                    module: 'Accounts',
                    entityType: 'staff_account',
                    entityId: account.user_id || req.params.id,
                    description: 'Changed own account password. Current session retained. Password values are not stored in System Logs.',
                    metadata: {
                        target_user_id: account.user_id || req.params.id,
                        target_email: account.email || null,
                        target_role: account.role || null,
                        password_changed: true,
                        credential_values_stored: false,
                        self_change: true,
                        session_invalidated: account.session_invalidated === true,
                    },
                    allowMultipleForRequest: true,
                }).catch((auditError) => {
                    console.error('OWN PASSWORD CHANGE AUDIT ERROR:', auditError.message);
                });
            } else {
                await auditLogService.logAudit({
                    req,
                    actionTaken: 'RESET_ACCOUNT_PASSWORD',
                    module: 'Accounts',
                    entityType: 'staff_account',
                    entityId: account.user_id || req.params.id,
                    description: `Reset password for account: ${account.email || req.params.id}. Target sessions were invalidated.`,
                    metadata: {
                        target_user_id: account.user_id || req.params.id,
                        target_email: account.email || null,
                        target_role: account.role || null,
                        password_changed: true,
                        credential_values_stored: false,
                        self_change: false,
                        session_invalidated: account.session_invalidated === true,
                    },
                    // Account edits and password resets are separate security events.
                    // Keep both while still suppressing the generic mutation fallback.
                    allowMultipleForRequest: true,
                }).catch((auditError) => {
                    console.error('ACCOUNT PASSWORD RESET AUDIT ERROR:', auditError.message);
                });
            }
        }

        emitAccountUpdate(req, 'update', account);
        await notifyAdminManagedAccountChange(req, account, 'Updated');

        if (account.session_invalidated === true) {
            disconnectAccountSockets(req, account.user_id, {
                reason: passwordResetRequested
                    ? 'admin-password-reset'
                    : 'account-role-or-status-updated',
                code: passwordResetRequested
                    ? 'PASSWORD_CHANGED'
                    : account.is_archived
                        ? 'ACCOUNT_DEACTIVATED'
                        : 'SESSION_REVOKED',
                message: passwordResetRequested
                    ? 'Your password was reset by an administrator. Please sign in again using your new password.'
                    : account.is_archived
                        ? 'This account has been deactivated. Contact an administrator.'
                        : 'Your account access has changed. Please sign in again.',
            });
        }

        return res.status(200).json({
            success: true,
            data: account,
            message: 'Account updated successfully.',
        });
    } catch (err) {
        console.error('UPDATE STAFF ACCOUNT ERROR:', err);
        return sendError(res, err, 'Failed to update account');
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
                message: 'Account not found.',
                error: {
                    message: 'Account not found.',
                },
            });
        }

        await auditLogService.logAudit({
            req,
            actionTaken: 'ARCHIVE_ACCOUNT',
            module: 'Accounts',
            entityType: 'staff_account',
            entityId: account.user_id || req.params.id,
            description: `Archived account: ${account.email || req.params.id}.`,
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
        disconnectAccountSockets(req, account.user_id, {
            reason: 'account-archived',
            code: 'ACCOUNT_DEACTIVATED',
            message: 'This account has been deactivated. Contact an administrator.',
        });

        return res.status(200).json({
            success: true,
            data: account,
            message: 'Account archived successfully.',
        });
    } catch (err) {
        console.error('ARCHIVE STAFF ACCOUNT ERROR:', err);
        return sendError(res, err, 'Failed to archive account');
    }
};

exports.restoreStaffAccount = async (req, res) => {
    try {
        const account = await accountService.restoreStaffAccount(req.params.id);

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found.',
                error: {
                    message: 'Account not found.',
                },
            });
        }

        await auditLogService.logAudit({
            req,
            actionTaken: 'RESTORE_ACCOUNT',
            module: 'Accounts',
            entityType: 'staff_account',
            entityId: account.user_id || req.params.id,
            description: `Restored account: ${account.email || req.params.id}.`,
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
        disconnectAccountSockets(req, account.user_id, {
            reason: 'account-restored-login-required',
            code: 'SESSION_REVOKED',
            message: 'This account was restored. Please sign in again with a fresh session.',
        });

        return res.status(200).json({
            success: true,
            data: account,
            message: 'Account restored successfully.',
        });
    } catch (err) {
        console.error('RESTORE STAFF ACCOUNT ERROR:', err);
        return sendError(res, err, 'Failed to restore account');
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
        return sendError(res, err, 'Failed to load current account profile');
    }
};

exports.updateCurrentStaffProfile = async (req, res) => {
    try {
        const actorUserId = getActorUserId(req);
        const previousProfile = await accountService.getCurrentStaffProfile(actorUserId);
        const profile = await accountService.updateCurrentStaffProfile(
            actorUserId,
            req.body
        );
        const changeMessages = buildProfileChangeMessages(previousProfile, profile);

        emitAccountUpdate(req, 'profile_update', profile);
        await notifyOwnAccountActivity(req, profile, {
            adminTitle: 'Profile Updated',
            adminMessage: changeMessages.adminMessage,
        });

        return res.status(200).json({
            success: true,
            data: profile,
            message: 'Profile updated successfully.',
        });
    } catch (err) {
        console.error('UPDATE CURRENT STAFF PROFILE ERROR:', err);
        return sendError(res, err, 'Failed to update current account profile');
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
        const actorUserId = getActorUserId(req);
        await accountService.changeCurrentStaffPassword(
            actorUserId,
            req.body || {}
        );

        if (actorUserId) {
            await auditLogService.logAudit({
                req,
                actionTaken: 'CHANGE_OWN_PASSWORD',
                module: 'Accounts',
                entityType: 'staff_account',
                entityId: actorUserId,
                description: 'Changed account password. Current password: verified. New password: updated. Password values are not stored in System Logs.',
                metadata: {
                    password_changed: true,
                    current_password_verified: true,
                    new_password_updated: true,
                    credential_values_stored: false,
                },
            }).catch((auditError) => {
                console.error('CHANGE OWN PASSWORD AUDIT ERROR:', auditError.message);
            });

            try {
                const notification = await notificationService.createUserNotification({
                    userId: actorUserId,
                    type: 'Security',
                    title: 'Password Changed',
                    message: 'Your account password was changed successfully.',
                    referenceId: actorUserId,
                    referenceType: 'staff_profile',
                });
                emitCreatedNotifications(req, [{ ...notification, target_user_id: actorUserId }]);
            } catch (notificationError) {
                console.error('PASSWORD CHANGE NOTIFICATION ERROR:', notificationError.message || notificationError);
            }

        }

        return res.status(200).json({
            success: true,
            session_invalidated: false,
            message: 'Password changed successfully.',
        });
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
            adminTitle: 'Profile Photo Updated',
            adminMessage: `${getProfileDisplayName(profile)} updated their profile photo.`,
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
            adminTitle: 'Profile Photo Removed',
            adminMessage: `${getProfileDisplayName(profile)} removed their profile photo.`,
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
