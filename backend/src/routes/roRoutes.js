const express = require('express');
const multer = require('multer');

const roController = require('../controllers/roController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },

  /*
   * Do not reject based only on file.mimetype here.
   *
   * Flutter, Android, iOS, and some web clients may send valid images as:
   * - application/octet-stream
   * - binary/octet-stream
   * - an empty MIME type
   *
   * The service validates the filename and actual file signature instead.
   */
  fileFilter: (_req, _file, callback) => {
    callback(null, true);
  },
});

function runUpload(fieldName) {
  return function uploadMiddleware(req, res, next) {
    upload.single(fieldName)(req, res, (error) => {
      if (!error) {
        return next();
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            message: 'The uploaded photo is too large. Maximum size is 8 MB.',
            error: 'The uploaded photo is too large. Maximum size is 8 MB.',
          });
        }

        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            message: `Unexpected upload field. Use "${fieldName}" as the file field name.`,
            error: `Unexpected upload field. Use "${fieldName}" as the file field name.`,
          });
        }

        return res.status(400).json({
          message: error.message || 'Invalid multipart upload.',
          error: error.message || 'Invalid multipart upload.',
        });
      }

      return res.status(400).json({
        message: error.message || 'Failed to process the uploaded file.',
        error: error.message || 'Failed to process the uploaded file.',
      });
    });
  };
}

router.get('/me', protect, roController.getMyAssignments);

router.post(
  '/:roId/acknowledge',
  protect,
  roController.acknowledgeMyRo
);

router.post(
  '/:roId/conflict',
  protect,
  roController.reportMyRoConflict
);

router.post(
  '/:roId/time-in',
  protect,
  runUpload('photo'),
  roController.timeInMyRo
);

/*
 * PATCH is the main time-out endpoint.
 */
router.patch(
  '/:roId/time-out',
  protect,
  runUpload('photo'),
  roController.timeOutMyRo
);

/*
 * POST is retained for compatibility with older mobile builds.
 */
router.post(
  '/:roId/time-out',
  protect,
  runUpload('photo'),
  roController.timeOutMyRo
);

router.post(
  '/:roId/submit',
  protect,
  runUpload('proof'),
  roController.submitMyCompletion
);

module.exports = router;