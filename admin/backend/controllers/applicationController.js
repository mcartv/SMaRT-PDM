const applicationService = require('../services/applicationService');
const ExcelJS = require('exceljs');

exports.getApplications = async (req, res) => {
    try {
        const applications = await applicationService.fetchApplications();
        res.status(200).json(applications);
    } catch (err) {
        console.error('APPLICATION CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
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

exports.saveApplicationVerification = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await applicationService.saveApplicationVerification(
            id,
            req.body,
            req.user
        );

        res.status(200).json({
            message: 'Application verification saved successfully',
            data: result,
        });
    } catch (err) {
        console.error('SAVE APPLICATION VERIFICATION CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.markApplicationReviewed = async (req, res) => {
    const { id } = req.params;

    try {
        const data = await applicationService.markApplicationReviewed(id);
        res.status(200).json({
            message: 'Application moved to review successfully',
            data,
        });
    } catch (err) {
        console.error('MARK APPLICATION REVIEWED CONTROLLER ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.disqualifyApplication = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
        const data = await applicationService.markApplicationDisqualified(id, reason);
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
            { header: 'Application ID', key: 'id', width: 22 },
            { header: 'Student Name', key: 'name', width: 30 },
            { header: 'Student Number', key: 'student_number', width: 18 },
            { header: 'Program', key: 'program', width: 25 },
            { header: 'GWA', key: 'gwa', width: 10 },
            { header: 'Application Status', key: 'status', width: 20 },
            { header: 'Document Status', key: 'document_status', width: 20 },
            { header: 'Disqualified', key: 'disqualified', width: 14 },
            { header: 'Disqualification Reason', key: 'disqReason', width: 35 },
            { header: 'Submitted', key: 'submitted', width: 20 },
        ];

        applications.forEach((app) => {
            worksheet.addRow({
                ...app,
                disqualified: app.disqualified ? 'Yes' : 'No',
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
