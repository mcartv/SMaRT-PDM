const https = require('https');
const nodemailer = require('nodemailer');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_SENDER_EMAIL = 'pelimavenice.pdm@gmail.com';
const DEFAULT_SENDER_NAME = 'SMaRT-PDM Admin';

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function stripPasswordWhitespace(value) {
    return safeText(value).replace(/\s+/g, '');
}

function parseAddress(value, fallbackName = DEFAULT_SENDER_NAME) {
    const raw = safeText(value);
    const match = raw.match(/^(?:"?([^"<]*)"?)?\s*<([^>]+)>$/);

    if (match) {
        return {
            name: safeText(match[1]) || fallbackName,
            email: safeText(match[2]),
        };
    }

    return {
        name: fallbackName,
        email: raw,
    };
}

function normalizeRecipients(value) {
    const values = Array.isArray(value) ? value : String(value || '').split(',');

    return values
        .map((recipient) => {
            if (recipient && typeof recipient === 'object') {
                return {
                    name: safeText(recipient.name),
                    email: safeText(recipient.address || recipient.email),
                };
            }
            return parseAddress(recipient, '');
        })
        .filter((recipient) => recipient.email)
        .map((recipient) => ({
            email: recipient.email,
            ...(recipient.name ? { name: recipient.name } : {}),
        }));
}

function buildMailFrom() {
    const senderEmail =
        safeText(process.env.TRANSACTIONAL_EMAIL_FROM) ||
        safeText(process.env.GMAIL_USER) ||
        DEFAULT_SENDER_EMAIL;
    const senderName =
        safeText(process.env.TRANSACTIONAL_EMAIL_FROM_NAME) ||
        DEFAULT_SENDER_NAME;

    return `"${senderName}" <${senderEmail}>`;
}

const mailFrom = buildMailFrom();
const defaultSender = parseAddress(mailFrom);

function postJson(url, payload, headers = {}) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const request = https.request(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    ...headers,
                },
                timeout: Number.parseInt(process.env.EMAIL_HTTP_TIMEOUT_MS, 10) || 10000,
            },
            (response) => {
                const chunks = [];

                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => {
                    const responseBody = Buffer.concat(chunks).toString('utf8');

                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        resolve({
                            statusCode: response.statusCode,
                            body: responseBody,
                        });
                        return;
                    }

                    const error = new Error(`Brevo email send failed with status ${response.statusCode}`);
                    error.statusCode = response.statusCode;
                    error.provider = 'brevo';
                    error.responseBody = responseBody;
                    reject(error);
                });
            }
        );

        request.on('timeout', () => {
            request.destroy(new Error('Brevo email request timed out.'));
        });
        request.on('error', reject);
        request.write(body);
        request.end();
    });
}

async function sendWithBrevo(mailOptions = {}) {
    const apiKey = safeText(process.env.BREVO_API_KEY);
    if (!apiKey) {
        const error = new Error('BREVO_API_KEY is not configured.');
        error.code = 'BREVO_NOT_CONFIGURED';
        throw error;
    }

    const from = parseAddress(mailOptions.from || mailFrom, defaultSender.name);
    const to = normalizeRecipients(mailOptions.to);

    if (!to.length) {
        throw new Error('At least one email recipient is required.');
    }

    const payload = {
        sender: {
            name: from.name || defaultSender.name,
            email: from.email || defaultSender.email,
        },
        to,
        subject: safeText(mailOptions.subject),
        htmlContent: mailOptions.html || undefined,
        textContent: mailOptions.text || undefined,
    };

    if (!payload.subject) {
        throw new Error('Email subject is required.');
    }

    if (!payload.htmlContent && !payload.textContent) {
        throw new Error('Email body is required.');
    }

    const result = await postJson(BREVO_API_URL, payload, { 'api-key': apiKey });

    return {
        provider: 'brevo',
        response: result.body,
        messageId: null,
    };
}

function createGmailFallbackTransporter() {
    const user = safeText(process.env.GMAIL_USER);
    const pass = stripPasswordWhitespace(
        process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS
    );

    if (!user || !pass) return null;

    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        connectionTimeout: Number.parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10) || 8000,
        greetingTimeout: Number.parseInt(process.env.SMTP_GREETING_TIMEOUT_MS, 10) || 8000,
        socketTimeout: Number.parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS, 10) || 10000,
    });
}

const gmailFallbackTransporter = createGmailFallbackTransporter();

async function sendWithGmailFallback(mailOptions = {}) {
    if (!gmailFallbackTransporter) {
        const error = new Error('Gmail fallback email is not configured.');
        error.code = 'GMAIL_FALLBACK_NOT_CONFIGURED';
        throw error;
    }

    const result = await gmailFallbackTransporter.sendMail({
        ...mailOptions,
        from: mailOptions.from || mailFrom,
    });

    return {
        provider: 'gmail_fallback',
        response: result.response,
        messageId: result.messageId,
    };
}

async function sendMail(mailOptions = {}) {
    try {
        return await sendWithBrevo(mailOptions);
    } catch (brevoError) {
        if (!gmailFallbackTransporter) {
            throw brevoError;
        }

        // Brevo remains the primary provider; Gmail is only a continuity fallback.
        console.error('BREVO EMAIL SEND ERROR, USING GMAIL FALLBACK:', {
            message: brevoError.message,
            statusCode: brevoError.statusCode,
            code: brevoError.code,
        });

        return sendWithGmailFallback(mailOptions);
    }
}

module.exports = {
    mailFrom,
    sendMail,
    transporter: { sendMail },
};
