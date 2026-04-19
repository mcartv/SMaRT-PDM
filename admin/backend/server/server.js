const path = require('path');
const http = require('http');
const socketIO = require('socket.io');

require('dotenv').config({
    path: path.resolve(__dirname, '../.env'),
});

const express = require('express');
const cors = require('cors');

// Route imports
const authRoutes = require('../routes/authRoutes');
const scholarRoutes = require('../routes/scholarRoutes');
const applicationRoutes = require('../routes/applicationRoutes');
const messageRoutes = require('../routes/messageRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const announcementRoutes = require('../routes/announcementRoutes');
const roRoutes = require('../routes/roRoutes');
const scholarshipProgramRoutes = require('../routes/scholarshipProgramRoutes');
const programOpeningRoutes = require('../routes/programOpeningRoutes');
const courseRoutes = require('../routes/courseRoutes');
const benefactorRoutes = require('../routes/benefactorRoutes');
const departmentRoutes = require('../routes/departmentRoutes');
const renewalRoutes = require('../routes/renewalRoutes');
const supportTicketRoutes = require('../routes/supportTicketRoutes');
const payoutRoutes = require('../routes/payoutRoutes');
const studentRegistryRoutes = require('../routes/studentRegistryRoutes');
const academicYearRoutes = require('../routes/academicYearRoutes');

// Services
const { runAnnouncementScheduler } = require('../services/schedulerService');

const app = express();

const allowedOrigins = (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOriginSuffixes = (process.env.FRONTEND_ORIGIN_SUFFIXES || '.vercel.app')
    .split(',')
    .map((suffix) => suffix.trim().toLowerCase())
    .filter(Boolean);

if (!allowedOrigins.length) {
    allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
}

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;

    try {
        const { hostname } = new URL(origin);
        const normalizedHostname = hostname.toLowerCase();
        return allowedOriginSuffixes.some((suffix) => normalizedHostname.endsWith(suffix));
    } catch (error) {
        return false;
    }
};

// =========================
// MIDDLEWARE
// =========================

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// ROUTES
// =========================

app.use('/api/auth', authRoutes);
app.use('/api/scholars', scholarRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/ro', roRoutes);
app.use('/api/scholarship-program', scholarshipProgramRoutes);
app.use('/api/program-openings', programOpeningRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/benefactors', benefactorRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/renewals', renewalRoutes);
app.use('/api/support-tickets', supportTicketRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/student-registry', studentRegistryRoutes);
app.use('/api/academic-years', academicYearRoutes);

// =========================
// SERVE STATIC FILES (React Frontend)
// =========================

const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));

// =========================
// HEALTH CHECK
// =========================

app.get('/', (req, res) => {
    res.send('API is running...');
});

// =========================
// CATCH-ALL ROUTE FOR CLIENT-SIDE ROUTING
// Serves index.html for any non-API route, allowing React Router to handle routing
// =========================

app.get('*', (req, res) => {
    const indexPath = path.join(frontendBuildPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

// =========================
// ERROR HANDLER
// =========================

app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);

    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
    });
});

// =========================
// SERVER START WITH SOCKET.IO
// =========================

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Make io instance available to routes
app.set('io', io);

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // Join user to a room for targeted broadcasts
    socket.on('user-join', (userId) => {
        socket.join(`user:${userId}`);
        console.log(`[Socket] User ${userId} joined their room`);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket enabled at ws://localhost:${PORT}`);
});

// =========================
// SCHEDULER
// =========================

if (!global._announcementSchedulerRunning) {
    global._announcementSchedulerRunning = true;

    setInterval(async () => {
        try {
            await runAnnouncementScheduler();
        } catch (err) {
            console.error('Scheduler Error:', err.message);
        }
    }, 30000);
}
