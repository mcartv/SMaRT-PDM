const express = require('express');
const selectionController = require('../controllers/selectionController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, authorizeRoles('admin'));
router.get('/openings/:openingId/preview', selectionController.getPreview);
router.post('/openings/:openingId/finalize', selectionController.finalize);
router.post('/openings/:openingId/promote-next', selectionController.promote);
router.patch('/applications/:applicationId/qualify', selectionController.markQualified);

module.exports = router;
