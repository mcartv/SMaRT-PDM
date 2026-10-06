// SMaRT-PDM: Authentication — auth Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const authService = require('../services/authService');
const passwordResetService = require('../services/passwordResetService');
const emailChangeService = require('../services/emailChangeService');
const { getSafeStatusCode } = require('../utils/httpStatus');

// checkStudentId: checks check student id for the Authentication flow.
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

// register: handles register for the Authentication flow.
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

// verifyOtp: verifies verify otp for the Authentication flow.
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

// resendOtp: handles resend otp for the Authentication flow.
async function resendOtp(req, res) {
    try {
        const result = await authService.resendOtp(req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('RESEND OTP ROUTE ERROR:', error.message);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to resend verification code',
        });
    }
}

// cancelRegistration: checks whether cancel registration for the Authentication flow.
async function cancelRegistration(req, res) {
    try {
        const result = await authService.cancelRegistration(req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('CANCEL REGISTRATION ROUTE ERROR:', error.message);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to cancel registration',
        });
    }
}

// login: handles login for the Authentication flow.
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

// forgotPassword: handles forgot password for the Authentication flow.
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

// verifyResetOtp: verifies verify reset otp for the Authentication flow.
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

// resetPassword: resets reset password for the Authentication flow.
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

// requestEmailChange: handles request email change for the Authentication flow.
async function requestEmailChange(req, res) {
    try {
        const userId = req.user?.user_id || req.user?.userId || req.user?.sub;
        const result = await emailChangeService.requestEmailChange(userId, req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('REQUEST EMAIL CHANGE ERROR:', error.message);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to request email change',
        });
    }
}

// verifyEmailChange: verifies verify email change for the Authentication flow.
async function verifyEmailChange(req, res) {
    try {
        const userId = req.user?.user_id || req.user?.userId || req.user?.sub;
        const result = await emailChangeService.verifyEmailChange(userId, req.body || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('VERIFY EMAIL CHANGE ERROR:', error.message);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to verify email change',
        });
    }
}

module.exports = {
    checkStudentId,
    register,
    verifyOtp,
    resendOtp,
    cancelRegistration,
    login,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    requestEmailChange,
    verifyEmailChange,
};
