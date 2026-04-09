const departmentService = require('../services/departmentService');

const getDepartments = async (req, res) => {
    try {
        const departments = await departmentService.fetchDepartments();
        res.status(200).json(departments);
    } catch (error) {
        console.error('GET DEPARTMENTS CONTROLLER ERROR:', error);
        res.status(500).json({
            error: 'Failed to fetch departments',
        });
    }
};

const createDepartment = async (req, res) => {
    try {
        const {
            department_code,
            department_name,
            is_archived,
        } = req.body;

        const createdDepartment = await departmentService.createDepartment({
            department_code,
            department_name,
            is_archived,
        });

        res.status(201).json(createdDepartment);
    } catch (error) {
        console.error('CREATE DEPARTMENT CONTROLLER ERROR:', error);

        if (
            error.message === 'Department code is required' ||
            error.message === 'Department code already exists'
        ) {
            return res.status(
                error.message === 'Department code already exists' ? 409 : 400
            ).json({ error: error.message });
        }

        res.status(500).json({
            error: 'Failed to create department',
        });
    }
};

const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            department_code,
            department_name,
            is_archived,
        } = req.body;

        const updatedDepartment = await departmentService.updateDepartment(id, {
            department_code,
            department_name,
            is_archived,
        });

        if (!updatedDepartment) {
            return res.status(404).json({
                error: 'Department not found',
            });
        }

        res.status(200).json(updatedDepartment);
    } catch (error) {
        console.error('UPDATE DEPARTMENT CONTROLLER ERROR:', error);

        if (
            error.message === 'Department code is required' ||
            error.message === 'Department code already exists'
        ) {
            return res.status(
                error.message === 'Department code already exists' ? 409 : 400
            ).json({ error: error.message });
        }

        res.status(500).json({
            error: 'Failed to update department',
        });
    }
};

module.exports = {
    getDepartments,
    createDepartment,
    updateDepartment,
};