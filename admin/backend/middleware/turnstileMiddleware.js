const https = require('https');

const SITEVERIFY_HOST = 'challenges.cloudflare.com';
const SITEVERIFY_PATH = '/turnstile/v0/siteverify';
const SITEVERIFY_TIMEOUT_MS = 10_000;
const MAX_TOKEN_LENGTH = 2048;
const EXPECTED_ACTION = 'login';

const CLOUDFLARE_TEST_SECRETS = new Set([
    '1x0000000000000000000000000000000AA',
    '2x0000000000000000000000000000000AA',
    '3x0000000000000000000000000000000AA',
]);

function verifyWithCloudflare({ secret, token, remoteIp }) {
    const form = new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
    }).toString();

    return new Promise((resolve, reject) => {
        const request = https.request(
            {
                hostname: SITEVERIFY_HOST,
                path: SITEVERIFY_PATH,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(form),
                },
            },
            (response) => {
                let body = '';

                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    body += chunk;

                    if (body.length > 64 * 1024) {
                        request.destroy(new Error('Turnstile response was unexpectedly large.'));
                    }
                });
                response.on('end', () => {
                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        reject(new Error(`Turnstile Siteverify returned HTTP ${response.statusCode}.`));
                        return;
                    }

                    try {
                        resolve(JSON.parse(body));
                    } catch {
                        reject(new Error('Turnstile Siteverify returned invalid JSON.'));
                    }
                });
            }
        );

        request.setTimeout(SITEVERIFY_TIMEOUT_MS, () => {
            request.destroy(new Error('Turnstile Siteverify timed out.'));
        });
        request.on('error', reject);
        request.write(form);
        request.end();
    });
}

async function requireTurnstile(req, res, next) {
    const secret = String(
        process.env.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET || ''
    ).trim();
    const token = String(req.body?.turnstileToken || '').trim();

    if (!secret) {
        console.error('TURNSTILE CONFIG ERROR: TURNSTILE_SECRET_KEY is missing.');
        return res.status(503).json({
            code: 'TURNSTILE_NOT_CONFIGURED',
            message: 'Security verification is temporarily unavailable.',
        });
    }

    if (!token || token.length > MAX_TOKEN_LENGTH) {
        return res.status(400).json({
            code: 'TURNSTILE_REQUIRED',
            message: 'Complete the security verification and try again.',
        });
    }

    try {
        const result = await verifyWithCloudflare({
            secret,
            token,
            remoteIp: req.ip || '',
        });
        const isTestSecret = CLOUDFLARE_TEST_SECRETS.has(secret);
        const actionMatches = isTestSecret || result.action === EXPECTED_ACTION;

        if (!result.success || !actionMatches) {
            console.warn('TURNSTILE VERIFICATION FAILED:', {
                success: Boolean(result.success),
                action: result.action || null,
                hostname: result.hostname || null,
                errorCodes: Array.isArray(result['error-codes'])
                    ? result['error-codes']
                    : [],
            });

            return res.status(403).json({
                code: 'TURNSTILE_FAILED',
                message: 'Security verification failed. Please try again.',
            });
        }

        req.turnstile = {
            hostname: result.hostname || null,
            action: result.action || null,
            challengeTs: result.challenge_ts || null,
        };

        return next();
    } catch (error) {
        console.error('TURNSTILE SITEVERIFY ERROR:', error?.message || error);
        return res.status(503).json({
            code: 'TURNSTILE_UNAVAILABLE',
            message: 'Security verification is temporarily unavailable. Please try again.',
        });
    }
}

module.exports = {
    requireTurnstile,
    verifyWithCloudflare,
};
