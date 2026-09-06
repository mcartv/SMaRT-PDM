const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { sendAdminResetOtp } = require('../utils/mailer');

const request = { to: 'admin@example.com', otp: '123456', expiresSeconds: 60 };

function setup(t, env) {
    const original = { ...process.env };
    for (const key of Object.keys(process.env)) {
        if (/^(SMTP_|RESEND_|BREVO_|MAIL_|EMAIL_|GMAIL_)/.test(key)) delete process.env[key];
    }
    Object.assign(process.env, env);
    t.after(() => { process.env = original; t.mock.restoreAll(); });
}

test('Brevo configuration is shared with the mobile backend and takes priority', async (t) => {
    setup(t, {
        BREVO_API_KEY: 'brevo-key',
        MAIL_FROM_EMAIL: 'verified@gmail.com',
        MAIL_FROM_NAME: 'SMaRT-PDM OSFA',
        RESEND_API_KEY: 'resend-key',
        RESEND_FROM: 'onboarding@resend.dev',
    });
    t.mock.method(global, 'fetch', async (url, options) => {
        assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
        assert.equal(options.headers['api-key'], 'brevo-key');
        const body = JSON.parse(options.body);
        assert.deepEqual(body.sender, { name: 'SMaRT-PDM OSFA', email: 'verified@gmail.com' });
        assert.deepEqual(body.to, [{ email: request.to }]);
        assert.match(body.textContent, /123456/);
        return { ok: true, json: async () => ({ messageId: 'brevo-message-id' }) };
    });
    assert.deepEqual(await sendAdminResetOtp(request), { messageId: 'brevo-message-id' });
});

test('HTTPS recovery works without SMTP credentials', async (t) => {
    setup(t, { RESEND_API_KEY: 'test-key', RESEND_FROM: 'recovery@example.com' });
    t.mock.method(nodemailer, 'createTransport', () => { throw new Error('SMTP must not run'); });
    t.mock.method(global, 'fetch', async (url, options) => {
        assert.equal(url, 'https://api.resend.com/emails');
        assert.equal(options.headers.Authorization, 'Bearer test-key');
        const body = JSON.parse(options.body);
        assert.deepEqual(body.to, [request.to]);
        assert.match(body.text, /123456/);
        return { ok: true, json: async () => ({ id: 'message-id' }) };
    });
    assert.deepEqual(await sendAdminResetOtp(request), { id: 'message-id' });
});

test('provider failures are sanitized and cannot report success', async (t) => {
    setup(t, { RESEND_API_KEY: 'test-key', RESEND_FROM: 'recovery@example.com' });
    t.mock.method(global, 'fetch', async () => ({ ok: false, status: 401 }));
    await assert.rejects(sendAdminResetOtp(request), {
        code: 'RECOVERY_EMAIL_UNAVAILABLE', providerCode: 'HTTP_401',
        message: 'Recovery email delivery is unavailable.',
    });
});

test('SMTP port 587 uses STARTTLS and closes after authentication failure', async (t) => {
    setup(t, { SMTP_PORT: '587', SMTP_USER: 'test', SMTP_PASS: 'test' });
    let closed = false;
    t.mock.method(nodemailer, 'createTransport', (options) => {
        assert.equal(options.secure, false);
        assert.equal(options.connectionTimeout, 10000);
        return {
            sendMail: async () => { throw Object.assign(new Error('secret provider details'), { code: 'EAUTH' }); },
            close: () => { closed = true; },
        };
    });
    await assert.rejects(sendAdminResetOtp(request), { code: 'RECOVERY_EMAIL_UNAVAILABLE', providerCode: 'EAUTH' });
    assert.equal(closed, true);
});

test('SMTP recipient rejection fails recovery delivery', async (t) => {
    setup(t, { SMTP_USER: 'test', SMTP_PASS: 'test' });
    t.mock.method(nodemailer, 'createTransport', (options) => {
        assert.equal(options.secure, true);
        return { sendMail: async () => ({ accepted: [], rejected: [request.to] }), close() {} };
    });
    await assert.rejects(sendAdminResetOtp(request), { code: 'RECOVERY_EMAIL_UNAVAILABLE' });
});
