const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const controller = require('../controllers/roCoordinatorController');

const router = express.Router();
// RO coordination is an additional capability. A Program Director can keep
// the PD role and access these routes when assigned to an active RO Area.
router.use(protect, authorizeRoles('admin', 'pd', 'ro_coordinator'));
router.get('/summary', controller.getSummary);
router.get('/requests', controller.getRequests);
router.get('/scholar-requests', controller.getScholarRequests);
router.post('/scholar-requests', controller.createScholarRequest);
router.patch('/scholar-requests/:requestId/cancel', controller.cancelScholarRequest);
router.patch('/requests/:placementId/decision', controller.decideRequest);
router.get('/attendance', controller.getAttendanceQueue);
router.patch('/attendance/:logId/decision', controller.validateAttendance);

module.exports = router;

