const applicationService = require('../services/applicationService');
const selectionService = require('../services/selectionService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');
const ExcelJS = require('exceljs');

function isApprovalStateError(message) {
    return [
        'Application not found',
        'This opening is already archived.',
        'This opening is already closed.',
        'This opening is already closed or filled.',
        'No available slots left for this opening.',
    ].includes(message);
}

exports.getApplications = async (req, res) => {
    try {
        const applications = await applicationService.fetchApplications();
        res.status(200).json(applications);
    } catch (err) {
        console.error('GET APPLICATIONS CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to fetch applications',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.getApplicationDocuments = async (req, res) => {
    const { id } = req.params;

    try {
        const payload = await applicationService.fetchApplicationDocumentsById(id);
        res.status(200).json(payload);
    } catch (err) {
        console.error('APPLICATION DOCUMENTS CONTROLLER ERROR:', err.message);

        if (err.message.includes('already been converted')) {
            return res.status(409).json({ error: err.message });
        }

        res.status(500).json({ error: err.message });
    }
};

exports.getApplicationDetails = async (req, res) => {
    const { id } = req.params;

    try {
        const payload = await applicationService.fetchApplicationDetailsById(id);
        res.status(200).json(payload);
    } catch (err) {
        console.error('APPLICATION DETAILS CONTROLLER ERROR:', err.message);

        if (err.message.includes('already been converted')) {
            return res.status(409).json({ error: err.message });
        }

        res.status(500).json({ error: err.message });
    }
};

exports.uploadStudentDocument = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await applicationService.uploadStudentApplicationDocument({
            applicationId: id,
            documentType: req.body.documentType,
            file: req.file,
            user: req.user,
        });

        const io = req.app.get('io');

        socketEvents.applicationDocumentUploaded(io, {
            application_id: id,
            document_key: result?.document_key || null,
            document_name: result?.document_name || null,
            file_name: result?.file_name || null,
            document_status: result?.document_status || null,
            uploaded_at: new Date().toISOString(),
            source: 'document_upload',
        });

        socketEvents.applicationUpdated(io, {
            application_id: id,
            document_status: result?.document_status || null,
            updated_at: new Date().toISOString(),
            source: 'document_upload',
        });

        res.status(200).json({
            message: 'Document uploaded successfully',
            data: result,
        });
    } catch (err) {
        console.error('UPLOAD STUDENT DOCUMENT CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.runApplicationDocumentIotOcr = async (req, res) => {
    try {
        const result = await applicationService.runApplicationDocumentIotOcr({
            applicationId: req.params.id,
            documentKey: req.params.documentKey,
            requestedBy:
                req.user?.user_id ||
                req.user?.admin_id ||
                req.user?.id ||
                null,
        });

        const io = req.app.get('io');
        const payload = result.request || result;

        socketEvents.applicationOcrQueued(io, {
            application_id: req.params.id,
            document_key: req.params.documentKey,
            document_name: result?.document_name || payload?.document_type || null,
            request_id: payload?.request_id || payload?.id || null,
            status: payload?.status || 'queued',
            updated_at: new Date().toISOString(),
            source: 'iot_ocr',
        });

        socketEvents.applicationUpdated(io, {
            application_id: req.params.id,
            document_key: req.params.documentKey,
            updated_at: new Date().toISOString(),
            source: 'iot_ocr',
        });

        return res.status(result?.created ? 202 : 200).json({
            message: 'IoT OCR scanner trigger started successfully',
            data: payload,
        });
    } catch (error) {
        console.error('RUN APPLICATION DOCUMENT IOT OCR ERROR:', error);

        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to run IoT OCR',
        });
    }
};

exports.getApplicationDocumentOcrSnapshot = async (req, res) => {
    const { id, documentKey } = req.params;

    try {
        const result = await applicationService.fetchApplicationDocumentOcrSnapshot({
            applicationId: id,
            documentKey,
        });

        res.status(200).json({
            message: 'OCR snapshot loaded successfully',
            data: result,
        });
    } catch (err) {
        console.error('GET APPLICATION DOCUMENT OCR SNAPSHOT CONTROLLER ERROR:', err.message);

        res.status(500).json({
            error: err.message || 'Failed to fetch OCR snapshot',
        });
    }
};

exports.saveApplicationDocumentOcrSnapshot = async (req, res) => {
    const { id, documentKey } = req.params;

    try {
        const result = await applicationService.saveApplicationDocumentOcrSnapshot({
            applicationId: id,
            documentKey,
            rawText: req.body?.raw_text || '',
            ocrConfidence: req.body?.ocr_confidence ?? null,
            extractedFields: req.body?.extracted_fields || null,
            scannedViaIot: req.body?.scanned_via_iot ?? null,
            iotDeviceId: req.body?.iot_device_id || null,
            scannedAt: req.body?.scanned_at || null,
            user: req.user,
        });

        const io = req.app.get('io');

        socketEvents.applicationOcrSnapshotSaved(io, {
            application_id: id,
            document_key: documentKey,
            document_id: result?.document_id || null,
            ocr_confidence: result?.ocr_confidence ?? null,
            updated_at: new Date().toISOString(),
            source: 'ocr_snapshot',
        });

        socketEvents.applicationUpdated(io, {
            application_id: id,
            document_key: documentKey,
            updated_at: new Date().toISOString(),
            source: 'ocr_snapshot',
        });

        res.status(200).json({
            message: 'OCR snapshot saved successfully',
            data: result,
        });
    } catch (err) {
        console.error('SAVE APPLICATION DOCUMENT OCR SNAPSHOT CONTROLLER ERROR:', err.message);

        res.status(500).json({
            error: err.message || 'Failed to save OCR snapshot',
        });
    }
};

exports.saveApplicationVerification = async (req, res) => {
    const { id } = req.params;

    try {
        const data = await applicationService.saveApplicationVerification(
            id,
            req.body,
            req.user
        );

        const io = req.app.get('io');
        socketEvents.applicationDocumentReviewed(io, {
            application_id: id,
            verification_status: data?.verification_status ?? req.body?.verification_status ?? null,
            document_reviews: Array.isArray(req.body?.document_reviews)
                ? req.body.document_reviews.map((doc) => ({
                    document_key: doc.document_key || doc.document_id || doc.id || null,
                    status: doc.status || 'pending',
                }))
                : [],
            updated_at: new Date().toISOString(),
            source: 'verification',
        });

        res.status(200).json({
            message: 'Verification saved successfully',
            data,
        });
    } catch (err) {
        console.error('SAVE APPLICATION VERIFICATION CONTROLLER ERROR:', err.message);

        const statusCode = err.statusCode || (isApprovalStateError(err.message) ? 400 : 500);

        res.status(statusCode).json({
            error: err.message || 'Failed to save verification',
        });
    }
};

exports.assignApplicationProgram = async (req, res) => {
    const { id } = req.params;
    const { program_id } = req.body;

    try {
        const data = await applicationService.assignApplicationProgram(id, program_id);
        const io = req.app.get('io');
        socketEvents.applicationUpdated(io, {
            application_id: id,
            program_id: data?.program_id ?? program_id ?? null,
            updated_at: new Date().toISOString(),
            source: 'program_assignment',
        });
        res.status(200).json({
            message: 'Application program assigned successfully',
            data,
        });
    } catch (err) {
        console.error('ASSIGN APPLICATION PROGRAM CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.markApplicationReviewed = async (req, res) => {
    const { id } = req.params;

    try {
        const data = await applicationService.markApplicationReviewed(id);
        const io = req.app.get('io');
        socketEvents.applicationUpdated(io, {
            application_id: id,
            status: data?.status ?? data?.application_status ?? 'review',
            updated_at: new Date().toISOString(),
            source: 'review',
        });
        res.status(200).json({
            message: 'Application moved to review successfully',
            data,
        });
    } catch (err) {
        console.error('MARK APPLICATION REVIEWED CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.saveApplicationRemarks = async (req, res) => {
    const { id } = req.params;
    const { remarks } = req.body;

    try {
        const data = await applicationService.saveApplicationRemarks(id, remarks);

        const io = req.app.get('io');
        socketEvents.applicationUpdated(io, {
            application_id: id,
            remarks: data?.remarks ?? remarks ?? null,
            updated_at: new Date().toISOString(),
            source: 'remarks',
        });

        res.status(200).json({
            message: 'Application remarks saved successfully',
            data,
        });
    } catch (err) {
        console.error('SAVE APPLICATION REMARKS CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.approveApplication = async (req, res) => {
    try {
        const { id } = req.params;

        // Compatibility route: the previous Approve action now places the
        // applicant in the FCFS qualified queue. Scholar activation happens
        // only after the opening's final applicant list is finalized.
        const updated = await selectionService.markApplicationQualified(id, req.user);

        const io = req.app.get('io');
        if (io) {
            io.emit('selection:queue-updated', {
                application_id: id,
                opening_id: updated.application?.opening_id || null,
                queue_position: updated.queue_position || null,
                updated_at: new Date().toISOString(),
            });
        }

        res.status(200).json({
            message: updated.message,
            application: updated.application,
            scholar: null,
            outcome: 'qualified_for_final_selection',
            queue_position: updated.queue_position,
        });
    } catch (err) {
        console.error('QUALIFY APPLICATION CONTROLLER ERROR:', err.message);

        const statusCode = err.statusCode || (isApprovalStateError(err.message) ? 400 : 500);

        res.status(statusCode).json({
            message: statusCode >= 500 ? 'Failed to qualify application' : err.message,
            error: err.message,
        });
    }
};

exports.disqualifyApplication = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
        const data = await applicationService.markApplicationDisqualified(id, reason);

        const io = req.app.get('io');

        socketEvents.applicationRejected(io, {
            application_id: id,
            status: 'rejected',
            reason: reason,
            updated_at: new Date().toISOString(),
            source: 'disqualification',
        });

        socketEvents.applicationDisqualified(io, {
            application_id: id,
            status: 'rejected',
            reason: reason,
            updated_at: new Date().toISOString(),
            source: 'disqualification',
        });

        socketEvents.applicationUpdated(io, {
            application_id: id,
            status: 'rejected',
            is_disqualified: true,
            reason: reason,
            updated_at: new Date().toISOString(),
            source: 'disqualification',
        });

        res.status(200).json({
            message: 'Application disqualified successfully',
            data,
        });
    } catch (err) {
        console.error('DISQUALIFY APPLICATION CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.exportApplicationsExcel = async (req, res) => {
    try {
        const applications = await applicationService.fetchApplications();

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SMaRT-PDM';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('OSFA Applicant Registry', {
            views: [{ state: 'frozen', ySplit: 4 }],
            pageSetup: {
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                paperSize: 9,
                margins: {
                    left: 0.25,
                    right: 0.25,
                    top: 0.5,
                    bottom: 0.5,
                    header: 0.2,
                    footer: 0.2,
                },
            },
        });

        worksheet.mergeCells('A1:Q1');
        worksheet.getCell('A1').value =
            'PAMBAYANG DALUBHASAAN NG MARILAO — OFFICE OF STUDENT FINANCIAL ASSISTANCE';
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = {
            horizontal: 'center',
            vertical: 'middle',
        };

        worksheet.mergeCells('A2:Q2');
        worksheet.getCell('A2').value = 'SCHOLARSHIP APPLICANT REGISTRY';
        worksheet.getCell('A2').font = { bold: true, size: 12 };
        worksheet.getCell('A2').alignment = {
            horizontal: 'center',
            vertical: 'middle',
        };

        worksheet.mergeCells('A3:Q3');
        worksheet.getCell('A3').value =
            `Generated: ${new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
            })}`;
        worksheet.getCell('A3').font = { italic: true, size: 9 };
        worksheet.getCell('A3').alignment = { horizontal: 'right' };

        const columns = [
            { header: 'No.', key: 'row_number', width: 7 },
            { header: 'PDM ID', key: 'pdm_id', width: 18 },
            { header: 'Applicant Name', key: 'student_name', width: 30 },
            { header: 'Scholarship Program', key: 'program_name', width: 26 },
            { header: 'Application Period', key: 'opening_title', width: 28 },
            { header: 'Academic Year', key: 'academic_year', width: 15 },
            { header: 'Semester', key: 'semester', width: 14 },
            { header: 'GWA', key: 'gwa', width: 10 },
            { header: 'Applied On', key: 'submission_date', width: 18 },
            { header: 'Requirements Completed', key: 'requirements_completed_at', width: 22 },
            { header: 'FCFS Rank', key: 'queue_position', width: 12 },
            { header: 'Document Status', key: 'document_status', width: 18 },
            { header: 'Verification Status', key: 'verification_status', width: 18 },
            { header: 'Endorsement Status', key: 'endorsement_status', width: 18 },
            { header: 'Selection Status', key: 'selection_status', width: 18 },
            { header: 'Waiting Position', key: 'waitlist_position', width: 16 },
            { header: 'Remarks / Reason', key: 'remarks_reason', width: 35 },
        ];

        worksheet.columns = columns;
        const headerRow = worksheet.getRow(4);
        columns.forEach((column, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = column.header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF7C4A2E' },
            };
            cell.alignment = {
                horizontal: 'center',
                vertical: 'middle',
                wrapText: true,
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD6D3D1' } },
                left: { style: 'thin', color: { argb: 'FFD6D3D1' } },
                bottom: { style: 'thin', color: { argb: 'FFD6D3D1' } },
                right: { style: 'thin', color: { argb: 'FFD6D3D1' } },
            };
        });
        headerRow.height = 34;

        const sorted = [...applications].sort((a, b) => {
            const rankA = Number(a.queue_position);
            const rankB = Number(b.queue_position);
            const hasRankA = Number.isFinite(rankA) && rankA > 0;
            const hasRankB = Number.isFinite(rankB) && rankB > 0;

            if (hasRankA && hasRankB && rankA !== rankB) return rankA - rankB;
            if (hasRankA !== hasRankB) return hasRankA ? -1 : 1;

            const completedA = new Date(
                a.requirements_completed_at || '9999-12-31'
            ).getTime();
            const completedB = new Date(
                b.requirements_completed_at || '9999-12-31'
            ).getTime();

            if (completedA !== completedB) return completedA - completedB;

            return new Date(a.submission_date || 0).getTime() -
                new Date(b.submission_date || 0).getTime();
        });

        sorted.forEach((app, index) => {
            const endorsementStatus =
                app.normalized_endorsement_status ||
                app.endorsement_status ||
                app.endorsement_overall_status ||
                (app.endorsement_complete ? 'Completed' : 'Pending');

            const row = worksheet.addRow({
                row_number: index + 1,
                pdm_id: app.pdm_id || '',
                student_name: app.student_name || app.applicant_name || '',
                program_name: app.program_name || '',
                opening_title: app.opening_title || '',
                academic_year: app.academic_year || '',
                semester: app.semester || '',
                gwa: app.gwa ?? '',
                submission_date: app.submission_date
                    ? new Date(app.submission_date)
                    : '',
                requirements_completed_at: app.requirements_completed_at
                    ? new Date(app.requirements_completed_at)
                    : '',
                queue_position: app.queue_position || '',
                document_status: app.document_status || '',
                verification_status: app.verification_status || '',
                endorsement_status: endorsementStatus,
                selection_status: app.selection_status || 'Unranked',
                waitlist_position: app.waitlist_position || '',
                remarks_reason:
                    app.remarks ||
                    app.rejection_reason ||
                    app.reapplication_reason ||
                    '',
            });

            row.alignment = { vertical: 'top', wrapText: true };
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE7E5E4' } },
                    left: { style: 'thin', color: { argb: 'FFE7E5E4' } },
                    bottom: { style: 'thin', color: { argb: 'FFE7E5E4' } },
                    right: { style: 'thin', color: { argb: 'FFE7E5E4' } },
                };
            });

            row.getCell(9).numFmt = 'mmm d, yyyy h:mm AM/PM';
            row.getCell(10).numFmt = 'mmm d, yyyy h:mm AM/PM';

            if (index % 2 === 1) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFAFAF9' },
                    };
                });
            }
        });

        worksheet.autoFilter = {
            from: { row: 4, column: 1 },
            to: { row: Math.max(4, worksheet.rowCount), column: columns.length },
        };

        worksheet.getColumn('gwa').numFmt = '0.00';
        worksheet.getColumn('queue_position').alignment = {
            horizontal: 'center',
        };
        worksheet.getColumn('waitlist_position').alignment = {
            horizontal: 'center',
        };

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=OSFA-applicant-registry-${Date.now()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('EXPORT APPLICATIONS EXCEL ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

/* Realtime + audit wrapper
 * This adds audit trail coverage to controller actions that previously had realtime only,
 * or no centralized audit. It skips read-only handlers.
 */
(function attachRealtimeAuditWrapper() {
    const MODULE_NAME = 'Application Review';
    const EVENT_BASE = 'application';

    const readOnlyPrefixes = ['get', 'fetch', 'list', 'download', 'export'];

    function isReadOnlyAction(name) {
        return readOnlyPrefixes.some((prefix) => String(name).startsWith(prefix));
    }

    function resolveActionName(name) {
        const raw = String(name || '').toLowerCase();

        if (raw.includes('archive')) return 'archived';
        if (raw.includes('restore')) return 'restored';
        if (raw.includes('approve')) return 'approved';
        if (raw.includes('reject')) return 'rejected';
        if (raw.includes('disqualify')) return 'disqualified';
        if (raw.includes('create') || raw.includes('upload')) return 'created';
        return 'updated';
    }

    function getActorUserId(req) {
        return req.user?.user_id || req.user?.userId || req.user?.id || null;
    }

    function getEntityId(req, body) {
        return (
            req.params?.id ||
            req.params?.applicationId ||
            req.params?.studentId ||
            req.params?.scholarId ||
            req.params?.reviewId ||
            req.params?.ticketId ||
            req.params?.settingId ||
            body?.data?.id ||
            body?.data?.application_id ||
            body?.data?.student_id ||
            body?.id ||
            body?.application_id ||
            body?.student_id ||
            null
        );
    }

    function safeAudit(req, functionName, responseBody) {
        try {
            const action = resolveActionName(functionName);
            const entityId = getEntityId(req, responseBody);
            const actionTaken = `${action.toUpperCase()}_${EVENT_BASE.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;

            if (typeof auditLogService?.logAudit === 'function') {
                auditLogService.logAudit({
                    req,
                    userId: getActorUserId(req),
                    actionTaken,
                    module: MODULE_NAME,
                    entityType: EVENT_BASE,
                    entityId: entityId ? String(entityId) : null,
                    description: `${MODULE_NAME}: ${functionName} completed successfully.`,
                    metadata: {
                        action,
                        params: req.params || {},
                        query: req.query || {},
                        body_keys: Object.keys(req.body || {}),
                    },
                }).catch((error) => {
                    console.error(`${MODULE_NAME} AUDIT WRAPPER ERROR:`, error.message);
                });
            }

            const io = req.app?.get?.('io');
            if (io && socketEvents?.emitEvent) {
                socketEvents.emitEvent(io, `${EVENT_BASE}:${action}`, {
                    module: MODULE_NAME,
                    action,
                    entity_id: entityId ? String(entityId) : null,
                    source: functionName,
                    updated_at: new Date().toISOString(),
                });

                socketEvents.emitEvent(io, 'audit:created', {
                    module: MODULE_NAME,
                    action_taken: actionTaken,
                    entity_type: EVENT_BASE,
                    entity_id: entityId ? String(entityId) : null,
                    created_at: new Date().toISOString(),
                });
            }
        } catch (error) {
            console.error(`${MODULE_NAME} REALTIME/AUDIT WRAPPER ERROR:`, error.message);
        }
    }

    Object.entries(module.exports).forEach(([functionName, handler]) => {
        if (typeof handler !== 'function' || isReadOnlyAction(functionName)) return;
        if (handler.__realtimeAuditWrapped) return;

        const wrapped = async function realtimeAuditWrappedHandler(req, res, next) {
            let captured = false;
            const originalJson = res.json.bind(res);

            res.json = function patchedJson(body) {
                if (!captured && res.statusCode >= 200 && res.statusCode < 400) {
                    captured = true;
                    safeAudit(req, functionName, body || {});
                }

                return originalJson(body);
            };

            return handler(req, res, next);
        };

        wrapped.__realtimeAuditWrapped = true;
        module.exports[functionName] = wrapped;
    });
})();
