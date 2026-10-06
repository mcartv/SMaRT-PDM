// SMaRT-PDM: Profile — admin Profile Photo Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const adminProfilePhotoService = require('../services/adminProfilePhotoService');
const { getSafeStatusCode } = require('../utils/httpStatus');

// getRequestUserId: reads and returns get request user id for the Profile flow.
function getRequestUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// getProfilePhotoReviews: reads and returns get profile photo reviews for the Profile flow.
async function getProfilePhotoReviews(req, res) {
  try {
    const result = await adminProfilePhotoService.getProfilePhotoReviews({
      adminUserId: getRequestUserId(req),
      query: req.query || {},
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('ADMIN PROFILE PHOTO LIST ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load profile photo reviews.',
    });
  }
}

// getProfilePhotoReviewById: reads and returns get profile photo review by id for the Profile flow.
async function getProfilePhotoReviewById(req, res) {
  try {
    const result = await adminProfilePhotoService.getProfilePhotoReviewById({
      adminUserId: getRequestUserId(req),
      reviewId: req.params.reviewId,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('ADMIN PROFILE PHOTO DETAIL ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load profile photo review.',
    });
  }
}

// approveProfilePhotoReview: handles approve profile photo review for the Profile flow.
async function approveProfilePhotoReview(req, res) {
  try {
    const result = await adminProfilePhotoService.approveProfilePhotoReview({
      adminUserId: getRequestUserId(req),
      reviewId: req.params.reviewId,
      remarks: req.body?.remarks,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('ADMIN PROFILE PHOTO APPROVE ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to approve profile photo.',
    });
  }
}

// rejectProfilePhotoReview: handles reject profile photo review for the Profile flow.
async function rejectProfilePhotoReview(req, res) {
  try {
    const result = await adminProfilePhotoService.rejectProfilePhotoReview({
      adminUserId: getRequestUserId(req),
      reviewId: req.params.reviewId,
      rejectionReason: req.body?.rejection_reason || req.body?.reason,
      remarks: req.body?.remarks,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('ADMIN PROFILE PHOTO REJECT ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to reject profile photo.',
    });
  }
}

module.exports = {
  getProfilePhotoReviews,
  getProfilePhotoReviewById,
  approveProfilePhotoReview,
  rejectProfilePhotoReview,
};
