const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function requireEnv(name) {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

function normalizeRecipients(to) {
    const recipients = Array.isArray(to) ? to : [to];

    return recipients
        .map((recipient) => {
            if (typeof recipient === 'string') {
                return { email: recipient.trim() };
            }

            if (recipient && typeof recipient === 'object') {
                const email = String(recipient.email || '').trim();
                if (!email) return null;

                return {
                    ...recipient,
                    email,
                };
            }

            return null;
        })
        .filter(Boolean);
}

async function sendMail(message = {}) {
    const apiKey = requireEnv('BREVO_API_KEY');
    const senderEmail = requireEnv('MAIL_FROM_EMAIL');
    const senderName = process.env.MAIL_FROM_NAME?.trim() || 'SMaRT-PDM';
    const recipients = normalizeRecipients(message.to);
    const from = String(message.from || '').trim() || senderEmail;
    const subject = String(message.subject || '').trim();
    const text = message.text;
    const html = message.html;

    if (!recipients.length) {
        throw new Error('At least one recipient is required');
    }
    if (!subject) {
        throw new Error('Subject is required');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;

    try {
        response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'api-key': apiKey,
        },
        body: JSON.stringify({
            sender: {
                name: senderName,
                email: from,
            },
            to: recipients,
            subject,
            ...(html ? { htmlContent: html } : {}),
            ...(text ? { textContent: text } : {}),
        }),
        signal: controller.signal,
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('Brevo email API request timed out');
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

    const responseBody = await response.text();

    if (!response.ok) {
        console.error('Brevo email API rejected request:', {
            status: response.status,
            body: responseBody,
        });
        throw new Error(
            `Brevo email API failed with HTTP ${response.status}: ${responseBody}`
        );
    }

    let responseData = {};
    if (responseBody) {
        try {
            responseData = JSON.parse(responseBody);
        } catch (error) {
            responseData = { raw: responseBody };
        }
    }

    return {
        accepted: recipients.map((recipient) => recipient.email),
        rejected: [],
        messageId: responseData.messageId || responseData.message_id || null,
        response: 'Brevo API accepted the email',
    };
}

const transporter = {
    sendMail,
};

const mailFrom = process.env.MAIL_FROM_EMAIL?.trim() || 'no-reply@smart-pdm.local';

module.exports = {
    mailFrom,
    sendMail,
    transporter,
};
