const { Server } = require('socket.io');
const { authenticateSocket } = require('../middleware/authMiddleware');
const {
    isAllowedSocketOrigin,
} = require('./socketOriginPolicy');

function configureSocket(server) {
    const io = new Server(server, {
        cors: {
            origin(origin, callback) {
                if (isAllowedSocketOrigin(origin)) {
                    return callback(null, true);
                }

                console.error(
                    '[Socket.IO] CORS blocked origin:',
                    origin
                );

                return callback(
                    new Error(
                        'Socket.IO CORS blocked origin: ' + origin
                    )
                );
            },
            methods: [
                'GET',
                'POST',
                'PUT',
                'PATCH',
                'DELETE',
                'OPTIONS',
            ],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    io.engine.on('connection_error', (err) => {
        console.log('Socket.IO connection error:', {
            message: err.message,
            code: err.code,
            context: err.context,
        });
    });

    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        console.log('Socket connected:', socket.id);

        const userId =
            socket.user?.user_id ||
            socket.user?.userId ||
            socket.user?.id ||
            null;

        if (userId) {
            socket.join('user:' + userId);
            console.log('Socket joined user room: user:' + userId);
        }

        socket.on('disconnect', (reason) => {
            console.log(
                'Socket disconnected:',
                socket.id,
                reason
            );
        });
    });

    return io;
}

module.exports = {
    configureSocket,
};
