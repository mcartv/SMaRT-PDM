const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const openingController = require('../controllers/openingController');

const router = express.Router();

router.get('/', protect, openingController.getOpenings);
router.get('/latest', protect, openingController.getLatestOpening);
router.post('/:openingId/apply', protect, openingController.applyToOpening);

module.exports = router;