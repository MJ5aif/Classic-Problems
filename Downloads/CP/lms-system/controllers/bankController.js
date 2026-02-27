/**
 * Bank Controller
 * Handles all simulated bank API endpoints
 */

const BankService = require('../services/bankService');
const User = require('../models/User');

/**
 * POST /bank/create-account
 * Create a new bank account for a user
 */
const createAccount = async (req, res) => {
  try {
    const { accountNumber, secretKey } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!accountNumber || !secretKey) {
      return res.status(400).json({
        success: false,
        message: 'Account number and secret key are required'
      });
    }

    // Validate account number format (10 digits)
    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Account number must be exactly 10 digits'
      });
    }

    // Validate secret key length
    if (secretKey.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'Secret key must be at least 4 characters'
      });
    }

    // Create the bank account
    const result = await BankService.createAccount(
      userId,
      accountNumber,
      secretKey,
      req.user.name,
      10000 // Initial balance for simulation
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Update user record with bank info
    await User.findByIdAndUpdate(userId, {
      bankAccountNumber: accountNumber,
      bankSecret: secretKey,
      walletBalance: 10000
    });

    res.status(201).json({
      success: true,
      message: 'Bank account created successfully',
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /bank/transfer
 * Transfer funds between accounts
 */
const transfer = async (req, res) => {
  try {
    const { fromAccountNumber, fromSecret, toAccountNumber, amount, description } = req.body;

    // Validate required fields
    if (!fromAccountNumber || !fromSecret || !toAccountNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: 'All transfer details are required (fromAccountNumber, fromSecret, toAccountNumber, amount)'
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Transfer amount must be positive'
      });
    }

    // Perform the transfer
    const result = await BankService.transfer(
      fromAccountNumber,
      fromSecret,
      toAccountNumber,
      amount,
      description || 'LMS Transaction'
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json({
      success: true,
      message: 'Transfer completed successfully',
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /bank/balance/:accountNumber
 * Get the balance of a bank account
 */
const getBalance = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    const result = await BankService.getBalance(accountNumber);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /bank/my-balance
 * Get balance for the currently logged-in user
 */
const getMyBalance = async (req, res) => {
  try {
    const result = await BankService.getAccountByUserId(req.user._id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'No bank account found. Please set up your bank account first.'
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createAccount, transfer, getBalance, getMyBalance };
