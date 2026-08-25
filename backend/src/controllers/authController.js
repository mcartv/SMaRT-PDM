const authService = require('../services/authService');
const passwordResetService = require('../services/passwordResetService');
const { getSafeStatusCode } = require('../utils/httpStatus');

async function checkStudentId(req, res) {
    try {
        const result = await authService.checkStudentId(req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('CHECK STUDENT ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
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
        return res.status(getSafeStatusCode(error)).json({
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
        return res.status(getSafeStatusCode(error)).json({
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
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to login',
        });
    }
}

async function forgotPassword(req, res) {
    try {
        const result = await passwordResetService.forgotPassword(req.body || {}, req);
        return res.status(200).json(result);
    } catch (error) {
        console.error('FORGOT PASSWORD ERROR:', error.message);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to process password reset request',
        });
    }
}

async function verifyResetOtp(req, res) {
    try {
        const result = await passwordResetService.verifyResetOtp(req.body || {}, req);
        return res.status(200).json(result);
    } catch (error) {
        console.error('VERIFY RESET OTP ERROR:', error.message);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to verify reset code',
        });
    }
}

async function resetPassword(req, res) {
    try {
        const result = await passwordResetService.resetPassword(req.body || {}, req);
        return res.status(200).json(result);
    } catch (error) {
        console.error('RESET PASSWORD ERROR:', error.message);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to reset password',
        });
    }
}

module.exports = {
    checkStudentId,
    register,
    verifyOtp,
    login,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
};
