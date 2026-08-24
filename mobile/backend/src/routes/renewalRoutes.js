const express = require('express');
const multer = require('multer');

const renewalController = require('../controllers/renewalController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 8 * 1024 * 1024,
    },
});

router.get(
    '/me/current',
    protect,
    renewalController.getCurrentRenewal
);

router.post(
    '/me/documents/:routeParam/upload',
    protect,
    upload.single('document'),
    renewalController.uploadDocument
);

router.post(
    '/me/submit',
    protect,
    renewalController.submitRenewal
);

module.exports = router;