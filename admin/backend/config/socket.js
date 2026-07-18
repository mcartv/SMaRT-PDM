const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://smart-pdm.vercel.app',
    'https://s-ma-rt-nasuuppz4-mcartvs-projects.vercel.app',
    'https://s-ma-rt-734gd5yf5-mcartvs-projects.vercel.app',
];

const DEFAULT_ALLOWED_SUFFIXES = ['.vercel.app'];

function parseCsv(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function getAllowedOrigins() {
    const fromEnv = parseCsv(process.env.FRONTEND_ORIGINS);
    return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

function getAllowedSuffixes() {
    const fromEnv = parseCsv(process.env.FRONTEND_ORIGIN_SUFFIXES);
    return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_SUFFIXES;
}

function isAllowedOrigin(origin, allowedOrigins, allowedSuffixes) {
    if (!origin) return true;

    if (allowedOrigins.includes(origin)) return true;

    try {
        const { hostname } = new URL(origin);

        return allowedSuffixes.some((suffix) => {
            return hostname === suffix.replace(/^\./, '') || hostname.endsWith(suffix);
        });
    } catch {
        return false;
    }
}

function decodeSocketToken(token) {
    const cleanToken = String(token || '').trim();

    if (!cleanToken) return null;

    const secret =
        process.env.JWT_SECRET ||
        process.env.ACCESS_TOKEN_SECRET ||
        process.env.ADMIN_JWT_SECRET ||
        '';

    if (secret) {
        try {
            return jwt.verify(cleanToken, secret);
        } catch (error) {
            console.warn('[Socket] JWT verify failed, falling back to decode:', error.message);
        }
    }

    try {
        return jwt.decode(cleanToken);
    } catch {
        return null;
    }
}

function getUserIdFromPayload(payload = {}) {
    return (
        payload.user_id ||
        payload.userId ||
        payload.id ||
        payload.sub ||
        payload.user?.user_id ||
        payload.user?.userId ||
        payload.user?.id ||
        null
    );
}

function joinUserRoom(socket, userId) {
    const normalizedUserId = String(userId || '').trim();

    if (!normalizedUserId) return;

    const roomName = `user:${normalizedUserId}`;

    socket.join(roomName);

    console.log('[Socket] joined room:', roomName);
}

function configureSocket(server) {
    const allowedOrigins = getAllowedOrigins();
    const allowedSuffixes = getAllowedSuffixes();

    const io = new Server(server, {
        cors: {
            origin(origin, callback) {
                if (isAllowedOrigin(origin, allowedOrigins, allowedSuffixes)) {
                    callback(null, true);
                    return;
                }

                callback(new Error(`Socket origin not allowed: ${origin}`));
            },
            credentials: true,
            methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        },
        transports: ['websocket', 'polling'],
    });

    console.log(`WebSocket enabled at ws://localhost:${process.env.PORT || 5000}`);
    console.log('Allowed origins:', allowedOrigins);
    console.log('Allowed origin suffixes:', allowedSuffixes);

    io.on('connection', (socket) => {
        console.log('[Socket] connected:', socket.id);

        const token =
            socket.handshake.auth?.token ||
            socket.handshake.query?.token ||
            socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
            '';

        const decoded = decodeSocketToken(token);
        const userId = getUserIdFromPayload(decoded || {});

        if (userId) {
            joinUserRoom(socket, userId);
            socket.data.userId = String(userId);
        } else {
            console.warn('[Socket] connected without resolved user id:', socket.id);
        }

        socket.on('user-join', (payload) => {
            const payloadUserId =
                typeof payload === 'string'
                    ? payload
                    : payload?.user_id || payload?.userId || payload?.id || null;

            joinUserRoom(socket, payloadUserId);
            socket.data.userId = String(payloadUserId || '');
        });

        socket.on('join:user', (payload) => {
            const payloadUserId =
                typeof payload === 'string'
                    ? payload
                    : payload?.user_id || payload?.userId || payload?.id || null;

            joinUserRoom(socket, payloadUserId);
            socket.data.userId = String(payloadUserId || '');
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket] disconnected:', socket.id, reason);
        });
    });

    return io;
}

module.exports = {
    configureSocket,
};