/**
 * Admin Controller
 * Handles LMS admin operations (transactions, balance, dashboard)
 */

const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Course = require('../models/Course');
const BankService = require('../services/bankService');

// LMS Organization bank account number
const LMS_ACCOUNT_NUMBER = '1000000001';

/**
 * GET /transactions
 * Get all transactions in the system (Admin only)
 */
const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('buyerId', 'name email')
      .populate('courseId', 'title price')
      .sort({ createdAt: -1 });

    // Calculate summaries
    const totalRevenue = transactions
      .filter(t => t.status === 'success')
      .reduce((sum, t) => sum + t.lmsCommission, 0);

    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'success').length;

    res.status(200).json({
      success: true,
      summary: {
        totalTransactions,
        successfulTransactions,
        totalLMSRevenue: totalRevenue
      },
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /admin/balance
 * Get the LMS organization's bank balance (Admin only)
 */
const getAdminBalance = async (req, res) => {
  try {
    const result = await BankService.getBalance(LMS_ACCOUNT_NUMBER);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'LMS bank account not found. Please run the seed script.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        organization: 'LMS Organization',
        ...result.data
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /admin/dashboard
 * Get comprehensive dashboard data (Admin only)
 */
const getDashboard = async (req, res) => {
  try {
    // Get counts
    const totalCourses = await Course.countDocuments();
    const totalLearners = await User.countDocuments({ role: 'learner' });
    const totalInstructors = await User.countDocuments({ role: 'instructor' });
    const totalTransactions = await Transaction.countDocuments({ status: 'success' });

    // Get recent transactions
    const recentTransactions = await Transaction.find({ status: 'success' })
      .populate('buyerId', 'name')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get LMS balance
    const bankResult = await BankService.getBalance(LMS_ACCOUNT_NUMBER);

    // Get all courses with enrollment data
    const courses = await Course.find()
      .populate('instructorId', 'name')
      .sort({ enrolledCount: -1 });

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalCourses,
          totalLearners,
          totalInstructors,
          totalTransactions
        },
        lmsBalance: bankResult.success ? bankResult.data.balance : 0,
        recentTransactions,
        courses
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getTransactions, getAdminBalance, getDashboard };
