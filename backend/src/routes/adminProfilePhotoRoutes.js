const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const adminProfilePhotoController = require('../controllers/adminProfilePhotoController');

const router = express.Router();

router.get('/', protect, adminProfilePhotoController.getProfilePhotoReviews);
router.get('/:reviewId', protect, adminProfilePhotoController.getProfilePhotoReviewById);

router.patch(
  '/:reviewId/approve',
  protect,
  adminProfilePhotoController.approveProfilePhotoReview
);

router.patch(
  '/:reviewId/reject',
  protect,
  adminProfilePhotoController.rejectProfilePhotoReview
);

module.exports = router;
