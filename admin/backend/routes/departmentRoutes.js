const express = require('express');
const router = express.Router();

const {
    getDepartments,
    createDepartment,
    updateDepartment,
} = require('../controllers/departmentController');

const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getDepartments);
router.post('/', protect, createDepartment);
router.patch('/:id', protect, updateDepartment);

module.exports = router;