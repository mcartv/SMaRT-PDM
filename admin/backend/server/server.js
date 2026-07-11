const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({
    path: path.resolve(__dirname, '../.env'),
  });
}

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
const renewalRoutes = require('../routes/renewalRoutes');
const payoutRoutes = require('../routes/payoutRoutes');
const studentRegistryRoutes = require('../routes/studentRegistryRoutes');
const academicYearRoutes = require('../routes/academicYearRoutes');
const adminProfilePhotoRoutes = require('../routes/adminProfilePhotoRoutes');
const endorsementSlipRoutes = require('../routes/endorsementSlipRoutes');
const accountRoutes = require('../routes/accountRoutes');
const auditLogRoutes = require('../routes/auditLogRoutes');

const ocrRoutes = require('../routes/ocrRoutes');
const reportRoutes = require('../routes/reportRoutes');
const roSettingRoutes = require('../routes/roSettingRoutes');
const themeSettingRoutes = require('../routes/themeSettingRoutes');

const piRoutes = require('../routes/piRoutes');
const piIotOcrRoutes = require('../routes/piIotOcrRoutes');

// Services
const {
  runDepartmentDigestScheduler,
} = require('../services/schedulerService');

const announcementService = require('../services/announcementService');
const { configureRealtimeBridge } = require('../services/realtimeBridgeService');
const socketEvents = require('../utils/socketEvents');
const supabase = require('../config/supabase');

const app = express();
app.set('trust proxy', 1);

// =========================
// CORS SETUP
// =========================

const allowedOrigins = (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const configuredOriginSuffixes = (process.env.FRONTEND_ORIGIN_SUFFIXES || '')
  .split(',')
  .map((suffix) => suffix.trim().toLowerCase())
  .filter(Boolean);

const allowedOriginSuffixes = Array.from(
  new Set([
    '.vercel.app',
    ...configuredOriginSuffixes,
  ])
);

if (!allowedOrigins.length) {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  );
}

const allowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'x-audit-access-token',
  'X-Audit-Access-Token',
];

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
  allowedHeaders,
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
  res.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));

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
app.use('/api/renewals', renewalRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/student-registry', studentRegistryRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/admin/profile-photos', adminProfilePhotoRoutes);
app.use('/api/endorsement-slips', endorsementSlipRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/audit-logs', auditLogRoutes);

app.use('/api/ocr', ocrRoutes);
app.use('/api/pi/iot-ocr', piIotOcrRoutes);

app.use('/api/reports', reportRoutes);
app.use('/api/ro-settings', roSettingRoutes);
app.use('/api/theme-settings', themeSettingRoutes);

app.use('/api/pi/iot-ocr', piIotOcrRoutes);
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

// 404 handler must be LAST
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
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

configureRealtimeBridge({
  io,
  supabase,
});

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  socket.on('user-join', (payload) => {
    let userId = null;

    if (typeof payload === 'string') {
      userId = payload;
    } else if (payload && typeof payload === 'object' && payload.token) {
      try {
        const decoded = jwt.verify(payload.token, process.env.JWT_SECRET);
        userId = decoded.userId || decoded.user_id || decoded.sub || null;
      } catch (error) {
        console.error('[Socket] Failed to decode join token:', error.message);
      }
    } else if (payload && typeof payload === 'object') {
      userId = payload.userId || payload.user_id || null;
    }

    userId = userId?.toString().trim();

    if (!userId) {
      return;
    }

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

function emitScheduledAnnouncementRealtime(announcement) {
  const payload = {
    announcement_id: announcement.id,
    title: announcement.title,
    status: announcement.status,
    audience: announcement.audienceKey || announcement.audience,
    published_at: announcement.publishedAt || announcement.date || new Date().toISOString(),
    updated_at: announcement.updatedAt || announcement.date || new Date().toISOString(),
    source: 'scheduled-publish',
  };

  socketEvents.announcementCreated(io, payload);
  socketEvents.announcementPublished(io, payload);
  socketEvents.announcementUpdated(io, payload);
  socketEvents.announcementRefresh(io, payload);
}

if (!global._announcementSchedulerRunning) {
  global._announcementSchedulerRunning = true;

  let schedulerBusy = false;

  const runSchedulers = async () => {
    if (schedulerBusy) return;

    schedulerBusy = true;

    try {
      const publishedAnnouncements =
        await announcementService.publishDueAnnouncements();

      if (
        Array.isArray(publishedAnnouncements) &&
        publishedAnnouncements.length > 0
      ) {
        for (const announcement of publishedAnnouncements) {
          emitScheduledAnnouncementRealtime(announcement);
        }

        console.log(
          `[Scheduler] Published ${publishedAnnouncements.length} scheduled announcement(s).`
        );
      }

      await runDepartmentDigestScheduler();
    } catch (err) {
      console.error('Scheduler Error:', err.message);
    } finally {
      schedulerBusy = false;
    }
  };

  runSchedulers();

  setInterval(runSchedulers, 10000);
}