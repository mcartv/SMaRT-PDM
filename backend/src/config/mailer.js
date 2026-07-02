const nodemailer = require('nodemailer');
const dns = require('dns');
const net = require('net');
const tls = require('tls');

const GMAIL_SMTP_HOST = 'smtp.gmail.com';
const GMAIL_IMPLICIT_TLS_PORT = 465;
const GMAIL_STARTTLS_PORT = 587;

const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

function getPositiveIntegerEnv(name, fallback) {
    const value = Number.parseInt(process.env[name], 10);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

function resolveGmailIpv4(callback) {
    dns.resolve4(GMAIL_SMTP_HOST, (dnsError, addresses) => {
        if (dnsError) {
            return callback(dnsError);
        }

        const host = addresses?.[0];
        if (!host) {
            return callback(new Error(`No IPv4 address found for ${GMAIL_SMTP_HOST}`));
        }

        return callback(null, host);
    });
}

function createGmailImplicitTlsIpv4Socket(options, callback) {
    resolveGmailIpv4((dnsError, host) => {
        if (dnsError) {
            return callback(dnsError);
        }

        let settled = false;
        const finish = (error, socketOptions = null) => {
            if (settled) return;
            settled = true;
            socket.removeListener('secureConnect', onSecureConnect);
            socket.removeListener('error', onError);
            socket.removeListener('timeout', onTimeout);
            return callback(error, socketOptions);
        };

        const onSecureConnect = () => {
            socket.setTimeout(0);
            finish(null, {
                connection: socket,
                secured: true,
            });
        };

        const onError = (error) => {
            finish(error);
        };

        const onTimeout = () => {
            socket.destroy();
            finish(new Error(`Timed out connecting to ${GMAIL_SMTP_HOST} over IPv4`));
        };

        const socket = tls.connect({
            host,
            port: GMAIL_IMPLICIT_TLS_PORT,
            servername: GMAIL_SMTP_HOST,
        });

        socket.setTimeout(options.connectionTimeout || 8000);
        socket.once('secureConnect', onSecureConnect);
        socket.once('error', onError);
        socket.once('timeout', onTimeout);
    });
}

function createGmailStartTlsIpv4Socket(options, callback) {
    resolveGmailIpv4((dnsError, host) => {
        if (dnsError) {
            return callback(dnsError);
        }

        let settled = false;
        const finish = (error, socketOptions = null) => {
            if (settled) return;
            settled = true;
            socket.removeListener('connect', onConnect);
            socket.removeListener('error', onError);
            socket.removeListener('timeout', onTimeout);
            return callback(error, socketOptions);
        };

        const onConnect = () => {
            socket.setTimeout(0);
            finish(null, {
                connection: socket,
            });
        };

        const onError = (error) => {
            finish(error);
        };

        const onTimeout = () => {
            socket.destroy();
            finish(new Error(`Timed out connecting to ${GMAIL_SMTP_HOST} over IPv4`));
        };

        const socket = net.connect({
            host,
            port: GMAIL_STARTTLS_PORT,
        });

        socket.setTimeout(options.connectionTimeout || 8000);
        socket.once('connect', onConnect);
        socket.once('error', onError);
        socket.once('timeout', onTimeout);
    });
}

function shouldRetryWithStartTls(error) {
    return (
        error?.command === 'CONN' ||
        ['ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'ETLS'].includes(error?.code)
    );
}

const implicitTlsTransporter = nodemailer.createTransport({
    host: GMAIL_SMTP_HOST,
    port: GMAIL_IMPLICIT_TLS_PORT,
    secure: true,
    connectionTimeout: getPositiveIntegerEnv('SMTP_CONNECTION_TIMEOUT_MS', 8000),
    greetingTimeout: getPositiveIntegerEnv('SMTP_GREETING_TIMEOUT_MS', 8000),
    socketTimeout: getPositiveIntegerEnv('SMTP_SOCKET_TIMEOUT_MS', 10000),
    getSocket: createGmailImplicitTlsIpv4Socket,
    auth: {
        user: process.env.GMAIL_USER || 'pelimavenice.pdm@gmail.com',
        pass: gmailAppPassword || undefined,
    },
});

const startTlsTransporter = nodemailer.createTransport({
    host: GMAIL_SMTP_HOST,
    port: GMAIL_STARTTLS_PORT,
    secure: false,
    requireTLS: true,
    connectionTimeout: getPositiveIntegerEnv('SMTP_CONNECTION_TIMEOUT_MS', 8000),
    greetingTimeout: getPositiveIntegerEnv('SMTP_GREETING_TIMEOUT_MS', 8000),
    socketTimeout: getPositiveIntegerEnv('SMTP_SOCKET_TIMEOUT_MS', 10000),
    getSocket: createGmailStartTlsIpv4Socket,
    tls: {
        servername: GMAIL_SMTP_HOST,
    },
    auth: {
        user: process.env.GMAIL_USER || 'pelimavenice.pdm@gmail.com',
        pass: gmailAppPassword || undefined,
    },
});

const transporter = {
    async sendMail(mailOptions) {
        try {
            return await implicitTlsTransporter.sendMail(mailOptions);
        } catch (error) {
            if (!shouldRetryWithStartTls(error)) {
                throw error;
            }

            console.error('GMAIL IMPLICIT TLS SEND ERROR, RETRYING STARTTLS:', error);
            return startTlsTransporter.sendMail(mailOptions);
        }
    },
};

module.exports = {
    transporter,
};
