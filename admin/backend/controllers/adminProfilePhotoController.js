const adminProfilePhotoService = require('../services/adminProfilePhotoService');
const auditLogService = require('../services/auditLogService');
const { getSafeStatusCode } = require('../utils/httpStatus');

function getRequestUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

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
