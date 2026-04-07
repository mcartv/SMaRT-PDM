const scholarshipProgramService = require('../services/scholarshipProgramService');

exports.getScholarshipPrograms = async (req, res) => {
    try {
        const data = await scholarshipProgramService.getScholarshipPrograms();
        res.status(200).json(data);
    } catch (err) {
        console.error('GET SCHOLARSHIP PROGRAMS ERROR:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createScholarshipProgram = async (req, res) => {
    try {
        const data = await scholarshipProgramService.createScholarshipProgram(req.body);
        res.status(201).json(data);
    } catch (err) {
        console.error('CREATE SCHOLARSHIP PROGRAM ERROR:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.updateScholarshipProgram = async (req, res) => {
    try {
        const data = await scholarshipProgramService.updateScholarshipProgram(req.params.id, req.body);
        res.status(200).json(data);
    } catch (err) {
        console.error('UPDATE SCHOLARSHIP PROGRAM ERROR:', err);
        res.status(500).json({ error: err.message });
    }
};