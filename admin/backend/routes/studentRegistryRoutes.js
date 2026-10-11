// SMaRT-PDM: Student Registry — student Registry Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const multer = require('multer');

const router = express.Router();
const studentRegistryController = require('../controllers/studentRegistryController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
const { invalidateCacheOnSuccess } = require('../middleware/appCacheMiddleware');
const invalidateDisciplinaryChanges = invalidateCacheOnSuccess(['scholars', 'applications', 'renewals', 'payouts', 'ro']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

router.get('/', protect, authorizeRoles('admin'), requirePermission('students.view'), studentRegistryController.getRegistry);
router.get('/disciplinary', protect, authorizeRoles('sdo'), requirePermission('discipline.manage'), studentRegistryController.getDisciplinaryRecords);
router.post('/disciplinary/preview', protect, authorizeRoles('sdo'), requirePermission('discipline.manage'), upload.single('file'), studentRegistryController.previewDisciplinaryImport);
router.post('/disciplinary/import', protect, authorizeRoles('sdo'), requirePermission('discipline.manage'), invalidateDisciplinaryChanges, upload.single('file'), studentRegistryController.importDisciplinaryRecords);
router.patch('/disciplinary/:recordId', protect, authorizeRoles('sdo'), requirePermission('discipline.manage'), invalidateDisciplinaryChanges, studentRegistryController.updateDisciplinaryRecord);
router.post(
  '/import',
  protect,
  authorizeRoles('admin'), requirePermission('students.update'),
  upload.single('file'),
  studentRegistryController.importRegistry
);

module.exports = router;
