require('dotenv').config();

const http = require('http');
const { createApp } = require('./app');
const { configureSocket } = require('./config/socket');
const supabase = require('./config/supabase');

const notificationService = require('./services/notificationService');
const messageService = require('./services/messageService');

const PORT = process.env.PORT || 5000;

const app = createApp();
const server = http.createServer(app);

const io = configureSocket(server);

notificationService.configureNotificationService({
    io,
    supabase,
});

messageService.configureMessageService({
    io,
    supabase,
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});