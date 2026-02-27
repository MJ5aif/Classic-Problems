/**
 * Learner Routes
 * Handles learner-specific balance check
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const BankService = require('../services/bankService');

/**
 * GET /learner/balance
 * Get learner's bank balance
 */
router.get('/balance', protect, authorize('learner'), async (req, res) => {
  try {
    const result = await BankService.getAccountByUserId(req.user._id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'No bank account found. Please set up your bank account.'
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
