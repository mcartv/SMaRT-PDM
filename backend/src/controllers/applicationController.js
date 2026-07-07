const applicationService = require('../services/applicationService');

function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);

    if (Number.isInteger(parsed) && parsed >= 400 && parsed <= 599) {
        return parsed;
    }

    return 500;
}

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
        });
    }
}

module.exports = {
    getMyFormData,
    saveMyFormData,
    getMyDocuments,
    uploadMyDocument,
    submitMyApplicationForm,
};