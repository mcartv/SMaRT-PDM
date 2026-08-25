const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./db');

const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://smart-pdm.vercel.app',
];

const DEFAULT_ALLOWED_SUFFIXES = ['.vercel.app'];

function parseCsv(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim().replace(/\/+$/, ''))
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

    const normalizedOrigin = String(origin).trim().replace(/\/+$/, '');

    if (allowedOrigins.includes(normalizedOrigin)) return true;

    try {
        const parsed = new URL(normalizedOrigin);
        const hostname = parsed.hostname.toLowerCase();

        return allowedSuffixes.some((suffix) => {
            const cleanSuffix = String(suffix || '').toLowerCase();
            return hostname === cleanSuffix.replace(/^\./, '') || hostname.endsWith(cleanSuffix);
        });
    } catch {
        return false;
    }
}

function decodeSocketToken(token) {
    const cleanToken = String(token || '').replace(/^Bearer\s+/i, '').trim();

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

function getUserIdFromJoinPayload(payload = {}) {
    if (typeof payload === 'string') return payload;

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

    if (!normalizedUserId) {
        console.warn('[Socket] joinUserRoom skipped: missing user id', socket.id);
        return false;
    }

    const roomName = `user:${normalizedUserId}`;

    socket.join(roomName);
    socket.data.userId = normalizedUserId;

    console.log('[Socket] joined room:', roomName);

    socket.emit('socket:joined', {
        user_id: normalizedUserId,
        userId: normalizedUserId,
        room: roomName,
        joined_at: new Date().toISOString(),
    });

    return true;
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
        pingTimeout: 30000,
        pingInterval: 25000,
    });

    console.log(`WebSocket enabled at ws://localhost:${process.env.PORT || 5001}`);
    console.log('Allowed origins:', allowedOrigins);
    console.log('Allowed origin suffixes:', allowedSuffixes);

    io.on('connection', (socket) => {
        console.log('[Socket] connected:', socket.id);

        const token =
            socket.handshake.auth?.token ||
            socket.handshake.query?.token ||
            socket.handshake.headers?.authorization ||
            socket.handshake.headers?.Authorization ||
            '';

        const directUserId =
            socket.handshake.auth?.user_id ||
            socket.handshake.auth?.userId ||
            socket.handshake.query?.user_id ||
            socket.handshake.query?.userId ||
            '';

        const decoded = decodeSocketToken(token);
        const tokenUserId = getUserIdFromPayload(decoded || {});
        const userId = directUserId || tokenUserId;

        if (userId) {
            joinUserRoom(socket, userId);
        } else {
            console.warn('[Socket] connected without resolved user id:', socket.id);
        }

        const joinEvents = [
            'user-join',
            'join:user',
            'joinUser',
            'join-user',
            'joinUserRoom',
            'authenticate',
            'register',
        ];

        for (const eventName of joinEvents) {
            socket.on(eventName, (payload) => {
                const payloadUserId = getUserIdFromJoinPayload(payload);
                joinUserRoom(socket, payloadUserId);
            });
        }

        socket.on('message:typing', async (payload = {}) => {
            const senderId = String(socket.data.userId || '').trim();
            if (!senderId) return;

            const isTyping = payload?.is_typing === true || payload?.isTyping === true;
            const now = Date.now();
            const lastTypingAt = Number(socket.data.lastTypingAt || 0);

            // Keep a noisy client from flooding all participant sockets. Stop
            // events are never throttled so typing indicators clear promptly.
            if (isTyping && now - lastTypingAt < 250) return;
            if (isTyping) socket.data.lastTypingAt = now;

            const roomId = String(payload?.room_id || payload?.roomId || '').trim();
            const counterpartyId = String(
                payload?.counterparty_id || payload?.counterpartyId || ''
            ).trim();

            const typingPayload = {
                sender_id: senderId,
                senderId,
                room_id: roomId || null,
                roomId: roomId || null,
                counterparty_id: counterpartyId || null,
                counterpartyId: counterpartyId || null,
                is_typing: isTyping,
                isTyping,
                updated_at: new Date().toISOString(),
            };

            try {
                if (roomId) {
                    const membership = await db.query(
                        `SELECT 1 FROM chat_room_members WHERE room_id = $1 AND user_id = $2 LIMIT 1;`,
                        [roomId, senderId]
                    );
                    if (!membership.rows.length) return;

                    const members = await db.query(
                        `SELECT user_id FROM chat_room_members WHERE room_id = $1 AND user_id <> $2;`,
                        [roomId, senderId]
                    );
                    members.rows.forEach((row) => {
                        const userId = String(row.user_id || '').trim();
                        if (userId) io.to(`user:${userId}`).emit('message:typing', typingPayload);
                    });
                    return;
                }

                if (!counterpartyId || counterpartyId === senderId) return;
                io.to(`user:${counterpartyId}`).emit('message:typing', typingPayload);
            } catch (error) {
                console.warn('[Socket] message:typing relay failed:', error.message);
            }
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