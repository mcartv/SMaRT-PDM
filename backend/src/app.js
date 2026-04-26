const express = require('express');
const cors = require('cors');

const routes = require('./routes');

function createApp() {
    const app = express();

    app.use(
        cors({
            origin: true,
            credentials: true,
        })
    );

    app.use(express.json({ limit: '25mb' }));
    app.use(express.urlencoded({ extended: true, limit: '25mb' }));

    app.get('/', (_req, res) => {
        res.status(200).send('SMaRT-PDM backend is running.');
    });

    app.use(routes);

    app.use((req, res) => {
        res.status(404).json({
            error: `Route not found: ${req.method} ${req.originalUrl}`,
        });
    });

    app.use((error, _req, res, _next) => {
        console.error('APP ERROR:', error);
        res.status(error.statusCode || 500).json({
            error: error.message || 'Internal server error',
        });
    });

    return app;
}

module.exports = {
    createApp,
};