// SMaRT-PDM: Return of Obligations — system Maintenance Routes (mobile backend route); maps mobile API endpoints to middleware and controllers.
const express = require('express');
const systemMaintenanceController = require('../controllers/systemMaintenanceController');

const router = express.Router();
router.get('/public', systemMaintenanceController.getPublicState);

module.exports = router;
