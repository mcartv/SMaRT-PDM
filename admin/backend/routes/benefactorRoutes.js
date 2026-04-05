const express = require('express');
const router = express.Router();

const benefactorController = require('../controllers/benefactorController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, benefactorController.getBenefactors);

module.exports = router;