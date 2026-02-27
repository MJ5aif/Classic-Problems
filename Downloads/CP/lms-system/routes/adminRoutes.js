/**
 * Admin Routes
 * Handles LMS admin operations
 */

const express = require('express');
const router = express.Router();
const { getTransactions, getAdminBalance, getDashboard } = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// All admin routes require admin role
router.get('/transactions', protect, authorize('admin'), getTransactions);
router.get('/balance', protect, authorize('admin'), getAdminBalance);
router.get('/dashboard', protect, authorize('admin'), getDashboard);

module.exports = router;
