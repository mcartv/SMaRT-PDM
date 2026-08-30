const express = require('express');
const systemMaintenanceController = require('../controllers/systemMaintenanceController');

const router = express.Router();
router.get('/public', systemMaintenanceController.getPublicState);

module.exports = router;
