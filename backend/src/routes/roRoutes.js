const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const roController = require('../controllers/roController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/me', protect, roController.getMyAssignments);

router.post('/:roId/acknowledge', protect, roController.acknowledgeMyRo);
router.post('/:roId/conflict', protect, roController.reportMyRoConflict);

router.post('/:roId/time-in', protect, roController.timeInMyRo);
router.patch('/:roId/time-out', protect, roController.timeOutMyRo);
router.post('/:roId/time-out', protect, roController.timeOutMyRo);

router.post(
  '/:roId/submit',
  protect,
  upload.single('proof'),
  roController.submitMyCompletion
);

module.exports = router;