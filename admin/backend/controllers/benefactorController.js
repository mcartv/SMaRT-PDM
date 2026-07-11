const benefactorService = require('../services/benefactorService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

exports.getBenefactors = async (req, res) => {
    try {
        const benefactors = await benefactorService.getBenefactors();

        res.status(200).json(benefactors);
    } catch (err) {
        console.error('GET BENEFACTORS CONTROLLER ERROR:', err);

        res.status(500).json({
            message: err.message || 'Failed to fetch benefactors',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.createBenefactor = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: 'CREATE_BENEFACTOR',
        module: 'Benefactors',
        entityType: 'benefactor',
        entityId: benefactor?.benefactor_id || null,
        description: `Created benefactor: ${benefactor?.benefactor_name || 'Unknown benefactor'}.`,
        metadata: {
            benefactor_id: benefactor?.benefactor_id || null,
            benefactor_name: benefactor?.benefactor_name || null,
            benefactor_type: benefactor?.benefactor_type || null,
        },
    });

    try {
        const created = await benefactorService.createBenefactor(req.body);
        const io = req.app.get('io');
        socketEvents.maintenanceUpdated(io, {
            module: 'benefactors',
            action: 'create',
            id: created?.benefactor_id ?? created?.id ?? null,
            updated_at: new Date().toISOString(),
        });

        res.status(201).json(created);
    } catch (err) {
        console.error('CREATE BENEFACTOR CONTROLLER ERROR:', err);

        res.status(500).json({
            message: err.message || 'Failed to create benefactor',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.updateBenefactor = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: 'UPDATE_BENEFACTOR',
        module: 'Benefactors',
        entityType: 'benefactor',
        entityId: benefactor?.benefactor_id || req.params.id,
        description: `Updated benefactor: ${benefactor?.benefactor_name || req.params.id}.`,
        metadata: {
            benefactor_id: benefactor?.benefactor_id || req.params.id,
            changes: req.body,
        },
    });
    
    try {
        const { benefactorId } = req.params;
        const updated = await benefactorService.updateBenefactor(benefactorId, req.body);

        if (!updated) {
            return res.status(404).json({
                message: 'Benefactor not found',
                error: 'Benefactor not found',
            });
        }

        const io = req.app.get('io');
        socketEvents.maintenanceUpdated(io, {
            module: 'benefactors',
            action: 'update',
            id: benefactorId,
            updated_at: new Date().toISOString(),
        });
        res.status(200).json(updated);
    } catch (err) {
        console.error('UPDATE BENEFACTOR CONTROLLER ERROR:', err);

        res.status(500).json({
            message: err.message || 'Failed to update benefactor',
            error: err.message || 'Unknown backend error',
        });
    }
};
