const express = require('express');
const multer = require('multer');

const router = express.Router();
const studentRegistryController = require('../controllers/studentRegistryController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

router.get('/', protect, authorizeRoles('admin', 'sdo'), studentRegistryController.getRegistry);
router.get(
  '/sdo-records/summary',
  protect,
  authorizeRoles('sdo'),
  studentRegistryController.getSdoRecordsSummary
);
router.get(
  '/sdo-records/students',
  protect,
  authorizeRoles('sdo'),
  studentRegistryController.getSdoStudentsWithRecords
);
router.get(
  '/sdo-records/students/:studentNumber',
  protect,
  authorizeRoles('sdo'),
  studentRegistryController.getSdoStudentRecordHistory
);
router.post(
  '/import/preview',
  protect,
  authorizeRoles('sdo'),
  upload.single('file'),
  studentRegistryController.previewSdoImport
);
router.post(
  '/import',
  protect,
  authorizeRoles('admin', 'sdo'),
  upload.single('file'),
  studentRegistryController.importRegistry
);

module.exports = router;
