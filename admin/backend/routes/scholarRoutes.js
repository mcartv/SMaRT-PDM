const express = require('express');
const router = express.Router();
const scholarController = require('../controllers/scholarController');
const { protect } = require('../middleware/authMiddleware');

router.get('/stats', protect, scholarController.getStats);
router.get('/', protect, scholarController.getAllScholars);
router.get('/:id', protect, scholarController.getScholarById);

module.exports = router;