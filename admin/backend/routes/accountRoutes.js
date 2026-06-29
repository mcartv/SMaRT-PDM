const express = require('express');
const router = express.Router();

const accountController = require('../controllers/accountController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/staff', protect, authorizeRoles('admin'), accountController.getStaffAccounts);
router.post('/staff', protect, authorizeRoles('admin'), accountController.createStaffAccount);

module.exports = router;
