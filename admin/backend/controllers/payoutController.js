const payoutService = require('../services/payoutService');

exports.getPayoutBatches = async (req, res) => {
    try {
        const rows = await payoutService.fetchPayoutBatches();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET PAYOUT BATCHES ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to fetch payout batches',
        });
    }
};

exports.getPayoutOpenings = async (req, res) => {
    try {
        const rows = await payoutService.fetchPayoutOpenings();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET PAYOUT OPENINGS ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to fetch payout openings',
        });
    }
};

exports.getEligibleScholarsByOpening = async (req, res) => {
    try {
        const { opening_id } = req.query;

        if (!opening_id) {
            return res.status(400).json({ message: 'opening_id is required' });
        }

        const payload = await payoutService.fetchEligibleScholarsByOpening(opening_id);
        res.status(200).json(payload);
    } catch (err) {
        console.error('GET ELIGIBLE SCHOLARS BY OPENING ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to fetch eligible scholars',
        });
    }
};

exports.createPayoutBatch = async (req, res) => {
    try {
        const row = await payoutService.createPayoutBatchFromOpening(req.body);
        res.status(201).json(row);
    } catch (err) {
        console.error('CREATE PAYOUT BATCH ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to create payout batch',
        });
    }
};

exports.updateScholarStatus = async (req, res) => {
    try {
        const processed_by = req.user?.user_id || req.user?.id || null;

        const row = await payoutService.updateScholarPayoutStatus({
            payout_entry_id: req.params.payoutEntryId,
            next_status: req.body?.status,
            processed_by,
            remarks: req.body?.remarks,
            check_number: req.body?.check_number,
        });

        res.status(200).json(row);
    } catch (err) {
        console.error('UPDATE PAYOUT STATUS ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to update payout status',
        });
    }
};

exports.archivePayoutBatch = async (req, res) => {
    try {
        const archived_by = req.user?.user_id || req.user?.id || null;

        const row = await payoutService.archivePayoutBatch({
            payout_batch_id: req.params.batchId,
            archived_by,
        });

        res.status(200).json(row);
    } catch (err) {
        console.error('ARCHIVE PAYOUT BATCH ERROR:', err);
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to archive payout batch',
        });
    }
};

exports.getAcademicYears = async (req, res) => {
    try {
        const rows = await payoutService.fetchAcademicYears();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET ACADEMIC YEARS ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to fetch academic years',
        });
    }
};