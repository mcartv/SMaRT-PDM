const path = require('path');

// ✅ Ensure .env loads correctly from backend root
require('dotenv').config({
    path: path.resolve(__dirname, '../.env'),
});

const express = require('express');
const cors = require('cors');

// ✅ Route imports (keep consistent naming)
const authRoutes = require('../routes/authRoutes');
const scholarRoutes = require('../routes/scholarRoutes');
const applicationRoutes = require('../routes/applicationRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const announcementRoutes = require('../routes/announcementRoutes');
const roRoutes = require('../routes/roRoutes');
const scholarshipProgramRoutes = require('../routes/scholarshipProgramRoutes');
const programOpeningRoutes = require('../routes/programOpeningRoutes');
const courseRoutes = require('../routes/courseRoutes');
const departmentRoutes = require('../routes/departmentRoutes');
const renewalRoutes = require('../routes/renewalRoutes');

// ✅ Services
const { runAnnouncementScheduler } = require('../services/schedulerService');

const app = express();


// =========================
// 🔧 MIDDLEWARE
// =========================

// ✅ Safer CORS (important for frontend 5173)
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// =========================
// 📡 ROUTES
// =========================

app.use('/api/auth', authRoutes);
app.use('/api/scholars', scholarRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/ro', roRoutes);
app.use('/api/scholarship-program', scholarshipProgramRoutes);
app.use('/api/program-openings', programOpeningRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/renewals', renewalRoutes);


// =========================
// 🧪 HEALTH CHECK (IMPORTANT)
// =========================

app.get('/', (req, res) => {
    res.send('API is running...');
});


// =========================
// ❌ ERROR HANDLER
// =========================

app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);

    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
    });
});


// =========================
// 🚀 SERVER START
// =========================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// =========================
// ⏱️ SCHEDULER
// =========================

// ✅ Prevent multiple intervals (important in dev reloads)
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