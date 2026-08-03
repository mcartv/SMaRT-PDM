const jwt = require('jsonwebtoken');
const adminSessionService = require('../services/adminSessionService');
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'smartpdm_session';

function getCookieToken(req) {
    const cookieHeader = String(req.headers.cookie || '');
    for (const part of cookieHeader.split(';')) {
        const separator = part.indexOf('=');
        if (separator < 1) continue;
        const name = decodeURIComponent(part.slice(0, separator).trim());
        if (name === AUTH_COOKIE_NAME) {
            return decodeURIComponent(part.slice(separator + 1).trim());
        }
    }
    return null;
}

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;
    const token = bearerToken || getCookieToken(req);

    if (!token) {
        return res.status(401).json({
            message: 'No token, authorization denied',
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const normalizedRole = String(decoded.role || '').trim().toLowerCase();

        req.user = {
            ...decoded,
            userId: decoded.userId || decoded.user_id || decoded.sub || null,
            user_id: decoded.user_id || decoded.userId || decoded.sub || null,
            role: normalizedRole || null,
        };
        req.authToken = token;

        if (normalizedRole === 'admin') {
            if (!decoded.sid) {
                return res.status(401).json({
                    code: 'ADMIN_SESSION_MIGRATION_REQUIRED',
                    message: 'Admin session must be renewed. Please sign in again.',
                });
            }

            req.adminSession = await adminSessionService.assertActiveAdminSession({
                decoded: req.user,
                rawToken: token,
            });
        }

        return next();
    } catch (err) {
        console.error('JWT/SESSION VERIFY ERROR:', err.message);

        if (err instanceof adminSessionService.AdminSessionError) {
            return res.status(err.statusCode).json({
                code: err.code,
                message: err.message,
            });
        }

        return res.status(401).json({
            message: 'Token is not valid',
        });
    }
};

const authorizeRoles = (...roles) => (req, res, next) => {
    const userRole = String(req.user?.role || '').trim().toLowerCase();

    const allowedRoles = roles.map((role) =>
        String(role || '').trim().toLowerCase()
    );

    if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
            message: 'Access denied for this account',
        });
    }

    next();
};

module.exports = { protect, authorizeRoles, AUTH_COOKIE_NAME };
