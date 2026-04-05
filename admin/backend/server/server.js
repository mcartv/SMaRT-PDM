const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');

const authRoutes = require('../routes/authRoutes');
const scholarRoutes = require('../routes/scholarRoutes');
const applicationRoutes = require('../routes/applicationRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const announcementRoutes = require('../routes/announcementRoutes');
const { runAnnouncementScheduler } = require('../services/schedulerService');
const roRoutes = require('../routes/roRoutes');
const scholarshipProgramRoutes = require('../routes/scholarshipProgramRoutes');
const benefactorRoutes = require('../routes/benefactorRoutes');
const programOpeningRoutes = require('../routes/programOpeningRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/scholars', scholarRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/ro', roRoutes);
app.use('/api/scholarship-programs', scholarshipProgramRoutes);
app.use('/api/benefactors', benefactorRoutes);
app.use('/api/program-openings', programOpeningRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

setInterval(() => {
    runAnnouncementScheduler();
}, 30000); // every 30 seconds