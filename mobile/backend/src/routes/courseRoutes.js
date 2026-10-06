// SMaRT-PDM: Return of Obligations — course Routes (mobile backend route); maps mobile API endpoints to middleware and controllers.
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const courseController = require('../controllers/courseController');

const router = express.Router();

router.get('/', protect, courseController.getCourses);

module.exports = router;