const payoutService = require('../services/payoutService');

exports.getPayoutBatches = async (req, res) => {
    try {
        const rows = await payoutService.fetchPayoutBatches();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET PAYOUT BATCHES ERROR:', err);
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to fetch payout batches',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.getPayoutOpenings = async (req, res) => {
    try {
        const rows = await payoutService.fetchPayoutOpenings();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET PAYOUT OPENINGS ERROR:', err);
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to fetch payout openings',
            error: err.message || 'Unknown backend error',
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
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to fetch eligible scholars',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.createPayoutBatch = async (req, res) => {
    try {
        const row = await payoutService.createPayoutBatchFromOpening(req.body);

        const io = req.app.get('io');
        if (io) {
            io.emit('payout:created', {
                payout_batch_id: row.payout_batch_id,
                payout_title: row.payout_title,
                total_amount: row.total_amount,
                created_at: new Date().toISOString(),
            });
        }

        res.status(201).json(row);
    } catch (err) {
        console.error('CREATE PAYOUT BATCH ERROR:', err);
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to create payout batch',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.updateScholarStatus = async (req, res) => {
    console.log('PAYOUT STATUS ROUTE HIT:', {
        payoutEntryId: req.params.payoutEntryId,
        body: req.body,
    });
    console.log('PAYOUT STATUS UPDATED ROW:', row);
    try {
        const { payoutEntryId } = req.params;
        const { status } = req.body;

        if (!payoutEntryId) {
            return res.status(400).json({ message: 'payoutEntryId is required' });
        }

        const allowed = ['Pending', 'Released', 'Absent', 'On Hold', 'Cancelled'];

        if (!allowed.includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const updatePayload = {
            release_status: status,
            updated_at: new Date().toISOString(),
        };

        if (status === 'Released') {
            updatePayload.released_at = new Date().toISOString();
        }

        const { data, error } = await require('../config/supabase')
            .from('payout_batch_students')
            .update(updatePayload)
            .eq('payout_entry_id', payoutEntryId)
            .select('*')
            .single();

        if (error) throw error;

        res.status(200).json(data);

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

        const io = req.app.get('io');
        if (io) {
            io.emit('payout:deleted', {
                payout_batch_id: req.params.batchId,
                archived_at: new Date().toISOString(),
            });
        }

        res.status(200).json(row);
    } catch (err) {
        console.error('ARCHIVE PAYOUT BATCH ERROR:', err);
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to archive payout batch',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.getAcademicYears = async (req, res) => {
    try {
        const rows = await payoutService.fetchAcademicYears();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET ACADEMIC YEARS ERROR:', err);
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to fetch academic years',
            error: err.message || 'Unknown backend error',
        });
    }
};