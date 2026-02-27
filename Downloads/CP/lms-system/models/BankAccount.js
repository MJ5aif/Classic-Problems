/**
 * BankAccount Model
 * Simulated bank accounts for the LMS banking system
 */

const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  // Account holder reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Unique account number
  accountNumber: {
    type: String,
    required: true,
    unique: true
  },

  // Secret key for transaction authentication
  secretKey: {
    type: String,
    required: true
  },

  // Account holder name
  holderName: {
    type: String,
    required: true
  },

  // Current balance
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },

  // Account status
  isActive: {
    type: Boolean,
    default: true
  },

  // Transaction history for this bank account
  transactions: [{
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    date: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('BankAccount', bankAccountSchema);
