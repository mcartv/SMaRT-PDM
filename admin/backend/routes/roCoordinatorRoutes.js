const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoleGroup } = require('../middleware/rbacMiddleware');
const controller = require('../controllers/roCoordinatorController');

const router = express.Router();
// RO coordination is an additional assignment-based capability. PD, SDO, and Guidance
// staff keep their primary role and access these routes only with an active RO Area assignment.
router.use(protect, authorizeRoleGroup('RO_COORDINATOR_CAPABLE'));
router.get('/summary', controller.getSummary);
router.get('/requests', controller.getRequests);
router.get('/scholar-requests', controller.getScholarRequests);
router.post('/scholar-requests', controller.createScholarRequest);
router.patch('/scholar-requests/:requestId/cancel', controller.cancelScholarRequest);
router.patch('/requests/:placementId/decision', controller.decideRequest);
router.get('/attendance', controller.getAttendanceQueue);
router.patch('/attendance/:logId/decision', controller.validateAttendance);

module.exports = router;

