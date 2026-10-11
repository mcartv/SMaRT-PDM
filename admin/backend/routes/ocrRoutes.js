// SMaRT-PDM: OCR — ocr Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');

const ocrController = require('../controllers/ocrController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];

const router = express.Router();

router.post('/jobs', ...adminOnly, requirePermission('documents.review'), ocrController.createOcrJob);

module.exports = router;
