const authService = require('../services/authService');

async function checkStudentId(req, res) {
    try {
        const result = await authService.checkStudentId(req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('CHECK STUDENT ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to check student ID',
        });
    }
}

async function register(req, res) {
    try {
        const result = await authService.register(req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('REGISTER ROUTE ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to process registration',
        });
    }
}

async function verifyOtp(req, res) {
    try {
        const result = await authService.verifyOtp(req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('VERIFY OTP ROUTE ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to verify OTP',
        });
    }
}

async function login(req, res) {
    try {
        const result = await authService.login(req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('LOGIN ROUTE ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to login',
        });
    }
}

module.exports = {
    checkStudentId,
    register,
    verifyOtp,
    login,
};