const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const publicSettingsController = require('../controllers/publicSettingsController');

const router = express.Router();

router.get('/', protect, publicSettingsController.getScholarshipPrograms);

module.exports = router;
