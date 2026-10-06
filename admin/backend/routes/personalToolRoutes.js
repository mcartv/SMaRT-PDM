// SMaRT-PDM: Return of Obligations — personal Tool Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoleGroup } = require('../middleware/rbacMiddleware');
const personalToolController = require('../controllers/personalToolController');

const router = express.Router();

router.use(protect, authorizeRoleGroup('ALL_STAFF'));
router.get('/', personalToolController.getWorkspace);
router.patch('/note', personalToolController.updateNote);
router.post('/events', personalToolController.addEvent);
router.delete('/events/:eventId', personalToolController.deleteEvent);

module.exports = router;
