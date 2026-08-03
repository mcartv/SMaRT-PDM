const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { getSafeStatusCode } = require('./utils/httpStatus');
const renewalRoutes = require('./routes/renewalRoutes');

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many password reset requests. Please try again later.',
    },
});

const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many registration attempts. Please try again later.',
    },
});

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many OTP attempts. Please try again later.',
    },
});

function createApp() {
    const app = express();

    app.set('trust proxy', 1);

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

    app.use('/api/auth/forgot-password', forgotPasswordLimiter);
    app.use('/api/auth/register', registrationLimiter);
    app.use('/api/auth/verify-otp', otpLimiter);
    app.use('/api/renewals', renewalRoutes);
    app.use(routes);


    app.use((req, res) => {

        res.status(404).json({
            error: `Route not found: ${req.method} ${req.originalUrl}`,
        });
    });

    app.use((error, _req, res, _next) => {
        console.error('APP ERROR:', error);
        res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Internal server error',
        });
    });

    return app;
}

module.exports = {
    createApp,
};
