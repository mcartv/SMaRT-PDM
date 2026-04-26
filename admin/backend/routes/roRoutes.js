const express = require('express');
const router = express.Router();

const roController = require('../controllers/roController');
const { protect } = require('../middleware/authMiddleware');

// Static routes FIRST
router.get('/summary', protect, roController.getSummary);
router.get('/config', protect, roController.getConfig);
router.patch('/config', protect, roController.updateConfig);

// List route
router.get('/', protect, roController.getROList);

// Create route
router.post('/', protect, roController.createRO);

// Dynamic routes LAST
router.patch('/:id/approve', protect, roController.approveRO);
router.patch('/:id/reject', protect, roController.rejectRO);
router.patch('/:id/assign-department', protect, roController.assignDepartment);

module.exports = router;