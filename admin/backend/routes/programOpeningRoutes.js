const express = require('express');
const router = express.Router();

const programOpeningController = require('../controllers/programOpeningController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, programOpeningController.getProgramOpenings);
router.post('/', protect, programOpeningController.createProgramOpening);
router.patch('/:id', protect, programOpeningController.updateProgramOpening);

module.exports = router;