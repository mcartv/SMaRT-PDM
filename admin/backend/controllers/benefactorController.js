const benefactorService = require('../services/benefactorService');
const scholarshipProgramService = require('../services/scholarshipProgramService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function sendError(res, err, fallbackMessage) {
    const message = err?.message || fallbackMessage;
    const statusCode = Number(err?.statusCode || err?.status || 500);

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
        message,
        error: message,
    });
}

async function safeAudit(payload) {
    try {
        await auditLogService.logAudit(payload);
    } catch (error) {
        console.error('BENEFACTOR AUDIT LOG ERROR:', error.message);
    }
}

function emitMaintenanceUpdated(req, payload) {
    const io = req.app.get('io');
    socketEvents.maintenanceUpdated(io, {
        ...payload,
        updated_at: new Date().toISOString(),
    });
}

exports.getBenefactors = async (req, res) => {
    try {
        const benefactors = await benefactorService.getBenefactors();
        return res.status(200).json(benefactors);
    } catch (err) {
        console.error('GET BENEFACTORS CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch benefactors');
    }
};

exports.getPublicBenefactors = async (req, res) => {
    try {
        const benefactors = await benefactorService.getPublicBenefactors();
        return res.status(200).json(benefactors);
    } catch (err) {
        console.error('GET PUBLIC BENEFACTORS CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch benefactors');
    }
};

exports.createBenefactor = async (req, res) => {
    try {
        const created = await benefactorService.createBenefactor(req.body);

        await safeAudit({
            req,
            actionTaken: 'CREATE_BENEFACTOR',
            module: 'Maintenance - Scholarship Programs',
            entityType: 'benefactor',
            entityId: created?.benefactor_id || null,
            description: `Created benefactor: ${created?.benefactor_name || 'Unknown benefactor'}.`,
            metadata: {
                benefactor_id: created?.benefactor_id || null,
                benefactor_name: created?.benefactor_name || null,
                benefactor_type: created?.benefactor_type || null,
            },
        });

        emitMaintenanceUpdated(req, {
            module: 'scholarship-programs',
            action: 'create-benefactor',
            id: created?.benefactor_id ?? null,
        });

        return res.status(201).json(created);
    } catch (err) {
        console.error('CREATE BENEFACTOR CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to create benefactor');
    }
};

exports.createBenefactorWithProgram = async (req, res) => {
    let createdBenefactor = null;

    try {
        const benefactorPayload = req.body?.benefactor || {};
        const programPayload = req.body?.program || {};

        createdBenefactor = await benefactorService.createBenefactor({
            ...benefactorPayload,
            is_archived: false,
        });

        const createdProgram =
            await scholarshipProgramService.createScholarshipProgram({
                ...programPayload,
                benefactor_id: createdBenefactor.benefactor_id,
                is_archived: false,
            });

        await safeAudit({
            req,
            actionTaken: 'CREATE_BENEFACTOR_WITH_PROGRAM',
            module: 'Maintenance - Scholarship Programs',
            entityType: 'benefactor',
            entityId: createdBenefactor.benefactor_id,
            description: `Created benefactor ${createdBenefactor.benefactor_name} with program ${createdProgram.program_name}.`,
            metadata: {
                benefactor_id: createdBenefactor.benefactor_id,
                benefactor_name: createdBenefactor.benefactor_name,
                program_id: createdProgram.program_id,
                program_name: createdProgram.program_name,
            },
        });

        emitMaintenanceUpdated(req, {
            module: 'scholarship-programs',
            action: 'create-benefactor-with-program',
            id: createdBenefactor.benefactor_id,
            program_id: createdProgram.program_id,
        });

        return res.status(201).json({
            benefactor: createdBenefactor,
            program: createdProgram,
        });
    } catch (err) {
        if (createdBenefactor?.benefactor_id) {
            try {
                await benefactorService.deleteBenefactor(createdBenefactor.benefactor_id);
            } catch (rollbackError) {
                console.error(
                    'CREATE BENEFACTOR WITH PROGRAM ROLLBACK ERROR:',
                    rollbackError
                );
            }
        }

        console.error('CREATE BENEFACTOR WITH PROGRAM ERROR:', err);
        return sendError(
            res,
            err,
            'Failed to create benefactor and scholarship program'
        );
    }
};

exports.updateBenefactor = async (req, res) => {
    try {
        const benefactorId = req.params.id;

        const updated = await benefactorService.updateBenefactor(
            benefactorId,
            req.body
        );

        if (!updated) {
            return res.status(404).json({
                message: 'Benefactor not found',
                error: 'Benefactor not found',
            });
        }

        await safeAudit({
            req,
            actionTaken: updated.is_archived
                ? 'ARCHIVE_BENEFACTOR'
                : 'UPDATE_BENEFACTOR',
            module: 'Maintenance - Scholarship Programs',
            entityType: 'benefactor',
            entityId: updated.benefactor_id,
            description: `Updated benefactor: ${updated.benefactor_name}.`,
            metadata: {
                benefactor_id: updated.benefactor_id,
                changes: req.body,
            },
        });

        emitMaintenanceUpdated(req, {
            module: 'scholarship-programs',
            action: 'update-benefactor',
            id: updated.benefactor_id,
        });

        return res.status(200).json(updated);
    } catch (err) {
        console.error('UPDATE BENEFACTOR CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to update benefactor');
    }
};
