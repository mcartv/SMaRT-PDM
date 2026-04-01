const express = require('express');
const router = express.Router();
const { getApplications, disqualifyApplication } = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');

// Protect all routes in this file
router.use(protect);

router.get('/', getApplications);
router.post('/:id/disqualify', disqualifyApplication);

module.exports = router;