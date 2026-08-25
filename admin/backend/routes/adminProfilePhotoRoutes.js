const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  validateProfilePhotoRejection,
} = require('../middleware/profilePhotoReviewValidationMiddleware');
const adminProfilePhotoController = require('../controllers/adminProfilePhotoController');

const adminOnly = [protect, authorizeRoles('admin')];
const router = express.Router();

router.get(
  '/',
  ...adminOnly,
  adminProfilePhotoController.getProfilePhotoReviews
);

router.get(
  '/:reviewId',
  ...adminOnly,
  adminProfilePhotoController.getProfilePhotoReviewById
);

router.patch(
  '/:reviewId/approve',
  ...adminOnly,
  adminProfilePhotoController.approveProfilePhotoReview
);

router.patch(
  '/:reviewId/reject',
  ...adminOnly,
  validateProfilePhotoRejection,
  adminProfilePhotoController.rejectProfilePhotoReview
);

module.exports = router;
