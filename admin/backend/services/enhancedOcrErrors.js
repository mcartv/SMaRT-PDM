// Only fixed messages cross the provider boundary: never persist response text,
// request contents, API keys, or SDK URLs in applicant records or logs.
const MESSAGES = {
    ENHANCED_OCR_NOT_CONFIGURED: 'Enhanced OCR is not configured. Ask the administrator to configure the OCR provider key.',
    ENHANCED_OCR_SDK_UNAVAILABLE: 'Enhanced OCR dependencies are unavailable. Redeploy the backend with its dependencies.',
    ENHANCED_OCR_AUTH_FAILED: 'The OCR provider rejected its credentials. Ask the administrator to check the provider key and permissions.',
    ENHANCED_OCR_RATE_LIMITED: 'The OCR provider quota or rate limit was reached. Check quota, then retry the scan.',
    ENHANCED_OCR_MODEL_UNAVAILABLE: 'The configured OCR model is unavailable. Ask the administrator to check the model setting.',
    ENHANCED_OCR_INVALID_REQUEST: 'The OCR provider rejected the image or output schema. Ask the administrator to check the extraction configuration.',
    ENHANCED_OCR_TIMEOUT: 'The OCR provider timed out. Retry the scan.',
    ENHANCED_OCR_TRUNCATED: 'The OCR response was cut short before extraction finished. Retry the scan.',
    ENHANCED_OCR_INVALID_RESPONSE: 'The OCR provider returned an incomplete or invalid result. Retry the scan.',
    ENHANCED_OCR_EMPTY_RESPONSE: 'The OCR provider returned no readable result. Check the captured image and retry the scan.',
    ENHANCED_OCR_PROVIDER_FAILED: 'The OCR provider could not complete extraction. Retry the scan.',
};

function normalizeEnhancedOcrError(error) {
    const providerStatus = Number(error?.providerStatus || error?.status || error?.statusCode || error?.code) || null;
    let code = Object.hasOwn(MESSAGES, error?.code) ? error.code : null;
    if (!code) {
        code = error?.code === 'MODULE_NOT_FOUND' ? 'ENHANCED_OCR_SDK_UNAVAILABLE'
            : [401, 403].includes(providerStatus) ? 'ENHANCED_OCR_AUTH_FAILED'
                : providerStatus === 429 ? 'ENHANCED_OCR_RATE_LIMITED'
                    : providerStatus === 404 ? 'ENHANCED_OCR_MODEL_UNAVAILABLE'
                        : providerStatus === 400 ? 'ENHANCED_OCR_INVALID_REQUEST'
                            : error?.name === 'AbortError' || error?.name === 'TimeoutError' || providerStatus === 504 ? 'ENHANCED_OCR_TIMEOUT'
                                : error?.name === 'SyntaxError' ? 'ENHANCED_OCR_INVALID_RESPONSE'
                                    : 'ENHANCED_OCR_PROVIDER_FAILED';
    }
    return Object.assign(new Error(MESSAGES[code]), { code, statusCode: 502, providerStatus });
}

module.exports = { normalizeEnhancedOcrError };
