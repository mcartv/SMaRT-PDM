const accountService = require('../services/accountService');

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

exports.createStaffAccount = async (req, res) => {
    try {
        const account = await accountService.createStaffAccount(req.body);
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
