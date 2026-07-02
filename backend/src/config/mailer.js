const nodemailer = require('nodemailer');

const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

function getPositiveIntegerEnv(name, fallback) {
    const value = Number.parseInt(process.env[name], 10);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: getPositiveIntegerEnv('SMTP_CONNECTION_TIMEOUT_MS', 8000),
    greetingTimeout: getPositiveIntegerEnv('SMTP_GREETING_TIMEOUT_MS', 8000),
    socketTimeout: getPositiveIntegerEnv('SMTP_SOCKET_TIMEOUT_MS', 10000),
    auth: {
        user: process.env.GMAIL_USER || 'pelimavenice.pdm@gmail.com',
        pass: gmailAppPassword || undefined,
    },
});

module.exports = {
    transporter,
};
