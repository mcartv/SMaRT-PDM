// SMaRT-PDM: email Validation — email Validation (mobile backend); supports mobile API behavior.
const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const COMMON_GMAIL_TYPO_DOMAINS = new Set([
    'gmai.com',
    'gamil.com',
    'gmial.com',
    'gmali.com',
    'gmal.com',
    'gmaill.com',
    'gmail.co',
    'gmail.cm',
    'gmail.cmo',
    'gmail.con',
    'gmail.comm',
    'gmail.om',
    'gnail.com',
]);

const EMAIL_FORMAT_ERROR = 'Enter a valid email address.';
const GMAIL_TYPO_ERROR = 'Check the email domain. Did you mean @gmail.com?';

// normalizeEmail: normalizes normalize email for the email Validation flow.
function normalizeEmail(value = '') {
    return String(value || '').trim().toLowerCase();
}

// getEmailDomain: reads and returns get email domain for the email Validation flow.
function getEmailDomain(value = '') {
    return normalizeEmail(value).split('@')[1] || '';
}

// validateEmail: validates validate email for the email Validation flow.
function validateEmail(value = '') {
    const email = normalizeEmail(value);

    if (!EMAIL_FORMAT_PATTERN.test(email)) {
        return {
            valid: false,
            email,
            error: EMAIL_FORMAT_ERROR,
        };
    }

    if (COMMON_GMAIL_TYPO_DOMAINS.has(getEmailDomain(email))) {
        return {
            valid: false,
            email,
            error: GMAIL_TYPO_ERROR,
        };
    }

    return {
        valid: true,
        email,
        error: null,
    };
}

// isValidEmail: checks whether is valid email for the email Validation flow.
function isValidEmail(value = '') {
    return validateEmail(value).valid;
}

module.exports = {
    COMMON_GMAIL_TYPO_DOMAINS,
    EMAIL_FORMAT_ERROR,
    GMAIL_TYPO_ERROR,
    isValidEmail,
    normalizeEmail,
    validateEmail,
};
