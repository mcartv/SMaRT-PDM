const express = require('express');
const publicSettingsController = require('../controllers/publicSettingsController');

const router = express.Router();

router.get('/public', publicSettingsController.getPublicGeneralSettings);

module.exports = router;
