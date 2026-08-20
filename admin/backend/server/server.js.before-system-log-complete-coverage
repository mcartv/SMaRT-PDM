const path = require('path');
const fs = require('fs');
const http = require('http');
const { ensureCanonicalIotOcrMigration } = require('../services/liveMigrationService');
const socketIO = require('socket.io');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({
    path: path.resolve(__dirname, '../.env'),
    quiet: true,
  });
}

const LOG_STARTUP_DETAILS =
  String(process.env.LOG_STARTUP_DETAILS || 'false').toLowerCase() === 'true';

const LOG_REALTIME_DETAILS =
  String(process.env.LOG_REALTIME_DETAILS || 'false').toLowerCase() === 'true';

const LOG_SOCKET_DETAILS =
  String(process.env.LOG_SOCKET_DETAILS || 'false').toLowerCase() === 'true';

const startupLog = (...args) => {
  if (LOG_STARTUP_DETAILS) {
    console.log(...args);
  }
};

const realtimeLog = (...args) => {
  if (LOG_REALTIME_DETAILS) {
    console.log(...args);
  }
};

const socketLog = (...args) => {
  if (LOG_SOCKET_DETAILS) {
    console.log(...args);
  }
};

const express = require('express');
const cors = require('cors');

// Route imports
const authRoutes = require('../routes/authRoutes');
const dashboardRoutes = require('../routes/dashboardRoutes');
const scholarRoutes = require('../routes/scholarRoutes');
const applicationRoutes = require('../routes/applicationRoutes');
const selectionRoutes = require('../routes/selectionRoutes');
const messageRoutes = require('../routes/messageRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const announcementRoutes = require('../routes/announcementRoutes');
const roRoutes = require('../routes/roRoutes');
const roCoordinatorRoutes = require('../routes/roCoordinatorRoutes');
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
const personalToolRoutes = require('../routes/personalToolRoutes');

const piRoutes = require('../routes/piRoutes');
const piIotOcrRoutes = require('../routes/piIotOcrRoutes');

// Services
const {
  runDepartmentDigestScheduler,
} = require('../services/schedulerService');
const internalRealtimeRoutes = require('../routes/internalRealtimeRoutes');

const announcementService = require('../services/announcementService');
const personalToolService = require('../services/personalToolService');
const iotOcrPresenceService = require('../services/iotOcrPresenceService');
const { configureRealtimeBridge } = require('../services/realtimeBridgeService');
const socketEvents = require('../utils/socketEvents');
const { createStaffSocketAuthMiddleware } = require('../utils/socketAuth');
const supabase = require('../config/supabase');
const pool = require('../config/db');

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

startupLog('Frontend build path:', frontendBuildPath);
startupLog(
  'Index.html exists:',
  fs.existsSync(path.join(frontendBuildPath, 'index.html'))
);
startupLog(
  'Assets directory exists:',
  fs.existsSync(path.join(frontendBuildPath, 'assets'))
);

app.use(express.static(frontendBuildPath));

// =========================
// HEALTH CHECK
// =========================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    socket: 'enabled',
    iot_ocr_fix: 'immutable-snapshot-provenance-v2',
    iot_ocr_schema_fix: 'name-array-cast-rollback-v1',
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
app.use('/api/selections', selectionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/ro', roRoutes);
app.use('/api/ro-coordinator', roCoordinatorRoutes);
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
app.use('/api/personal-tools', personalToolRoutes);

app.use('/api/pi', piRoutes);
app.use('/api/internal/realtime', internalRealtimeRoutes);

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

function joinSocketToUserRoom(socket) {
  const userId = String(socket.data?.userId || '').trim();

  if (!socket.data?.authenticated || !userId) {
    console.warn(`[Socket] Cannot join user room for socket ${socket.id}: unauthenticated socket`);
    return false;
  }

  const roomName = `user:${userId}`;

  socket.join(roomName);

  socketLog(`[Socket] Socket ${socket.id} joined ${roomName}`);

  socket.emit('socket:joined', {
    userId,
    user_id: userId,
    room: roomName,
    joined_at: new Date().toISOString(),
  });

  return true;
}

function handleJoinPayload(socket) {
  // Legacy clients still emit several join aliases after connecting. Never
  // trust a userId/token supplied in those events; the authenticated handshake
  // identity is the only identity allowed to join a private user room.
  return joinSocketToUserRoom(socket);
}

// =========================
// SERVER START WITH SOCKET.IO
// =========================

const PORT = process.env.PORT || 5001;

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

// Every authenticated application realtime connection must prove a valid,
// current user session before Socket.IO accepts it on the default namespace.
io.use(createStaffSocketAuthMiddleware());

// Public landing/login pages use a separate receive-only namespace for safe
// public UI refresh events such as landing-theme updates. It does not join
// authenticated user rooms and has no server-side mutation handlers.
const publicIo = io.of('/public');
publicIo.on('connection', (socket) => {
  socketLog(`[Socket] Public client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    socketLog(`[Socket] Public client disconnected: ${socket.id}`);
  });
});

app.set('io', io);

iotOcrPresenceService.setAvailabilityListener((availability) => {
  socketEvents.piAvailability(io, {
    ...availability,
    source: 'iot_ocr_presence',
  });
});

configureRealtimeBridge({
  io,
  supabase,
});

io.on('connection', (socket) => {
  socketLog(
    `[Socket] Authenticated user connected: ${socket.id} (${socket.data?.role || 'unknown'})`
  );

  joinSocketToUserRoom(socket);

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
    socketLog(`[Socket] User disconnected: ${socket.id}`, reason);
  });
});

global._applicationStartupReady = false;

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

const SCHEDULER_INTERVAL_MS = 60 * 1000;
const SCHEDULER_LEADER_LOCK_KEY = 'smart-pdm:admin:scheduler-leader';

let schedulerLeaderClient = null;
let schedulerLeadershipPromise = null;

async function ensureSchedulerLeadership() {
  if (schedulerLeaderClient) return true;
  if (schedulerLeadershipPromise) return schedulerLeadershipPromise;

  schedulerLeadershipPromise = (async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS acquired',
        [SCHEDULER_LEADER_LOCK_KEY]
      );
      const acquired = result.rows?.[0]?.acquired === true;
      if (!acquired) {
        client.release();
        return false;
      }
      schedulerLeaderClient = client;
      client.on('error', (error) => {
        console.error('Scheduler leader database connection lost:', error.message);
        schedulerLeaderClient = null;
      });
      console.log('[Scheduler] This admin backend is the scheduler leader.');
      return true;
    } catch (error) {
      client.release();
      throw error;
    }
  })();

  try {
    return await schedulerLeadershipPromise;
  } finally {
    schedulerLeadershipPromise = null;
  }
}

if (!global._announcementSchedulerRunning) {
  global._announcementSchedulerRunning = true;

  let announcementSchedulerBusy = false;
  let reminderSchedulerBusy = false;
  let digestSchedulerBusy = false;

  const runAnnouncementScheduler = async () => {
    if (!global._applicationStartupReady) return;
    if (announcementSchedulerBusy) return;

    announcementSchedulerBusy = true;

    try {
      if (!(await ensureSchedulerLeadership())) return;
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
    } catch (err) {
      console.error('Announcement Scheduler Error:', err.message);
    } finally {
      announcementSchedulerBusy = false;
    }
  };

  const runReminderScheduler = async () => {
    if (!global._applicationStartupReady) return;
    if (reminderSchedulerBusy) return;

    reminderSchedulerBusy = true;

    try {
      if (!(await ensureSchedulerLeadership())) return;
      const dueReminders = await personalToolService.processDueReminders();

      dueReminders.forEach(({ userId, notification }) => {
        socketEvents.notificationCreated(io, userId, notification);
      });
    } catch (err) {
      console.error('Reminder Scheduler Error:', err.message);
    } finally {
      reminderSchedulerBusy = false;
    }
  };

  const runDigestScheduler = async () => {
    if (!global._applicationStartupReady) return;
    if (digestSchedulerBusy) return;

    digestSchedulerBusy = true;

    try {
      if (!(await ensureSchedulerLeadership())) return;
      await runDepartmentDigestScheduler();
    } catch (err) {
      console.error('Department Digest Scheduler Error:', err.message);
    } finally {
      digestSchedulerBusy = false;
    }
  };

  runAnnouncementScheduler();
  runReminderScheduler();
  runDigestScheduler();

  // Realtime delivery remains handled by configureRealtimeBridge()/Socket.IO.
  // These timers only perform clock-based work.
  setInterval(runAnnouncementScheduler, SCHEDULER_INTERVAL_MS);
  setInterval(runReminderScheduler, SCHEDULER_INTERVAL_MS);
  setInterval(runDigestScheduler, SCHEDULER_INTERVAL_MS);
}

async function startServer() {
  try {
    await ensureCanonicalIotOcrMigration();
    require('../services/birthOcrV2Service').cleanupPendingArtifacts().catch((error) => {
      console.warn('IOT_OCR_ARTIFACT_CLEANUP_RETRY_FAILED', { code: error.code || 'CLEANUP_FAILED' });
    });
    global._applicationStartupReady = true;

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket enabled at ws://localhost:${PORT}`);
      console.log('Allowed origins:', allowedOrigins);
      console.log('Allowed origin suffixes:', allowedOriginSuffixes);
    });
  } catch (error) {
    console.error('SERVER_START_BLOCKED_BY_MIGRATION', { message: error.message });
    process.exit(1);
  }
}

startServer();
