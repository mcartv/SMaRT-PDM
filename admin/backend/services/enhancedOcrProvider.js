const { GoogleGenAI } = require('@google/genai');
const { normalizeEnhancedOcrError } = require('./enhancedOcrErrors');

const MODEL = String(process.env.ENHANCED_OCR_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();
const API_KEY = String(process.env.ENHANCED_OCR_API_KEY || process.env.GEMINI_API_KEY || '').trim();

async function extract({ documentType, image, schema, instruction }) {
    try {
        if (!API_KEY) throw Object.assign(new Error('Enhanced OCR provider is not configured'), { code: 'ENHANCED_OCR_NOT_CONFIGURED' });
        const client = new GoogleGenAI({ apiKey: API_KEY });
        const response = await client.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [
                { text: `${instruction}\nDocument type: ${documentType}. Return only JSON.` },
                { inlineData: { mimeType: image.mime_type, data: image.bytes.toString('base64') } },
            ] }],
            config: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 16384, httpOptions: { timeout: 120000 } },
        });
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
        return { ...result, model: MODEL };
    } catch (error) {
        throw normalizeEnhancedOcrError(error);
    }
}

module.exports = { extract, MODEL };
