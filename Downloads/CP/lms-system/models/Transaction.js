/**
 * Transaction Model
 * Records all financial transactions in the LMS system
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // The learner who made the purchase
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Buyer ID is required']
  },

  // The course being purchased
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course ID is required']
  },

  // Transaction amount
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },

  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },

  // Payment description
  description: {
    type: String,
    default: ''
  },

  // Reference to instructor payment
  instructorPayment: {
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amount: {
      type: Number,
      default: 0
    }
  },

  // LMS commission
  lmsCommission: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Includes createdAt automatically
});

module.exports = mongoose.model('Transaction', transactionSchema);
