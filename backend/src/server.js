require('dotenv').config();

const http = require('http');
const { createApp } = require('./app');
const { configureSocket } = require('./config/socket');
const supabase = require('./config/supabase');

const notificationService = require('./services/notificationService');
const messageService = require('./services/messageService');
const roService = require('./services/roService');
const { configureRealtimeBridge } = require('./services/realtimeBridgeService');

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production.');
}

const app = createApp();
const server = http.createServer(app);

const io = configureSocket(server);

app.set('io', io);

notificationService.configureNotificationService({
    io,
    supabase,
});

messageService.configureMessageService({
    io,
    supabase,
});

configureRealtimeBridge({
    io,
    supabase,
});

roService.startAutoTimeoutWorker(io);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
