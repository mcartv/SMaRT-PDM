const { GoogleGenAI } = require('@google/genai');
const { normalizeEnhancedOcrError } = require('./enhancedOcrErrors');

const PRIMARY_MODEL = String(
    process.env.INDIGENCY_OCR_MODEL
    || process.env.ENHANCED_OCR_MODEL
    || process.env.GEMINI_MODEL
    || 'gemini-3.6-flash'
).trim();
const MODELS = Object.freeze(Array.from(new Set([
    PRIMARY_MODEL,
    ...String(
        process.env.INDIGENCY_OCR_FALLBACK_MODELS
        || process.env.GEMINI_FALLBACK_MODELS
        || 'gemini-3.5-flash'
    ).split(',').map((value) => value.trim()).filter(Boolean),
])));
const API_KEY = String(process.env.ENHANCED_OCR_API_KEY || process.env.GEMINI_API_KEY || '').trim();
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function providerStatus(error) {
    return Number(
        error?.providerStatus || error?.status || error?.statusCode || error?.code
        || error?.error?.code || error?.response?.status
    ) || null;
}

function shouldTryNextModel(error) {
    const failure = normalizeEnhancedOcrError(error);
    return failure.retryable === true
        || failure.code === 'ENHANCED_OCR_MODEL_UNAVAILABLE'
        || TRANSIENT_STATUS.has(providerStatus(error));
}

function validateResult(response, schema) {
    if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        throw Object.assign(new Error(), { code: 'ENHANCED_OCR_TRUNCATED' });
    }
    const raw = typeof response.text === 'function' ? response.text() : response.text;
    if (!String(raw || '').trim()) throw Object.assign(new Error(), { code: 'ENHANCED_OCR_EMPTY_RESPONSE' });
    const result = JSON.parse(String(raw));
    if (!result || typeof result.raw_text !== 'string' || !result.fields || Array.isArray(result.fields)
        || typeof result.fields !== 'object'
        || (schema.properties.fields.required || []).some((key) => typeof result.fields[key] !== 'string')) {
        throw Object.assign(new Error(), { code: 'ENHANCED_OCR_INVALID_RESPONSE' });
    }
    if (!result.raw_text.trim() && !Object.values(result.fields).some((value) => typeof value === 'string' && value.trim())) {
        throw Object.assign(new Error(), { code: 'ENHANCED_OCR_EMPTY_RESPONSE' });
    }
    return result;
}

async function extract({ documentType, image, schema, instruction, timeoutMs, maxOutputTokens }) {
    if (!API_KEY) {
        throw normalizeEnhancedOcrError(Object.assign(
            new Error('Enhanced OCR provider is not configured'),
            { code: 'ENHANCED_OCR_NOT_CONFIGURED' }
        ));
    }

    const client = new GoogleGenAI({ apiKey: API_KEY });
    const resolvedTimeoutMs = Math.min(60000, Math.max(5000, Number.parseInt(timeoutMs, 10) || 15000));
    const resolvedMaxOutputTokens = Math.min(4096, Math.max(512, Number.parseInt(maxOutputTokens, 10) || 2048));
    let lastError = null;

    for (let index = 0; index < MODELS.length; index += 1) {
        const model = MODELS[index];
        try {
            const response = await client.models.generateContent({
                model,
                contents: [{ role: 'user', parts: [
                    { text: `${instruction}\nDocument type: ${documentType}. Return only JSON.` },
                    { inlineData: { mimeType: image.mime_type, data: image.bytes.toString('base64') } },
                ] }],
                config: {
                    responseMimeType: 'application/json',
                    responseJsonSchema: schema,
                    maxOutputTokens: resolvedMaxOutputTokens,
                    httpOptions: {
                        timeout: resolvedTimeoutMs,
                        retryOptions: {
                            attempts: 1,
                            initialDelay: 0.5,
                            maxDelay: 2,
                            expBase: 2,
                            jitter: 0.2,
                            httpStatusCodes: [408, 429, 500, 502, 503, 504],
                        },
                    },
                },
            });
            const result = validateResult(response, schema);
            if (index > 0) {
                console.info('INDIGENCY_V2_MODEL_FALLBACK', {
                    configured_model: PRIMARY_MODEL,
                    selected_model: model,
                });
            }
            return { ...result, model };
        } catch (error) {
            lastError = error;
            if (index < MODELS.length - 1 && shouldTryNextModel(error)) continue;
            throw normalizeEnhancedOcrError(error);
        }
    }

    throw normalizeEnhancedOcrError(lastError || new Error('No OCR model is available'));
}

module.exports = { extract, PRIMARY_MODEL, MODELS };
