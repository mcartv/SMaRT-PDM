const scholarshipProgramService = require('../services/scholarshipProgramService');

exports.getScholarshipPrograms = async (req, res) => {
    try {
        const rows = await scholarshipProgramService.getScholarshipPrograms();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET SCHOLARSHIP PROGRAMS ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to fetch scholarship programs',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.createScholarshipProgram = async (req, res) => {
    try {
        const created = await scholarshipProgramService.createScholarshipProgram(req.body);
        res.status(201).json(created);
    } catch (err) {
        console.error('CREATE SCHOLARSHIP PROGRAM ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to create scholarship program',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.updateScholarshipProgram = async (req, res) => {
    try {
        const updated = await scholarshipProgramService.updateScholarshipProgram(
            req.params.id,
            req.body
        );

        if (!updated) {
            return res.status(404).json({ message: 'Scholarship program not found' });
        }

        res.status(200).json(updated);
    } catch (err) {
        console.error('UPDATE SCHOLARSHIP PROGRAM ERROR:', err);
        res.status(500).json({
            message: err.message || 'Failed to update scholarship program',
            error: err.message || 'Unknown backend error',
        });
    }
};