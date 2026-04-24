const express = require('express');
const cors = require('cors');

const legacy = require('../server.legacy');
const routes = require('./routes');

function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // ✅ TEMP BRIDGE (must be INSIDE createApp)
    app.use((req, res, next) => {
        req.isSupportAdmin = legacy.isSupportAdmin;
        req.listSupportTicketsForAdmin = legacy.listSupportTicketsForAdmin;
        req.resolveStudentByUserId = legacy.resolveStudentByUserId;
        req.mapSupportTicketRow = legacy.mapSupportTicketRow;
        req.getRequestUserId = legacy.getRequestUserId;
        next();
    });

    // new modular routes
    app.use('/api', routes);

    // fallback to legacy
    app.use(legacy);

    return app;
}

module.exports = { createApp };