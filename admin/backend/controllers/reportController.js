const reportService = require('../services/reportService');
const auditLogService = require('../services/auditLogService');
const accountService = require('../services/accountService');

function canAccessReports(req) {
    const role = String(req.user?.role || '').toLowerCase();
    return ['admin', 'sdo', 'guidance', 'pd', 'ro_coordinator'].includes(role);
}

function getAllowedReportTypes(role, hasRoCoordinatorAccess = false) {
    const normalizedRole = String(role || '').toLowerCase();

    if (normalizedRole === 'admin') {
        return [
            'applications',
            'scholars',
            'scholars_by_benefactor',
            'payouts',
            'endorsements',
        ];
    }

    const allowed = [];

    if (['sdo', 'guidance', 'pd'].includes(normalizedRole)) {
        allowed.push(normalizedRole);
    }

    if (hasRoCoordinatorAccess) {
        allowed.push('ro');
    }

    return allowed;
}

async function resolveReportAccess(req) {
    const role = String(req.user?.role || '').toLowerCase();

    if (!['admin', 'sdo', 'guidance', 'pd', 'ro_coordinator'].includes(role)) {
        const error = new Error('Report access is not available for this account.');
        error.statusCode = 403;
        throw error;
    }

    const userId = getActorUserId(req);
    const canHoldRoAssignment = ['sdo', 'guidance', 'pd', 'ro_coordinator'].includes(role);
    const hasRoCoordinatorAccess = canHoldRoAssignment
        ? await accountService.hasActiveRoCoordinatorAssignment(userId)
        : false;

    if (role === 'ro_coordinator' && !hasRoCoordinatorAccess) {
        const error = new Error('An active RO Area coordinator assignment is required to access RO reports.');
        error.statusCode = 403;
        throw error;
    }

    return {
        role,
        userId,
        hasRoCoordinatorAccess,
        allowedReportTypes: getAllowedReportTypes(role, hasRoCoordinatorAccess),
    };
}

function isSilentRequest(req) {
    const value = String(req.query?.silent || '').toLowerCase();
    return value === '1' || value === 'true' || value === 'yes';
}

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function getScopedServiceQuery(req, access) {
    const reportType = String(req.query?.reportType || req.query?.type || 'applications').toLowerCase();

    if (!access.allowedReportTypes.includes(reportType)) {
        const error = new Error(
            reportType === 'ro'
                ? 'An active RO Area coordinator assignment is required to access the RO Coordinator report.'
                : 'This account is not allowed to access the requested report.'
        );
        error.statusCode = access.role === 'admin' ? 400 : 403;
        throw error;
    }

    return {
        ...(req.query || {}),
        pdUserId: reportType === 'pd' && access.role === 'pd' ? access.userId : '',
        roUserId: reportType === 'ro' ? access.userId : '',
    };
}

function getReportQueryPayload(req) {
    return {
        reportType: req.query?.reportType || req.query?.type || 'applications',
        academicYearId: req.query?.academicYearId || req.query?.academic_year_id || 'all',
        semester: req.query?.semester || 'all',
        programId: req.query?.programId || req.query?.program_id || 'all',
        benefactorId: req.query?.benefactorId || req.query?.benefactor_id || 'all',
        reviewResult: req.query?.reviewResult || req.query?.review_result || 'all',
        dateFrom: req.query?.dateFrom || req.query?.date_from || '',
        dateTo: req.query?.dateTo || req.query?.date_to || '',
        format: req.query?.format || null,
    };
}

async function writeReportAudit(req, actionTaken, description, metadata = {}) {
    if (isSilentRequest(req)) return;

    try {
        if (typeof auditLogService?.logAudit !== 'function') {
            console.warn('REPORT AUDIT WARNING: auditLogService.logAudit is not available.');
            return;
        }

        await auditLogService.logAudit({
            req,
            userId: getActorUserId(req),
            actionTaken,
            module: 'Reports',
            entityType: 'report',
            entityId: metadata.reportType || null,
            description,
            metadata,
        });
    } catch (error) {
        console.error('REPORT AUDIT LOG ERROR:', error.message);
    }
}

async function getReportMetadata(req, res) {
    try {
        const access = await resolveReportAccess(req);
        const result = await reportService.getReportMetadata();
        const allowedReportTypes = access.allowedReportTypes;
        result.reportTypes = (result.reportTypes || []).filter((reportType) =>
            allowedReportTypes.includes(reportType.id)
        );

        await writeReportAudit(
            req,
            'VIEW_REPORT_METADATA',
            'Viewed report metadata and filter options.',
            {
                reportType: 'metadata',
            }
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('REPORT METADATA ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to load report metadata.',
        });
    }
}

async function previewReport(req, res) {
    try {
        const access = await resolveReportAccess(req);
        const queryPayload = getReportQueryPayload(req);
        const result = await reportService.previewReport(getScopedServiceQuery(req, access));

        await writeReportAudit(
            req,
            'PREVIEW_REPORT',
            `Previewed ${queryPayload.reportType} report.`,
            {
                ...queryPayload,
                total: result.total || 0,
            }
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('REPORT PREVIEW ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to preview report.',
        });
    }
}

async function exportReport(req, res) {
    try {
        const access = await resolveReportAccess(req);
        const queryPayload = getReportQueryPayload(req);
        const format = String(req.query?.format || 'xlsx').toLowerCase();

        if (format === 'csv') {
            const result = await reportService.generateCsvReport(getScopedServiceQuery(req, access));

            await writeReportAudit(
                req,
                'EXPORT_REPORT_CSV',
                `Exported ${queryPayload.reportType} report as CSV.`,
                {
                    ...queryPayload,
                    format: 'csv',
                    filename: result.filename,
                }
            );

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${result.filename}"`
            );

            return res.status(200).send(result.content);
        }

        const result = await reportService.generateExcelReport(getScopedServiceQuery(req, access));

        await writeReportAudit(
            req,
            'EXPORT_REPORT_EXCEL',
            `Exported ${queryPayload.reportType} report as Excel.`,
            {
                ...queryPayload,
                format: 'xlsx',
                filename: result.filename,
            }
        );

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${result.filename}"`
        );

        await result.workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        console.error('REPORT EXPORT ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to export report.',
        });
    }
}

module.exports = {
    getReportMetadata,
    exportReport,
    previewReport,
};
