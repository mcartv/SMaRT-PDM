const express = require('express');
const router = express.Router();

const programOpeningController = require('../controllers/programOpeningController');
const { protect } = require('../middleware/authMiddleware');

// IMPORTANT: fixed/static routes first
router.get('/admin/applications-summary', protect, programOpeningController.getOpeningsApplicationSummary);
router.get('/mobile', programOpeningController.getMobileOpenings);
router.get('/', protect, programOpeningController.getAllProgramOpenings);
router.get('/:openingId', protect, programOpeningController.getProgramOpeningById);
router.get('/:openingId/applications', protect, programOpeningController.getApplicationsByOpeningId);

router.post('/', protect, programOpeningController.createProgramOpening);
router.patch('/:openingId', protect, programOpeningController.updateProgramOpening);
router.patch('/:openingId/close', protect, programOpeningController.closeProgramOpening);

module.exports = router;