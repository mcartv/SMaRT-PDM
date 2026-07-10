const applicationService = require('../services/applicationService');
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

        if (data?.activation?.activated) {
            socketEvents.applicationApproved(io, {
                application_id: id,
                status: data.activation.outcome || 'approved',
                updated_at: new Date().toISOString(),
                source: 'verification',
            });
        }

        res.status(200).json({
            message: 'Verification saved successfully',
            data,
        });
    } catch (err) {
        console.error('SAVE APPLICATION VERIFICATION CONTROLLER ERROR:', err.message);

        const statusCode = isApprovalStateError(err.message) ? 400 : 500;

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

        const updated = await applicationService.approveApplicationWithSlotCheck(id);

        const io = req.app.get('io');
        socketEvents.applicationApproved(io, {
            application_id: id,
            status: 'approved',
            updated_at: new Date().toISOString()
        });
        if (updated?.scholar) {
            socketEvents.scholarCreated(io, {
                scholar_id:
                    updated.scholar.scholar_id?.toString?.() ||
                    updated.scholar.student_id?.toString?.() ||
                    id,
                student_id:
                    updated.scholar.student_id?.toString?.() ||
                    updated.scholar.scholar_id?.toString?.() ||
                    id,
                updated_at: new Date().toISOString(),
            });
        }

        res.status(200).json({
            message: 'Application approved successfully',
            application: updated.application || updated,
            scholar: updated.scholar || null,
            outcome: updated.outcome || null,
        });
    } catch (err) {
        console.error('APPROVE APPLICATION CONTROLLER ERROR:', err.message);

        if (isApprovalStateError(err.message)) {
            return res.status(400).json({
                message: err.message,
            });
        }

        res.status(500).json({
            message: 'Failed to approve application',
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
        const worksheet = workbook.addWorksheet('Applications');

        worksheet.columns = [
            { header: 'Application ID', key: 'application_id', width: 24 },
            { header: 'Applicant Name', key: 'student_name', width: 30 },
            { header: 'PDM ID', key: 'pdm_id', width: 18 },
            { header: 'Scholarship', key: 'program_name', width: 25 },
            { header: 'Opening', key: 'opening_title', width: 30 },
            { header: 'Semester', key: 'semester', width: 14 },
            { header: 'Academic Year', key: 'academic_year', width: 16 },
            { header: 'Allocated Slots', key: 'allocated_slots', width: 16 },
            { header: 'Filled Slots', key: 'filled_slots', width: 14 },
            { header: 'GWA', key: 'gwa', width: 10 },
            { header: 'Application Status', key: 'application_status', width: 20 },
            { header: 'Document Status', key: 'document_status', width: 20 },
            { header: 'Remarks', key: 'remarks', width: 30 },
            { header: 'Disqualified', key: 'disqualified_label', width: 14 },
            { header: 'Rejection Reason', key: 'rejection_reason', width: 35 },
            { header: 'Submitted', key: 'submission_date', width: 20 },
        ];

        applications.forEach((app) => {
            worksheet.addRow({
                ...app,
                disqualified_label: app.is_disqualified ? 'Yes' : 'No',
            });
        });

        worksheet.getRow(1).font = { bold: true };

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=applications-${Date.now()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('EXPORT APPLICATIONS EXCEL ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};
