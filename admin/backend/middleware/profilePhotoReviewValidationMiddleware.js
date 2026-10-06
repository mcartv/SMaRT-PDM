// SMaRT-PDM: Profile — profile Photo Review Validation Middleware (admin backend middleware); validates or transforms requests before controller handling.
function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

// validateProfilePhotoRejection: validates validate profile photo rejection for the Profile flow.
function validateProfilePhotoRejection(req, res, next) {
  const reason = safeText(
    req.body?.rejection_reason ?? req.body?.reason
  );

  if (!reason) {
    return res.status(400).json({
      error: 'Rejection reason is required.',
    });
  }

  if (reason.length < 10) {
    return res.status(400).json({
      error: 'Rejection reason must be at least 10 characters and explain what the student needs to correct.',
    });
  }

  req.body = {
    ...(req.body || {}),
    rejection_reason: reason,
    remarks: safeText(req.body?.remarks) || null,
  };

  return next();
}

module.exports = {
  validateProfilePhotoRejection,
};
