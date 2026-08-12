const academicYearService = require('../services/academicYearService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function sendError(res, err, fallbackMessage) {
    const message =
        err?.message ||
        fallbackMessage ||
        'Unknown backend error';

    const statusCode =
        Number(err?.statusCode || err?.status) ||
        (message.toLowerCase().includes('not found')
            ? 404
            : 500);

    return res.status(
        statusCode >= 400 && statusCode <= 599
            ? statusCode
            : 500
    ).json({
        message,
        error: message,
    });
}

function actorUserId(req) {
    return (
        req.user?.user_id ||
        req.user?.userId ||
        req.user?.id ||
        req.user?.sub ||
        null
    );
}

function emitAcademicUpdate(
    req,
    action,
    {
        academicYear = null,
        period = null,
        cycleSummary = null,
    } = {}
) {
    const io = req.app.get('io');

    const payload = {
        module: period
            ? 'academic_periods'
            : 'academic_years',
        action,
        id:
            period?.period_id ||
            academicYear?.academic_year_id ||
            null,
        academic_year: academicYear,
        academic_period: period,
        cycle_summary: cycleSummary,
        updated_at: new Date().toISOString(),
    };

    if (socketEvents?.maintenanceUpdated) {
        socketEvents.maintenanceUpdated(io, payload);
    } else if (io) {
        io.emit('maintenance:updated', payload);
    }

    if (socketEvents?.renewalUpdated && period) {
        socketEvents.renewalUpdated(io, {
            action: 'period_changed',
            source: 'academic-period',
            period_id: period.period_id,
            academic_year_id:
                period.academic_year_id,
            updated_at: payload.updated_at,
        });
    }

    if (socketEvents?.dashboardUpdated && period) {
        socketEvents.dashboardUpdated(io, {
            source: 'academic-period',
            action,
            period_id: period.period_id,
        });
    }

    if (io && period) {
        io.emit('ro:updated', {
            action: 'period_changed',
            source: 'academic-period',
            period_id: period.period_id,
            academic_year_id:
                period.academic_year_id,
            updated_at: payload.updated_at,
        });
    }
}

async function writeAudit(
    req,
    actionTaken,
    description,
    {
        entityType,
        entityId,
        metadata = {},
    }
) {
    try {
        await auditLogService.logAudit({
            req,
            userId: actorUserId(req),
            actionTaken,
            module: 'Academic Years',
            entityType,
            entityId: entityId
                ? String(entityId)
                : null,
            description,
            metadata,
        });
    } catch (error) {
        console.error(
            'ACADEMIC CYCLE AUDIT ERROR:',
            error.message
        );
    }
}

exports.getAcademicYears = async (_req, res) => {
    try {
        const rows =
            await academicYearService.getAcademicYears();

        return res.status(200).json(rows);
    } catch (err) {
        console.error(
            'GET ACADEMIC YEARS ERROR:',
            err
        );
        return sendError(
            res,
            err,
            'Failed to fetch academic years'
        );
    }
};

exports.getAcademicPeriods = async (_req, res) => {
    try {
        const rows =
            await academicYearService.getAcademicPeriods();

        return res.status(200).json(rows);
    } catch (err) {
        console.error(
            'GET ACADEMIC PERIODS ERROR:',
            err
        );
        return sendError(
            res,
            err,
            'Failed to fetch academic periods'
        );
    }
};

exports.createAcademicYear = async (req, res) => {
    try {
        const academicYear =
            await academicYearService.createAcademicYear(
                req.body
            );

        await writeAudit(
            req,
            'CREATE_ACADEMIC_YEAR',
            `Created academic year: ${
                academicYear.label ||
                `${academicYear.start_year}-${academicYear.end_year}`
            }.`,
            {
                entityType: 'academic_year',
                entityId:
                    academicYear.academic_year_id,
                metadata: academicYear,
            }
        );

        emitAcademicUpdate(req, 'create', {
            academicYear,
        });

        return res
            .status(201)
            .json(academicYear);
    } catch (err) {
        console.error(
            'CREATE ACADEMIC YEAR ERROR:',
            err
        );
        return sendError(
            res,
            err,
            'Failed to create academic year'
        );
    }
};

exports.updateAcademicYear = async (req, res) => {
    try {
        const academicYear =
            await academicYearService.updateAcademicYear(
                req.params.id,
                req.body
            );

        if (!academicYear) {
            return res.status(404).json({
                message: 'Academic year not found',
                error: 'Academic year not found',
            });
        }

        await writeAudit(
            req,
            'UPDATE_ACADEMIC_YEAR',
            `Updated academic year: ${
                academicYear.label ||
                req.params.id
            }.`,
            {
                entityType: 'academic_year',
                entityId:
                    academicYear.academic_year_id,
                metadata: {
                    changes: req.body,
                    academic_year: academicYear,
                },
            }
        );

        emitAcademicUpdate(req, 'update', {
            academicYear,
        });

        return res
            .status(200)
            .json(academicYear);
    } catch (err) {
        console.error(
            'UPDATE ACADEMIC YEAR ERROR:',
            err
        );
        return sendError(
            res,
            err,
            'Failed to update academic year'
        );
    }
};

exports.activateAcademicYear = async (
    req,
    res
) => {
    try {
        const academicYear =
            await academicYearService.activateAcademicYear(
                req.params.id
            );

        if (!academicYear) {
            return res.status(404).json({
                message: 'Academic year not found',
                error: 'Academic year not found',
            });
        }

        await writeAudit(
            req,
            'ACTIVATE_ACADEMIC_YEAR',
            `Activated academic year: ${
                academicYear.label ||
                req.params.id
            }.`,
            {
                entityType: 'academic_year',
                entityId:
                    academicYear.academic_year_id,
                metadata: academicYear,
            }
        );

        emitAcademicUpdate(req, 'activate', {
            academicYear,
        });

        return res
            .status(200)
            .json(academicYear);
    } catch (err) {
        console.error(
            'ACTIVATE ACADEMIC YEAR ERROR:',
            err
        );
        return sendError(
            res,
            err,
            'Failed to activate academic year'
        );
    }
};

exports.activateAcademicPeriod = async (
    req,
    res
) => {
    try {
        const result =
            await academicYearService.activateAcademicPeriod(
                req.params.periodId,
                actorUserId(req)
            );

        const period = result.period;

        await writeAudit(
            req,
            'ACTIVATE_ACADEMIC_PERIOD',
            `Set ${period.term} · AY ${period.academic_year_label} as the current academic period.`,
            {
                entityType: 'academic_period',
                entityId: period.period_id,
                metadata: result,
            }
        );

        emitAcademicUpdate(
            req,
            'activate_period',
            {
                period,
                cycleSummary:
                    result.cycle_summary,
            }
        );

        return res.status(200).json(result);
    } catch (err) {
        console.error(
            'ACTIVATE ACADEMIC PERIOD ERROR:',
            err
        );
        return sendError(
            res,
            err,
            'Failed to activate academic period'
        );
    }
};

exports.resetAcademicPeriodForTesting = async (
    req,
    res
) => {
    try {
        const result =
            await academicYearService.resetAcademicPeriodForTesting(
                req.params.periodId,
                actorUserId(req)
            );

        const period = result.period;

        await writeAudit(
            req,
            'RESET_ACADEMIC_PERIOD_TEST_CYCLE',
            `Reset the test cycle for ${period.term} · AY ${period.academic_year_label}.`,
            {
                entityType: 'academic_period',
                entityId: period.period_id,
                metadata: result,
            }
        );

        emitAcademicUpdate(
            req,
            'reset_period_test',
            {
                period,
                cycleSummary:
                    result.regenerated,
            }
        );

        return res.status(200).json(result);
    } catch (err) {
        console.error(
            'RESET ACADEMIC PERIOD TEST ERROR:',
            err
        );
        return sendError(
            res,
            err,
            'Failed to reset academic period test cycle'
        );
    }
};

exports.archiveAcademicYear = async (
    req,
    res
) => {
    try {
        const academicYear =
            await academicYearService.archiveAcademicYear(
                req.params.id
            );

        if (!academicYear) {
            return res.status(404).json({
                message: 'Academic year not found',
                error: 'Academic year not found',
            });
        }

        await writeAudit(
            req,
            'ARCHIVE_ACADEMIC_YEAR',
            `Archived academic year: ${
                academicYear.label ||
                req.params.id
            }.`,
            {
                entityType: 'academic_year',
                entityId:
                    academicYear.academic_year_id,
                metadata: academicYear,
            }
        );

        emitAcademicUpdate(req, 'archive', {
            academicYear,
        });

        return res
            .status(200)
            .json(academicYear);
    } catch (err) {
        console.error(
            'ARCHIVE ACADEMIC YEAR ERROR:',
            err
        );
        return sendError(
            res,
            err,
            'Failed to archive academic year'
        );
    }
};

exports.restoreAcademicYear = async (
    req,
    res
) => {
    try {
        const academicYear =
            await academicYearService.restoreAcademicYear(
                req.params.id
            );

        if (!academicYear) {
            return res.status(404).json({
                message: 'Academic year not found',
                error: 'Academic year not found',
            });
        }

        await writeAudit(
            req,
            'RESTORE_ACADEMIC_YEAR',
            `Restored academic year: ${
                academicYear.label ||
                req.params.id
            }.`,
            {
                entityType: 'academic_year',
                entityId:
                    academicYear.academic_year_id,
                metadata: academicYear,
            }
        );

        emitAcademicUpdate(req, 'restore', {
            academicYear,
        });

        return res
            .status(200)
            .json(academicYear);
    } catch (err) {
        console.error(
            'RESTORE ACADEMIC YEAR ERROR:',
            err
        );
        return sendError(
            res,
            err,
            'Failed to restore academic year'
        );
    }
};
