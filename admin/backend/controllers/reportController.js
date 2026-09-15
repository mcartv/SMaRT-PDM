const reportService = require('../services/reportService');
const benefactorReportPdfService = require('../services/benefactorReportPdfService');
const auditLogService = require('../services/auditLogService');
const accountService = require('../services/accountService');

const EXPORT_LOCK_TIMEOUT_MS = 2 * 60 * 1000;
const EXPORT_COOLDOWN_MS = 1500;
const reportExportLocks = new Map();

function cleanupExportLocks(now = Date.now()) {
    for (const [key, value] of reportExportLocks.entries()) {
        if (!value || Number(value.expiresAt || 0) <= now) {
            reportExportLocks.delete(key);
        }
    }
}

function buildExportLockKey(access, queryPayload) {
    const filterFingerprint = JSON.stringify({
        reportType: String(queryPayload.reportType || 'applications').toLowerCase(),
        academicYearId: queryPayload.academicYearId,
        semester: queryPayload.semester,
        programId: queryPayload.programId,
        benefactorId: queryPayload.benefactorId,
        reviewResult: queryPayload.reviewResult,
        courseId: queryPayload.courseId,
        yearLevel: queryPayload.yearLevel,
        gender: queryPayload.gender,
        roAreaId: queryPayload.roAreaId,
        applicationStatus: queryPayload.applicationStatus,
        documentStatus: queryPayload.documentStatus,
        verificationStatus: queryPayload.verificationStatus,
        batchStatus: queryPayload.batchStatus,
        releaseStatus: queryPayload.releaseStatus,
        paymentMode: queryPayload.paymentMode,
        dateFrom: queryPayload.dateFrom,
        dateTo: queryPayload.dateTo,
    });

    return `${access.userId || access.role || 'unknown'}|${filterFingerprint}`;
}

function acquireExportLock(access, queryPayload) {
    const now = Date.now();
    cleanupExportLocks(now);
    const key = buildExportLockKey(access, queryPayload);
    if (reportExportLocks.has(key)) return null;

    reportExportLocks.set(key, {
        state: 'active',
        expiresAt: now + EXPORT_LOCK_TIMEOUT_MS,
    });
    return key;
}

function releaseExportLock(key) {
    if (!key) return;
    reportExportLocks.set(key, {
        state: 'cooldown',
        expiresAt: Date.now() + EXPORT_COOLDOWN_MS,
    });
}

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
            'ro_compliance',
            'renewals',
            'slot_utilization',
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
        const error = new Error('An active RO Area personnel-in-charge assignment is required to access RO reports.');
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
                ? 'An active RO Area personnel-in-charge assignment is required to access the RO Personnel-In-Charge report.'
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
        courseId: req.query?.courseId || req.query?.course_id || 'all',
        yearLevel: req.query?.yearLevel || req.query?.year_level || 'all',
        gender: req.query?.gender || 'all',
        roAreaId: req.query?.roAreaId || req.query?.ro_area_id || 'all',
        dateFrom: req.query?.dateFrom || req.query?.date_from || '',
        dateTo: req.query?.dateTo || req.query?.date_to || '',
        applicationStatus: req.query?.applicationStatus || req.query?.application_status || 'all',
        documentStatus: req.query?.documentStatus || req.query?.document_status || 'all',
        verificationStatus: req.query?.verificationStatus || req.query?.verification_status || 'all',
        batchStatus: req.query?.batchStatus || req.query?.batch_status || 'all',
        releaseStatus: req.query?.releaseStatus || req.query?.release_status || 'all',
        paymentMode: req.query?.paymentMode || req.query?.payment_mode || 'all',
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
    let exportLockKey = null;

    try {
        const access = await resolveReportAccess(req);
        const queryPayload = getReportQueryPayload(req);
        const format = String(req.query?.format || 'xlsx').toLowerCase();
        const scopedQuery = getScopedServiceQuery(req, access);

        if (!['xlsx', 'csv', 'pdf'].includes(format)) {
            const error = new Error('Unsupported report export format.');
            error.statusCode = 400;
            throw error;
        }

        const normalizedReportType = String(queryPayload.reportType || '').toLowerCase();
        if (normalizedReportType === 'scholars_by_benefactor' && format !== 'pdf') {
            const error = new Error('Scholar Count by Benefactor is available as PDF only.');
            error.statusCode = 400;
            throw error;
        }

        exportLockKey = acquireExportLock(access, queryPayload);
        if (!exportLockKey) {
            const error = new Error('This report is already being generated.');
            error.statusCode = 429;
            throw error;
        }

        if (format === 'pdf') {
            if (String(queryPayload.reportType).toLowerCase() !== 'scholars_by_benefactor') {
                const error = new Error('PDF export is available for the Scholar Count by Benefactor report only.');
                error.statusCode = 400;
                throw error;
            }

            const [excelResult, metadata] = await Promise.all([
                reportService.generateExcelReport(scopedQuery),
                reportService.getReportMetadata(),
            ]);
            const result = await benefactorReportPdfService.generateScholarCountPdf({
                workbook: excelResult.workbook,
                query: queryPayload,
                metadata,
            });

            await writeReportAudit(
                req,
                'EXPORT_REPORT_PDF',
                'Exported Scholar Count by Benefactor report as PDF.',
                {
                    ...queryPayload,
                    format: 'pdf',
                    filename: result.filename,
                }
            );

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.setHeader('Content-Length', String(result.buffer.length));
            return res.status(200).send(result.buffer);
        }

        if (format === 'csv') {
            const result = await reportService.generateCsvReport(scopedQuery);

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
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            return res.status(200).send(result.content);
        }

        const result = await reportService.generateExcelReport(scopedQuery);

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
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        await result.workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        console.error('REPORT EXPORT ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to export report.',
        });
    } finally {
        releaseExportLock(exportLockKey);
    }
}

module.exports = {
    getReportMetadata,
    exportReport,
    previewReport,
};
