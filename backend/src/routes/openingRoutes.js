const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const openingController = require('../controllers/openingController');

const router = express.Router();

/*
  Specific route first.
*/
router.get('/latest', protect, openingController.getLatestOpening);
router.get('/', protect, openingController.getOpenings);

router.post('/:openingId/apply', protect, openingController.applyToOpening);

module.exports = router;