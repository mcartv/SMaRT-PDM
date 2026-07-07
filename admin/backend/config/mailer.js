let nodemailer = null;

try {
    // Keep boot resilient if dependencies are not installed yet.
    nodemailer = require('nodemailer');
} catch (error) {
    console.warn('Nodemailer is not installed; email sending is disabled.');
}

const transporter = nodemailer
    ? nodemailer.createTransport({
        service: process.env.MAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        },
    })
    : null;

module.exports = {
    transporter,
};
