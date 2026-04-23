const path = require('path');
const fs = require('fs');
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
const ocrRoutes = require('../routes/ocrRoutes');
const piRoutes = require('../routes/piRoutes');

// Services
const { runAnnouncementScheduler } = require('../services/schedulerService');

const app = express();

// =========================
// CORS SETUP
// =========================

const allowedOrigins = (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOriginSuffixes = (process.env.FRONTEND_ORIGIN_SUFFIXES || '.vercel.app')
  .split(',')
  .map((suffix) => suffix.trim().toLowerCase())
  .filter(Boolean);

if (!allowedOrigins.length) {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  );
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const parsed = new URL(origin);
    const protocol = parsed.protocol;
    const hostname = parsed.hostname.toLowerCase();

    if (
      (protocol === 'http:' || protocol === 'https:') &&
      (hostname === 'localhost' || hostname === '127.0.0.1')
    ) {
      return true;
    }

    if (allowedOriginSuffixes.some((suffix) => hostname.endsWith(suffix))) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    console.error(`CORS blocked for origin: ${origin}`);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// =========================
// BODY PARSERS
// =========================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// SERVE STATIC FILES (React Frontend)
// =========================

const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
console.log('Frontend build path:', frontendBuildPath);
console.log('Index.html exists:', fs.existsSync(path.join(frontendBuildPath, 'index.html')));
console.log('Assets directory exists:', fs.existsSync(path.join(frontendBuildPath, 'assets')));

app.use(express.static(frontendBuildPath));

// =========================
// HEALTH CHECK
// =========================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
    res.send('API is running...');
});

// =========================
// API ROUTES
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
app.use('/api/ocr', ocrRoutes);
app.use('/api/pi', piRoutes);

// =========================
// SPA CATCH-ALL
// =========================

app.use((req, res) => {
    console.log('Catch-all request:', req.method, req.path, req.headers.accept);

    if (req.path.startsWith('/api/')) {
        console.log('API route not found:', req.path);
        return res.status(404).json({ message: 'API endpoint not found' });
    }

    if (path.extname(req.path)) {
        console.log('Static asset not found:', req.path);
        return res.status(404).send('Asset not found');
    }

    const indexPath = path.join(frontendBuildPath, 'index.html');
    console.log('Serving index.html for:', req.path);

    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error serving index.html for path:', req.path, err);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Internal server error' });
            }
        }
    });
});

// =========================
// GLOBAL ERROR HANDLER
// =========================

app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);

    if (!res.headersSent) {
        res.status(err.status || 500).json({
            message: err.message || 'Internal Server Error',
        });
    } else {
        next(err);
    }
});

// =========================
// SERVER START WITH SOCKET.IO
// =========================

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = socketIO(server, {
    cors: {
        origin(origin, callback) {
            if (isAllowedOrigin(origin)) {
                return callback(null, true);
            }

            return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
        },
        credentials: true,
        methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

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
    console.log('Allowed origins:', allowedOrigins);
    console.log('Allowed origin suffixes:', allowedOriginSuffixes);
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