const express = require('express');
const multer = require('multer');

const { protect } = require('../middleware/authMiddleware');
const roController = require('../controllers/roController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

/*
  Mobile scholar RO page:
  GET    /api/ro/me
  POST   /api/ro/:roId/time-in
  PATCH  /api/ro/:roId/time-out
*/
router.get('/me', protect, roController.getMyAssignments);
router.post('/:roId/time-in', protect, roController.timeInMyRo);
router.patch('/:roId/time-out', protect, roController.timeOutMyRo);
router.post('/:roId/time-out', protect, roController.timeOutMyRo);

/*
  Legacy route kept so old mobile screens do not crash.
  This no longer uses proof_file_url/rendered_hours.
*/
router.post(
  '/:roId/submit',
  protect,
  upload.single('proof'),
  roController.submitMyCompletion
);

module.exports = router;