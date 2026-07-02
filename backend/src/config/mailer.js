const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 8000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 8000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 10000),
    auth: {
        user: process.env.GMAIL_USER || 'pelimavenice.pdm@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

module.exports = {
    transporter,
};
