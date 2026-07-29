const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const controller = require('../controllers/roCoordinatorController');

const router = express.Router();
// RO coordination is an additional capability. A Program Director can keep
// the PD role and access these routes when assigned to an active RO Area.
router.use(protect);
router.get('/summary', controller.getSummary);
router.get('/requests', controller.getRequests);
router.patch('/requests/:placementId/decision', controller.decideRequest);

module.exports = router;
