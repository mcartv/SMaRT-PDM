const crypto = require('crypto');
const { normalizeDeviceId } = require('../utils/iotOcrIdentity');

function verifyPiToken(req, res, next) {
    const expectedToken = String(process.env.PI_SHARED_TOKEN || '').trim();
    const providedToken = String(req.headers['x-pi-token'] || '').trim();

    if (!expectedToken) {
        return res.status(500).json({
            code: 'PI_SHARED_TOKEN_NOT_CONFIGURED',
            message: 'PI_SHARED_TOKEN is not configured',
        });
    }

    if (!providedToken) {
        return res.status(401).json({
            code: 'PI_TOKEN_REQUIRED',
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
            code: 'PI_TOKEN_INVALID',
            message: 'Pi token is not valid',
        });
    }

    const rawDeviceId = String(req.headers['x-pi-device-id'] || '').trim();
    const deviceId = normalizeDeviceId(rawDeviceId);

    if (!deviceId) {
        return res.status(400).json({
            code: 'PI_DEVICE_ID_INVALID',
            message: 'x-pi-device-id is required and must be a UUID',
        });
    }

    req.piAuth = { deviceId };
    return next();
}

module.exports = {
    verifyPiToken,
};
