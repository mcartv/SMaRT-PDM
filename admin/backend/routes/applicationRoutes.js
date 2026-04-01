const express = require('express');
const router = express.Router();
const {
    getApplications,
    getApplicationDocuments,
    disqualifyApplication,
} = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getApplications);
router.get('/:id/documents', getApplicationDocuments);
router.post('/:id/disqualify', disqualifyApplication);

module.exports = router;