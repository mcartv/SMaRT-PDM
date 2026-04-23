const express = require('express');
const { createOcrJob, getOcrJobs } = require('../controllers/ocrController');

const router = express.Router();

router.post('/jobs', createOcrJob);
router.get('/jobs', getOcrJobs);

module.exports = router;
