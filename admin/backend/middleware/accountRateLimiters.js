'use strict';

const rateLimit = require('express-rate-limit');

function authenticatedUserKey(req) {
    const userId = req.user?.user_id || req.user?.userId || req.user?.id;
    return `account:${String(userId || 'authenticated-user')}`;
}

function createAccountLimiter({ windowMs, max, message, skipSuccessfulRequests = false }) {
    return rateLimit({
        windowMs,
        max,
        keyGenerator: authenticatedUserKey,
        skipSuccessfulRequests,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            code: 'ACCOUNT_RATE_LIMITED',
            message,
        },
    });
}

const profileEditLimiter = createAccountLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many profile updates. Please wait before trying again.',
});

const passwordActionLimiter = createAccountLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: 'Too many unsuccessful password attempts. Please try again later.',
});

const profilePhotoLimiter = createAccountLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many profile photo changes. Please wait before trying again.',
});

const adminAccountMutationLimiter = createAccountLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many account management changes. Please wait before trying again.',
});

module.exports = {
    adminAccountMutationLimiter,
    passwordActionLimiter,
    profileEditLimiter,
    profilePhotoLimiter,
};
