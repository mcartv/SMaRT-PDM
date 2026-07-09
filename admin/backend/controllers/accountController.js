const accountService = require('../services/accountService');
const socketEvents = require('../utils/socketEvents');

exports.getStaffAccounts = async (req, res) => {
    try {
        const accounts = await accountService.listStaffAccounts();
        res.status(200).json({
            success: true,
            data: accounts,
        });
    } catch (err) {
        console.error('GET STAFF ACCOUNTS ERROR:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            error: {
                message: err.message || 'Failed to load staff accounts',
            },
        });
    }
};

exports.getCurrentStaffProfile = async (req, res) => {
    try {
        const profile = await accountService.getCurrentStaffProfile(
            req.user?.user_id || req.user?.userId || null
        );

        res.status(200).json({
            success: true,
            data: profile,
        });
    } catch (err) {
        console.error('GET CURRENT STAFF PROFILE ERROR:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            error: {
                message: err.message || 'Failed to load current staff profile',
            },
        });
    }
};

exports.createStaffAccount = async (req, res) => {
    try {
        const account = await accountService.createStaffAccount(req.body);
        const io = req.app.get('io');
        socketEvents.maintenanceUpdated(io, {
            entity: 'staff_account',
            action: 'created',
            account,
        });
        res.status(201).json({
            success: true,
            data: account,
            message: 'Staff account created successfully.',
        });
    } catch (err) {
        console.error('CREATE STAFF ACCOUNT ERROR:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            error: {
                message: err.message || 'Failed to create staff account',
            },
        });
    }
};

exports.updateCurrentStaffProfile = async (req, res) => {
    try {
        const profile = await accountService.updateCurrentStaffProfile(
            req.user?.user_id || req.user?.userId || null,
            req.body
        );
        const io = req.app.get('io');
        socketEvents.maintenanceUpdated(io, {
            entity: 'staff_profile',
            action: 'updated',
            profile,
        });

        res.status(200).json({
            success: true,
            data: profile,
            message: 'Profile updated successfully.',
        });
    } catch (err) {
        console.error('UPDATE CURRENT STAFF PROFILE ERROR:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            error: {
                message: err.message || 'Failed to update current staff profile',
            },
        });
    }
};

exports.uploadCurrentStaffProfilePhoto = async (req, res) => {
    try {
        const profile = await accountService.uploadCurrentStaffProfilePhoto(
            req.user?.user_id || req.user?.userId || null,
            req.file
        );
        const io = req.app.get('io');
        socketEvents.maintenanceUpdated(io, {
            entity: 'staff_profile_photo',
            action: 'updated',
            profile,
        });

        res.status(200).json({
            success: true,
            data: profile,
            message: 'Profile photo updated successfully.',
        });
    } catch (err) {
        console.error('UPLOAD CURRENT STAFF PROFILE PHOTO ERROR:', err);
        res.status(err.statusCode || 500).json({
            success: false,
            error: {
                message: err.message || 'Failed to update profile photo',
            },
        });
    }
};
