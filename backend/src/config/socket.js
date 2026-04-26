const { Server } = require('socket.io');
const { authenticateSocket } = require('../middleware/authMiddleware');

function configureSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: [
                'http://localhost:3000',
                'http://localhost:5173',
                'http://localhost:5000',
                'http://192.168.100.9:5000',
                'https://smart-pdm-mipx.onrender.com',
            ],
            methods: ['GET', 'POST'],
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
            socket.join(`user:${userId}`);
            console.log(`Socket joined user room: user:${userId}`);
        }

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', socket.id, reason);
        });
    });

    return io;
}

module.exports = {
    configureSocket,
};