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

router.get('/', protect, authorizeRoles('admin'), studentRegistryController.getRegistry);
router.post(
  '/import',
  protect,
  authorizeRoles('admin'),
  upload.single('file'),
  studentRegistryController.importRegistry
);

module.exports = router;
