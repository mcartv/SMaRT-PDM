const { GoogleGenAI } = require('@google/genai');

const MODEL = String(process.env.ENHANCED_OCR_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();
const API_KEY = String(process.env.ENHANCED_OCR_API_KEY || process.env.GEMINI_API_KEY || '').trim();

async function extract({ documentType, image, schema, instruction }) {
    if (!API_KEY) throw Object.assign(new Error('Enhanced OCR provider is not configured'), { code: 'ENHANCED_OCR_NOT_CONFIGURED' });
    const client = new GoogleGenAI({ apiKey: API_KEY });
    const response = await client.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [
            { text: `${instruction}\nDocument type: ${documentType}. Return only JSON.` },
            { inlineData: { mimeType: image.mime_type, data: image.bytes.toString('base64') } },
        ] }],
        config: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 4096 },
    });
    const raw = typeof response.text === 'function' ? response.text() : response.text;
    return { ...JSON.parse(String(raw || '{}')), model: MODEL };
}

module.exports = { extract, MODEL };
