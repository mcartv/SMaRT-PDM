const nodemailer = require('nodemailer');

function getMailConfig() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = String(process.env.SMTP_SECURE ?? 'true').toLowerCase() !== 'false';

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
        auth: {
            user: config.user,
            pass: config.pass,
        },
    });
}

async function sendAdminResetOtp({ to, otp, expiresSeconds }) {
    const config = getMailConfig();
    const transporter = createTransporter();

    const info = await transporter.sendMail({
        from: `SMaRT-PDM OSFA <${config.from}>`,
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
    });

    console.log('[MAILER] accepted:', info.accepted);
    console.log('[MAILER] rejected:', info.rejected);
    console.log('[MAILER] response:', info.response);

    return info;
}

module.exports = { sendAdminResetOtp };
