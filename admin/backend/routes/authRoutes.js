const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.adminLogin);
router.post('/sdo/login', authController.sdoLogin);

module.exports = router;