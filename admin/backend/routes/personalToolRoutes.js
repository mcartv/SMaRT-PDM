const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const personalToolController = require('../controllers/personalToolController');

const router = express.Router();

router.use(protect);
router.get('/', personalToolController.getWorkspace);
router.patch('/note', personalToolController.updateNote);
router.post('/events', personalToolController.addEvent);
router.delete('/events/:eventId', personalToolController.deleteEvent);

module.exports = router;
