const ocrJobService = require('../services/ocrJobService');

exports.getNextOcrJob = async (req, res) => {
    try {
        const result = await ocrJobService.claimNextJob({
            claimedBy: req.piAuth?.deviceId || null,
        });

        res.status(200).json({
            message: 'OCR job claimed successfully',
            data: result,
        });
    } catch (err) {
        console.error('CLAIM OCR JOB CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to claim OCR job',
        });
    }
};

exports.submitOcrJobResult = async (req, res) => {
    try {
        const result = await ocrJobService.completeJob({
            jobId: req.params.id,
            status: req.body?.status,
            rawText: req.body?.raw_text,
            ocrConfidence: req.body?.ocr_confidence,
            extractedFields: req.body?.extracted_fields,
            sourcePayload: req.body?.source_payload,
            errorMessage: req.body?.error_message,
            claimedBy: req.piAuth?.deviceId || null,
        });

        res.status(200).json({
            message: 'OCR job result saved successfully',
            data: result,
        });
    } catch (err) {
        console.error('SAVE OCR JOB RESULT CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to save OCR job result',
        });
    }
};
