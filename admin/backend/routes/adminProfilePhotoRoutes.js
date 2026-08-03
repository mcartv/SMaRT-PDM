const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const adminProfilePhotoController = require('../controllers/adminProfilePhotoController');

const router = express.Router();

router.use(protect, authorizeRoles('admin'));

router.get('/', adminProfilePhotoController.getProfilePhotoReviews);
router.get('/:reviewId', adminProfilePhotoController.getProfilePhotoReviewById);

router.patch(
  '/:reviewId/approve',
  adminProfilePhotoController.approveProfilePhotoReview
);

router.patch(
  '/:reviewId/reject',
  adminProfilePhotoController.rejectProfilePhotoReview
);

module.exports = router;
