// SMaRT-PDM: Applications — application Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const applicationService = require('../services/applicationService');
const signingService = require('../services/applicationSigningService');

// getRequestUserId: reads and returns get request user id for the Applications flow.
function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// getSafeStatusCode: reads and returns get safe status code for the Applications flow.
function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);

    if (Number.isInteger(parsed) && parsed >= 400 && parsed <= 599) {
        return parsed;
    }

    return 500;
}

async function createSigningSession(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });
        return res.status(201).json(await signingService.createSigningSession(userId, req.body || {}));
    } catch (error) {
        return res.status(getSafeStatusCode(error)).json({ error: error.message || 'Failed to create signing session.' });
    }
}

async function getSigningSession(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });
        return res.status(200).json(await signingService.getSigningSession(userId, req.params.signingSessionId));
    } catch (error) {
        return res.status(getSafeStatusCode(error)).json({ error: error.message || 'Failed to load signing session.' });
    }
}

async function uploadSigningDocument(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });
        return res.status(200).json(await signingService.uploadSigningDocument(
            userId, req.params.signingSessionId, req.params.documentType, req.file
        ));
    } catch (error) {
        return res.status(getSafeStatusCode(error)).json({ error: error.message || 'Failed to upload signing document.' });
    }
}

// getMyFormData: reads and returns get my form data for the Applications flow.
async function getMyFormData(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await applicationService.getMyFormData(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('APPLICATION FORM DATA ROUTE ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load application form data.',
        });
    }
}

// getMySubmittedFormData: reads and returns get my submitted form data for the Applications flow.
async function getMySubmittedFormData(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await applicationService.getMySubmittedFormData(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('SUBMITTED APPLICATION FORM ROUTE ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error:
                error.message ||
                'Failed to load the submitted application form.',
        });
    }
}

async function getMySubmittedFormSignatureEvidence(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });
        res.setHeader('Cache-Control', 'no-store, private');
        return res.status(200).json(
            await applicationService.getMySubmittedFormSignatureEvidence(userId)
        );
    } catch (error) {
        console.error('SUBMITTED APPLICATION SIGNATURE EVIDENCE ROUTE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load finalized signature evidence.',
        });
    }
}

// getMyApplicationById: reads and returns get my application by id for the Applications flow.
async function getMyApplicationById(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await applicationService.getMyApplicationById(
            userId,
            req.params.applicationId
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('APPLICATION DETAIL ROUTE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load application details.',
        });
    }
}

// saveMyFormData: validates and saves save my form data for the Applications flow.
async function saveMyFormData(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await applicationService.saveMyFormData(
            userId,
            req.body || {}
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('APPLICATION FORM SAVE ROUTE ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to save application form data.',
        });
    }
}

// getMyDocuments: reads and returns get my documents for the Applications flow.
async function getMyDocuments(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await applicationService.getMyDocuments(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('APPLICATION DOCUMENTS ROUTE ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load documents.',
        });
    }
}

// getMyApplicationStatusSummary: reads and returns get my application status summary for the Applications flow.
async function getMyApplicationStatusSummary(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await applicationService.getMyApplicationStatusSummary(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('APPLICATION STATUS SUMMARY ROUTE ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load application status summary.',
        });
    }
}

// downloadMyEndorsementSlipPdf: downloads download my endorsement slip pdf for the Applications flow.
async function downloadMyEndorsementSlipPdf(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const pdf = await applicationService.downloadMyEndorsementSlipPdf(userId);
        res.setHeader('Content-Type', pdf.contentType || 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdf.fileName}"`);
        return res.status(200).send(pdf.buffer);
    } catch (error) {
        console.error('APPLICATION ENDORSEMENT SLIP PDF ROUTE ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to download endorsement slip PDF.',
        });
    }
}

// uploadMyDocument: uploads upload my document for the Applications flow.
async function uploadMyDocument(req, res) {
    try {
        const userId = getRequestUserId(req);

        console.log('UPLOAD BODY:', req.body);
        console.log('UPLOAD PARAMS:', req.params);
        console.log('UPLOAD FILE:', req.file?.originalname);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await applicationService.uploadMyDocument(
            userId,
            req.file,
            req.body || {},
            req.params || {}
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('UPLOAD DOCUMENT ROUTE ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to upload document.',
        });
    }
}

async function replaceMySigningDocument(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Authentication required.' });
        const result = await applicationService.replaceMySigningDocument(
            userId,
            req.file,
            req.params || {}
        );
        return res.status(200).json(result);
    } catch (error) {
        console.error('SIGNING DOCUMENT CORRECTION ROUTE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to replace signing document.',
        });
    }
}

// submitMyApplicationForm: handles submit my application form for the Applications flow.
async function submitMyApplicationForm(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await applicationService.submitMyApplicationForm(
            userId,
            req.body || {}
        );

        return res.status(201).json(result);
    } catch (error) {
        console.error('APPLICATION SUBMIT ROUTE ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to submit application.',
            code: error.code || undefined,
        });
    }
}

module.exports = {
    createSigningSession,
    getSigningSession,
    uploadSigningDocument,
    getMyFormData,
    getMySubmittedFormData,
    getMySubmittedFormSignatureEvidence,
    getMyApplicationById,
    saveMyFormData,
    getMyDocuments,
    getMyApplicationStatusSummary,
    downloadMyEndorsementSlipPdf,
    uploadMyDocument,
    replaceMySigningDocument,
    submitMyApplicationForm,
};
