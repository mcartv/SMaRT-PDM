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
const dashboardRoutes = require('../routes/dashboardRoutes');
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
const generalSettingRoutes = require('../routes/generalSettingRoutes');

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
  .map((origin) => origin.trim().replace(/\/+$/, ''))
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
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.100.9:5173',
    'http://192.168.100.9:5174',
    'http://192.168.100.9:3000'
  );
}

const allowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'x-audit-access-token',
  'X-Audit-Access-Token',
];

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);

  if (allowedOrigins.includes(normalizedOrigin)) return true;

  try {
    const parsed = new URL(normalizedOrigin);
    const protocol = parsed.protocol;
    const hostname = parsed.hostname.toLowerCase();

    if (
      (protocol === 'http:' || protocol === 'https:') &&
      (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      )
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

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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
  res.json({
    status: 'ok',
    socket: 'enabled',
    time: new Date().toISOString(),
  });
});

app.get('/api/socket-health', (req, res) => {
  const io = req.app.get('io');

  res.json({
    status: 'ok',
    socket: Boolean(io),
    connectedClients: io?.engine?.clientsCount || 0,
    time: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.send('API is running...');
});

// =========================
// API ROUTES
// =========================

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
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
app.use('/api/general-settings', generalSettingRoutes);

app.use('/api/pi', piRoutes);

// =========================
// SPA CATCH-ALL
// =========================

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  console.log('API route not found:', req.method, req.originalUrl);

  return res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((req, res) => {
  console.log('Catch-all request:', req.method, req.path, req.headers.accept);

  if (path.extname(req.path)) {
    console.log('Static asset not found:', req.path);
    return res.status(404).send('Asset not found');
  }

  const indexPath = path.join(frontendBuildPath, 'index.html');

  if (!fs.existsSync(indexPath)) {
    return res.status(404).json({
      message: 'Frontend build not found',
      path: indexPath,
    });
  }

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
    return res.status(err.status || 500).json({
      message: err.message || 'Internal Server Error',
    });
  }

  return next(err);
});

// =========================
// SOCKET HELPERS
// =========================

function decodeJwtPayloadUnsafe(token) {
  try {
    if (!token) return {};

    const parts = String(token).split('.');
    if (parts.length < 2) return {};

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');

    return JSON.parse(json) || {};
  } catch {
    return {};
  }
}

function verifyOrDecodeToken(token) {
  const rawToken = String(token || '').replace(/^Bearer\s+/i, '').trim();

  if (!rawToken) return {};

  try {
    if (process.env.JWT_SECRET) {
      return jwt.verify(rawToken, process.env.JWT_SECRET) || {};
    }
  } catch (error) {
    console.warn('[Socket] JWT verify failed, falling back to decode:', error.message);
  }

  return decodeJwtPayloadUnsafe(rawToken);
}

function extractUserIdFromPayload(payload = {}) {
  if (typeof payload === 'string') {
    return payload.trim();
  }

  return (
    payload.userId ||
    payload.user_id ||
    payload.id ||
    payload.sub ||
    ''
  )
    .toString()
    .trim();
}

function extractTokenFromSocket(socket) {
  const auth = socket.handshake?.auth || {};
  const query = socket.handshake?.query || {};
  const headers = socket.handshake?.headers || {};

  return (
    auth.token ||
    query.token ||
    headers.authorization ||
    headers.Authorization ||
    ''
  );
}

function extractUserIdFromSocket(socket) {
  const auth = socket.handshake?.auth || {};
  const query = socket.handshake?.query || {};

  const directUserId =
    auth.userId ||
    auth.user_id ||
    query.userId ||
    query.user_id ||
    '';

  if (directUserId) {
    return directUserId.toString().trim();
  }

  const token = extractTokenFromSocket(socket);
  const decoded = verifyOrDecodeToken(token);

  return extractUserIdFromPayload(decoded);
}

function joinSocketToUserRoom(socket, rawUserId) {
  const userId = String(rawUserId || '').trim();

  if (!userId) {
    console.warn(`[Socket] Cannot join user room for socket ${socket.id}: missing userId`);
    return false;
  }

  const roomName = `user:${userId}`;

  socket.join(roomName);
  socket.data.userId = userId;

  console.log(`[Socket] Socket ${socket.id} joined ${roomName}`);

  socket.emit('socket:joined', {
    userId,
    user_id: userId,
    room: roomName,
    joined_at: new Date().toISOString(),
  });

  return true;
}

function handleJoinPayload(socket, payload = {}) {
  let userId = '';

  if (typeof payload === 'string') {
    userId = payload;
  } else if (payload && typeof payload === 'object') {
    userId = extractUserIdFromPayload(payload);

    if (!userId && payload.token) {
      const decoded = verifyOrDecodeToken(payload.token);
      userId = extractUserIdFromPayload(decoded);
    }
  }

  return joinSocketToUserRoom(socket, userId);
}

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

      console.error(`Socket CORS blocked for origin: ${origin}`);
      return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 25000,
});

app.set('io', io);

configureRealtimeBridge({
  io,
  supabase,
});

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  const handshakeUserId = extractUserIdFromSocket(socket);

  if (handshakeUserId) {
    joinSocketToUserRoom(socket, handshakeUserId);
  } else {
    console.warn(`[Socket] ${socket.id} connected without userId in handshake`);
  }

  socket.on('user-join', (payload) => {
    handleJoinPayload(socket, payload);
  });

  socket.on('join:user', (payload) => {
    handleJoinPayload(socket, payload);
  });

  socket.on('joinUser', (payload) => {
    handleJoinPayload(socket, payload);
  });

  socket.on('join-user', (payload) => {
    handleJoinPayload(socket, payload);
  });

  socket.on('joinUserRoom', (payload) => {
    handleJoinPayload(socket, payload);
  });

  socket.on('authenticate', (payload) => {
    handleJoinPayload(socket, payload);
  });

  socket.on('register', (payload) => {
    handleJoinPayload(socket, payload);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] User disconnected: ${socket.id}`, reason);
  });
});

server.listen(PORT, '0.0.0.0', () => {
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