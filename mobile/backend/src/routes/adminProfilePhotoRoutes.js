// SMaRT-PDM: Return of Obligations — admin Profile Photo Routes (mobile backend route); maps mobile API endpoints to middleware and controllers.
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
