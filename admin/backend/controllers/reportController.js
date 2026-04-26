const reportService = require('../services/reportService');

function isAdmin(req) {
    const role = String(req.user?.role || '').toLowerCase();
    return role === 'admin' || role === 'sdo';
}

async function getReportMetadata(req, res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ error: 'Admin access required.' });
        }

        const result = await reportService.getReportMetadata();
        return res.status(200).json(result);
    } catch (error) {
        console.error('REPORT METADATA ERROR:', error);
        return res.status(500).json({
            error: error.message || 'Failed to load report metadata.',
        });
    }
}

async function exportReport(req, res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ error: 'Admin access required.' });
        }

        const result = await reportService.generateExcelReport(req.query || {});

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${result.filename}"`
        );

        await result.workbook.xlsx.write(res);
        res.end();
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
};