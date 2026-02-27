/**
 * Bank Routes
 * Simulated Bank API endpoints
 */

const express = require('express');
const router = express.Router();
const { createAccount, transfer, getBalance, getMyBalance } = require('../controllers/bankController');
const { protect } = require('../middleware/auth');

// All bank routes require authentication
router.post('/create-account', protect, createAccount);
router.post('/transfer', protect, transfer);
router.get('/my-balance', protect, getMyBalance);
router.get('/balance/:accountNumber', protect, getBalance);

module.exports = router;
