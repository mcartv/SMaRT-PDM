const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'pelimavenice.pdm@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

module.exports = {
    transporter,
};
