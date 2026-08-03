const authService = require('../services/authService');
const passwordResetService = require('../services/passwordResetService');
const { getSafeStatusCode } = require('../utils/httpStatus');
const { AUTH_COOKIE_NAME, normalizeRole } = require('../middleware/authMiddleware');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function authCookieOptions({ persistent = false } = {}) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        ...(persistent ? { maxAge: THIRTY_DAYS_MS } : {}),
    };
}

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
        res.cookie(
            AUTH_COOKIE_NAME,
            result.token,
            authCookieOptions({ persistent: Boolean(req.body?.stayLoggedIn) })
        );
        return res.status(200).json(result);
    } catch (error) {
        console.error('LOGIN ROUTE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to login',
        });
    }
}

function loginForRole(expectedRole) {
    return async (req, res) => {
        try {
            const result = await authService.login(req.body || {});
            if (normalizeRole(result.user?.role) !== expectedRole) {
                return res.status(403).json({ error: 'This account cannot access this portal.' });
            }
            res.cookie(AUTH_COOKIE_NAME, result.token, authCookieOptions());
            return res.status(200).json(result);
        } catch (error) {
            console.error('STAFF LOGIN ERROR:', error.message);
            return res.status(getSafeStatusCode(error)).json({
                error: error.message || 'Failed to login',
            });
        }
    };
}

async function logout(_req, res) {
    res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
    return res.status(200).json({ message: 'Signed out successfully.' });
}

async function session(req, res) {
    return res.status(200).json({ authenticated: true, user: req.user });
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
    logout,
    session,
    loginForRole,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
};
