const crypto = require('crypto');

function verifyPiToken(req, res, next) {
    const expectedToken = String(process.env.PI_SHARED_TOKEN || '').trim();
    const providedToken = String(req.headers['x-pi-token'] || '').trim();

    if (!expectedToken) {
        return res.status(500).json({
            message: 'PI_SHARED_TOKEN is not configured',
        });
    }

    if (!providedToken) {
        return res.status(401).json({
            message: 'Pi token is required',
        });
    }

    const expectedBuffer = Buffer.from(expectedToken);
    const providedBuffer = Buffer.from(providedToken);

    if (
        expectedBuffer.length !== providedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
        return res.status(401).json({
            message: 'Pi token is not valid',
        });
    }

    req.piAuth = {
        deviceId: String(req.headers['x-pi-device-id'] || '').trim() || null,
    };

    next();
}

module.exports = {
    verifyPiToken,
};
