const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');

const router = express.Router();

router.get('/me', protect, profileController.getMyProfile);
router.patch('/me', protect, profileController.updateMyProfile);

module.exports = router;