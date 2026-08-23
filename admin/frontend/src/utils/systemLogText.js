const TECHNICAL_ACTION_LABELS = Object.freeze({
    RUNAPPLICATIONDOCUMENTIOTOCR: 'Start OCR Scan',
    RETRYAPPLICATIONDOCUMENTIOTOCR: 'Retry OCR Scan',
    CANCELAPPLICATIONDOCUMENTIOTOCR: 'Cancel OCR Scan',
    CONFIRMAPPLICATIONDOCUMENTIOTOCR: 'Confirm OCR Result',
    REJECTAPPLICATIONDOCUMENTIOTOCR: 'Reject OCR Result',
    RESCANAPPLICATIONDOCUMENTIOTOCR: 'Request OCR Rescan',
    SAVEAPPLICATIONDOCUMENTOCRSNAPSHOT: 'Save OCR Result',
    CHANGEOWNPASSWORD: 'Password Changed',
});

const TECHNICAL_DESCRIPTION_RULES = [
    { pattern: /retryApplicationDocumentIotOcr/i, text: 'Requested another OCR scan for an application document.' },
    { pattern: /runApplicationDocumentIotOcr/i, text: 'Started OCR scanning for an application document.' },
    { pattern: /cancelApplicationDocumentIotOcr/i, text: 'Cancelled the OCR scan request for an application document.' },
    { pattern: /confirmApplicationDocumentIotOcr/i, text: 'Confirmed the OCR result for an application document.' },
    { pattern: /rejectApplicationDocumentIotOcr/i, text: 'Rejected the OCR result for an application document.' },
    { pattern: /rescanApplicationDocumentIotOcr/i, text: 'Requested a new OCR scan for an application document.' },
    { pattern: /saveApplicationDocumentOcrSnapshot/i, text: 'Saved the OCR result for an application document.' },
];

const ACRONYMS = Object.freeze({ api: 'API', id: 'ID', iot: 'IoT', ocr: 'OCR', otp: 'OTP', pdf: 'PDF', ro: 'RO', sdo: 'SDO' });

function compactActionKey(value = '') {
    return String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function titleWord(word = '') {
    const normalized = String(word || '').toLowerCase();
    if (ACRONYMS[normalized]) return ACRONYMS[normalized];
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '';
}

function splitTechnicalWords(value = '') {
    return String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function formatSystemLogActionLabel(action = '') {
    const exact = TECHNICAL_ACTION_LABELS[compactActionKey(action)];
    if (exact) return exact;
    return splitTechnicalWords(action).split(' ').filter(Boolean).map(titleWord).join(' ') || 'System Action';
}

function isTechnicalDescription(value = '') {
    const text = String(value || '').trim();
    if (!text) return false;
    return /[a-z0-9][A-Z][A-Za-z0-9]*/.test(text) || /\b(?:applicationDocument|iotOcr|requestId|documentKey|actionTaken)\b/i.test(text) || /\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/.test(text);
}

function sentenceFromAction(item = {}) {
    const action = String(item.action_taken || '').trim();
    const key = compactActionKey(action);
    const moduleName = String(item.module || '').trim();
    if (key === 'LOGINSUCCESS') return 'Signed in successfully.';
    if (key === 'LOGOUT') return 'Signed out successfully.';
    if (key === 'PASSWORDRESET') return 'Reset the account password.';
    if (key === 'IMPORTSTUDENTREGISTRY') return 'Imported student registry records.';
    const label = formatSystemLogActionLabel(action);
    if (label === 'System Action') return moduleName ? moduleName + ' activity was completed successfully.' : 'System activity was completed successfully.';
    return label + ' was completed successfully.';
}

export function formatSystemLogDescription(item = {}) {
    const description = String(item.description || '').trim();
    const action = String(item.action_taken || '').trim();
    const combined = action + ' ' + description;
    for (const rule of TECHNICAL_DESCRIPTION_RULES) if (rule.pattern.test(combined)) return rule.text;
    if (description && !isTechnicalDescription(description)) return description;
    return sentenceFromAction(item);
}
