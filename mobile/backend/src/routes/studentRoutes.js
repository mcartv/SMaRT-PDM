// SMaRT-PDM: Return of Obligations — student Routes (mobile backend route); maps mobile API endpoints to middleware and controllers.
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const studentController = require('../controllers/studentController');

const router = express.Router();

router.get('/me/status', protect, studentController.getMyStatus);

module.exports = router;