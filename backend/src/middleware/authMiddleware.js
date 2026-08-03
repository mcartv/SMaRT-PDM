const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-pdm-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'smartpdm_session';

const ROLE_ALIASES = new Map([
    ['administrator', 'admin'],
    ['osfa administrator', 'admin'],
    ['osfa_admin', 'admin'],
    ['program director', 'pd'],
    ['program_director', 'pd'],
    ['ro coordinator', 'ro_coordinator'],
    ['ro-coordinator', 'ro_coordinator'],
    ['student disciplinary office', 'sdo'],
]);

function normalizeRole(role = '') {
    const normalized = String(role).trim().toLowerCase();
    return ROLE_ALIASES.get(normalized) || normalized;
}

function normalizeDecodedUser(decoded = {}) {
    const normalizedUserId = decoded.user_id || decoded.userId || decoded.sub || null;

    return {
        ...decoded,
        sub: decoded.sub || normalizedUserId || undefined,
        user_id: normalizedUserId,
        userId: normalizedUserId,
    };
}

function extractToken(value = '') {
    if (!value || typeof value !== 'string') return null;
    return value.startsWith('Bearer ') ? value.slice(7).trim() : value.trim();
}

function parseCookies(header = '') {
    return String(header)
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((cookies, part) => {
            const separator = part.indexOf('=');
            if (separator < 1) return cookies;
            const key = decodeURIComponent(part.slice(0, separator).trim());
            const value = decodeURIComponent(part.slice(separator + 1).trim());
            cookies[key] = value;
            return cookies;
        }, {});
}

function getRequestToken(req) {
    return (
        extractToken(req.headers.authorization) ||
        parseCookies(req.headers.cookie)[AUTH_COOKIE_NAME] ||
        null
    );
}

function buildAuthToken(user) {
    return jwt.sign(
        normalizeDecodedUser({
            sub: user.user_id,
            user_id: user.user_id,
            userId: user.user_id,
            email: user.email,
            student_id: user.username,
            role: user.role,
            token_version: user.token_version || 1,
        }),
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function verifyToken(token) {
    return normalizeDecodedUser(jwt.verify(token, JWT_SECRET));
}

async function validateTokenVersion(decoded = {}) {
    const supabase = require('../config/supabase');
    const userId = decoded.user_id || decoded.userId || decoded.sub;
    if (!userId) {
        return false;
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('token_version')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !user) {
        return false;
    }

    const tokenVersion = decoded.token_version || 1;
    const currentVersion = user.token_version || 1;

    return tokenVersion === currentVersion;
}

async function protect(req, res, next) {
    try {
        const token = getRequestToken(req);

        if (!token) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const decoded = verifyToken(token);
        const isValidVersion = await validateTokenVersion(decoded);

        if (!isValidVersion) {
            return res.status(401).json({ error: 'Invalid or expired authentication token.' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }
}

async function authenticateSocket(socket, next) {
    try {
        const rawToken =
            socket.handshake?.auth?.token ||
            socket.handshake?.headers?.authorization ||
            socket.handshake?.query?.token ||
            parseCookies(socket.handshake?.headers?.cookie)[AUTH_COOKIE_NAME];

        const token = extractToken(rawToken);

        if (!token) {
            return next(new Error('Authentication required.'));
        }

        const decoded = verifyToken(token);
        const isValidVersion = await validateTokenVersion(decoded);

        if (!isValidVersion) {
            return next(new Error('Invalid or expired authentication token.'));
        }

        socket.user = decoded;
        return next();
    } catch (error) {
        return next(new Error('Invalid or expired authentication token.'));
    }
}

function requireRole(...allowedRoles) {
    const allowed = new Set(allowedRoles.flat().map(normalizeRole));

    return (req, res, next) => {
        const role = normalizeRole(req.user?.role);
        if (!role || !allowed.has(role)) {
            return res.status(403).json({
                error: 'You do not have permission to perform this action.',
            });
        }
        return next();
    };
}

const requireAdmin = requireRole('admin');
const requireStaff = requireRole('admin', 'pd', 'guidance', 'sdo', 'ro_coordinator');

module.exports = {
    buildAuthToken,
    protect,
    authenticateSocket,
    requireRole,
    requireAdmin,
    requireStaff,
    normalizeRole,
    AUTH_COOKIE_NAME,
};
