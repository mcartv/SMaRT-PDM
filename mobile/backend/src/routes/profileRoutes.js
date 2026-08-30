const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');

const router = express.Router();

router.get('/me', protect, profileController.getMyProfile);
router.post('/setup', protect, profileController.setupMyProfile);
router.patch('/me', protect, profileController.updateMyProfile);
router.get('/me/onboarding', protect, profileController.getMyOnboardingPreference);
router.patch('/me/onboarding', protect, profileController.markMyOnboardingSeen);

module.exports = router;
