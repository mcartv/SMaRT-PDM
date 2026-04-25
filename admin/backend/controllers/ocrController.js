const ocrJobService = require('../services/ocrJobService');

exports.createOcrJob = async (req, res) => {
    try {
        const result = await ocrJobService.createJob({
            applicationId: req.body?.application_id,
            documentKey: req.body?.document_key,
            requestedBy: req.user?.userId || req.user?.user_id || null,
        });

        res.status(result.created ? 201 : 200).json({
            message: result.created
                ? 'OCR job queued successfully'
                : 'OCR job already queued',
            data: result,
        });
    } catch (err) {
        console.error('CREATE OCR JOB CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to queue OCR job',
        });
    }
};
