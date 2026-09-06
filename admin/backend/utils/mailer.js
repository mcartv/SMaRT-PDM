const nodemailer = require('nodemailer');

function getMailConfig() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = process.env.SMTP_SECURE
        ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
        : port === 465;

    const user =
        process.env.SMTP_USER ||
        process.env.GMAIL_USER ||
        process.env.EMAIL_USER;

    const pass =
        process.env.SMTP_PASS ||
        process.env.GMAIL_APP_PASSWORD ||
        process.env.EMAIL_PASS;

    const from =
        process.env.SMTP_FROM ||
        process.env.EMAIL_FROM ||
        user;

    if (!user || !pass) {
        throw new Error(
            'SMTP credentials are missing. Set SMTP_USER and SMTP_PASS, or GMAIL_USER and GMAIL_APP_PASSWORD.'
        );
    }

    return { host, port, secure, user, pass, from };
}

function createTransporter() {
    const config = getMailConfig();

    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
            user: config.user,
            pass: config.pass,
        },
    });
}

async function sendAdminResetOtp({ to, otp, expiresSeconds }) {
    try {
        return await deliverAdminResetOtp({ to, otp, expiresSeconds });
    } catch (cause) {
        // Do not expose provider responses, credentials, or email contents.
        const error = new Error('Recovery email delivery is unavailable.');
        error.code = 'RECOVERY_EMAIL_UNAVAILABLE';
        error.providerCode = cause.code || cause.name;
        throw error;
    }
}

async function deliverAdminResetOtp({ to, otp, expiresSeconds }) {
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const config = brevoApiKey
        ? { from: process.env.MAIL_FROM_EMAIL }
        : resendApiKey
        ? { from: process.env.RESEND_FROM || process.env.EMAIL_FROM }
        : getMailConfig();
    if (!config.from) throw new Error('Recovery email sender is missing.');

    const message = {
        from: config.from.includes('<') ? config.from : `SMaRT-PDM OSFA <${config.from}>`,
        to,
        subject: 'SMaRT-PDM Admin Password Reset Code',
        text: `Your SMaRT-PDM admin password reset code is ${otp}. It expires in ${expiresSeconds} seconds. If you did not request this, ignore this email.`,
        html: `
        <div style="font-family: Arial, sans-serif; color: #292524; line-height: 1.6;">
            <h2 style="color: #7c4a2e; margin-bottom: 8px;">SMaRT-PDM Admin Recovery</h2>
            <p>Your password reset code is:</p>
            <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #7c4a2e; margin: 16px 0;">
                ${otp}
            </div>
            <p>This code expires in <strong>${expiresSeconds} seconds</strong>.</p>
            <p style="font-size: 12px; color: #78716c;">If you did not request this, ignore this email.</p>
        </div>
    `,
    };

    if (brevoApiKey) {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'api-key': brevoApiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sender: {
                    name: process.env.MAIL_FROM_NAME?.trim() || 'SMaRT-PDM OSFA',
                    email: config.from.trim(),
                },
                to: [{ email: to }],
                subject: message.subject,
                textContent: message.text,
                htmlContent: message.html,
            }),
            signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
            const error = new Error('Email provider rejected the request.');
            error.code = `HTTP_${response.status}`;
            throw error;
        }
        const result = await response.json();
        if (!result.messageId) throw new Error('Email provider did not confirm acceptance.');
        return result;
    }

    if (resendApiKey) {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...message, to: [to] }),
            signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
            const error = new Error('Email provider rejected the request.');
            error.code = `HTTP_${response.status}`;
            throw error;
        }
        const result = await response.json();
        if (!result.id) throw new Error('Email provider did not confirm acceptance.');
        return result;
    }

    const transporter = createTransporter();
    try {
        const info = await transporter.sendMail(message);
        if (!info.accepted?.length) throw new Error('Email recipient was not accepted.');
        return info;
    } finally {
        transporter.close();
    }
}

module.exports = { sendAdminResetOtp };
