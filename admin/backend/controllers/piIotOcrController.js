const iotOcrRequestService = require('../services/iotOcrRequestService');

exports.getNextIotOcrRequest = async (req, res) => {
    try {
        const result = await iotOcrRequestService.claimNextRequest({
            claimedBy: req.piAuth?.deviceId || null,
        });

        res.status(200).json({
            message: 'IoT OCR request claimed successfully',
            data: result,
        });
    } catch (err) {
        console.error('CLAIM IOT OCR REQUEST CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to claim IoT OCR request',
        });
    }
};

exports.submitIotOcrRequestResult = async (req, res) => {
    try {
        const result = await iotOcrRequestService.completeRequest({
            requestId: req.params.requestId,
            status: req.body?.status,
            rawText: req.body?.raw_text,
            ocrConfidence: req.body?.ocr_confidence,
            extractedFields: req.body?.extracted_fields,
            sourcePayload: req.body?.source_payload,
            errorMessage: req.body?.error_message,
            claimedBy: req.piAuth?.deviceId || null,
        });

        res.status(200).json({
            message: 'IoT OCR request result saved successfully',
            data: result,
        });
    } catch (err) {
        console.error('SAVE IOT OCR REQUEST RESULT CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to save IoT OCR request result',
        });
    }
};
