// SMaRT-PDM: Authentication — socket Auth (admin backend); supports backend application behavior.
const jwt = require('jsonwebtoken');
const adminSessionService = require('../services/adminSessionService');
const staffSessionService = require('../services/staffSessionService');

// stripBearerToken: handles strip bearer token for the Authentication flow.
function stripBearerToken(value) {
    return String(value || '').replace(/^Bearer\s+/i, '').trim();
}

// extractSocketToken: handles extract socket token for the Authentication flow.
function extractSocketToken(socket) {
    const auth = socket?.handshake?.auth || {};
    const query = socket?.handshake?.query || {};
    const headers = socket?.handshake?.headers || {};

    return stripBearerToken(
        auth.token ||
        query.token ||
        headers.authorization ||
        headers.Authorization ||
        ''
    );
}

// requireJwtSecret: handles require jwt secret for the Authentication flow.
function requireJwtSecret() {
    const secret = String(process.env.JWT_SECRET || '').trim();

    if (!secret) {
        throw new Error('JWT_SECRET is required');
    }

    return secret;
}

// socketAuthError: handles socket auth error for the Authentication flow.
function socketAuthError(message, code = 'SOCKET_AUTH_FAILED', statusCode = 401) {
    const error = new Error(message);
    error.data = {
        code,
        status: statusCode,
    };
    return error;
}

// authenticateStaffSocket: handles authenticate staff socket for the Authentication flow.
async function authenticateStaffSocket(socket) {
    const rawToken = extractSocketToken(socket);

    if (!rawToken) {
        throw socketAuthError(
            'Authentication is required for realtime access.',
            'SOCKET_AUTH_REQUIRED',
            401
        );
    }

    let decoded;

    try {
        decoded = jwt.verify(rawToken, requireJwtSecret());
    } catch (error) {
        throw socketAuthError(
            'Realtime session has expired or is invalid.',
            'SOCKET_AUTH_INVALID',
            401
        );
    }

    let account;

    try {
        account = await staffSessionService.assertCurrentStaffSession({ decoded });

        if (staffSessionService.normalizeRole(decoded.role) === 'admin') {
            if (!decoded.sid) {
                throw new adminSessionService.AdminSessionError(
                    'Admin session must be renewed. Please sign in again.',
                    {
                        statusCode: 401,
                        code: 'ADMIN_SESSION_MIGRATION_REQUIRED',
                    }
                );
            }

            await adminSessionService.assertActiveAdminSession({
                decoded,
                rawToken,
            });
        }
    } catch (error) {
        const statusCode = Number(error?.statusCode || 401) || 401;
        const code = String(error?.code || 'SOCKET_AUTH_FAILED');
        throw socketAuthError(
            error?.message || 'Realtime authentication failed.',
            code,
            statusCode
        );
    }

    socket.data = socket.data || {};
    socket.data.authenticated = true;
    socket.data.userId = account.user_id;
    socket.data.role = account.role;
    socket.data.tokenVersion = account.token_version;

    return {
        decoded,
        account,
        rawToken,
    };
}

// createStaffSocketAuthMiddleware: creates create staff socket auth middleware for the Authentication flow.
function createStaffSocketAuthMiddleware() {
    return async (socket, next) => {
        try {
            await authenticateStaffSocket(socket);
            next();
        } catch (error) {
            next(error?.data ? error : socketAuthError('Realtime authentication failed.'));
        }
    };
}

module.exports = {
    authenticateStaffSocket,
    createStaffSocketAuthMiddleware,
    extractSocketToken,
    stripBearerToken,
};
