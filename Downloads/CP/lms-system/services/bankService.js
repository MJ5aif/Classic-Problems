/**
 * Bank Service
 * Simulates banking operations (account creation, transfers, balance checks)
 * This acts as an internal "Bank API" for the LMS system
 */

const BankAccount = require('../models/BankAccount');

class BankService {

  /**
   * Create a new bank account
   * @param {string} userId - The user's MongoDB ID
   * @param {string} accountNumber - Desired account number
   * @param {string} secretKey - Secret key for transaction auth
   * @param {string} holderName - Account holder's name
   * @param {number} initialBalance - Starting balance (default: 10000 for simulation)
   * @returns {Object} Created bank account
   */
  static async createAccount(userId, accountNumber, secretKey, holderName, initialBalance = 10000) {
    try {
      // Check if account number already exists
      const existing = await BankAccount.findOne({ accountNumber });
      if (existing) {
        throw new Error('Account number already exists');
      }

      // Check if user already has a bank account
      const userAccount = await BankAccount.findOne({ userId });
      if (userAccount) {
        throw new Error('User already has a bank account');
      }

      // Create the bank account with initial balance
      const account = await BankAccount.create({
        userId,
        accountNumber,
        secretKey,
        holderName,
        balance: initialBalance,
        transactions: [{
          type: 'credit',
          amount: initialBalance,
          description: 'Initial deposit - Welcome bonus'
        }]
      });

      return {
        success: true,
        data: {
          accountNumber: account.accountNumber,
          holderName: account.holderName,
          balance: account.balance,
          isActive: account.isActive
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Validate bank account credentials
   * @param {string} accountNumber - Account number to validate
   * @param {string} secretKey - Secret key to verify
   * @returns {Object} Validation result
   */
  static async validateAccount(accountNumber, secretKey) {
    try {
      const account = await BankAccount.findOne({ accountNumber });

      if (!account) {
        return { success: false, message: 'Bank account not found' };
      }

      if (account.secretKey !== secretKey) {
        return { success: false, message: 'Invalid secret key' };
      }

      if (!account.isActive) {
        return { success: false, message: 'Bank account is inactive' };
      }

      return { success: true, data: account };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Transfer funds between two bank accounts
   * @param {string} fromAccountNumber - Sender's account number
   * @param {string} fromSecret - Sender's secret key
   * @param {string} toAccountNumber - Receiver's account number
   * @param {number} amount - Amount to transfer
   * @param {string} description - Transfer description
   * @returns {Object} Transfer result
   */
  static async transfer(fromAccountNumber, fromSecret, toAccountNumber, amount, description = '') {
    try {
      // Validate amount
      if (amount <= 0) {
        return { success: false, message: 'Transfer amount must be greater than 0' };
      }

      // Validate sender account
      const senderValidation = await this.validateAccount(fromAccountNumber, fromSecret);
      if (!senderValidation.success) {
        return { success: false, message: `Sender validation failed: ${senderValidation.message}` };
      }

      // Find receiver account
      const receiverAccount = await BankAccount.findOne({ accountNumber: toAccountNumber });
      if (!receiverAccount) {
        return { success: false, message: 'Receiver bank account not found' };
      }

      const senderAccount = senderValidation.data;

      // Check sufficient balance
      if (senderAccount.balance < amount) {
        return { 
          success: false, 
          message: `Insufficient funds. Current balance: $${senderAccount.balance}, Required: $${amount}` 
        };
      }

      // Perform the transfer
      senderAccount.balance -= amount;
      senderAccount.transactions.push({
        type: 'debit',
        amount,
        description: description || `Transfer to ${toAccountNumber}`
      });

      receiverAccount.balance += amount;
      receiverAccount.transactions.push({
        type: 'credit',
        amount,
        description: description || `Transfer from ${fromAccountNumber}`
      });

      // Save both accounts
      await senderAccount.save();
      await receiverAccount.save();

      return {
        success: true,
        data: {
          from: fromAccountNumber,
          to: toAccountNumber,
          amount,
          senderBalance: senderAccount.balance,
          receiverBalance: receiverAccount.balance,
          description
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get bank account balance
   * @param {string} accountNumber - Account number to check
   * @returns {Object} Balance info
   */
  static async getBalance(accountNumber) {
    try {
      const account = await BankAccount.findOne({ accountNumber });

      if (!account) {
        return { success: false, message: 'Bank account not found' };
      }

      return {
        success: true,
        data: {
          accountNumber: account.accountNumber,
          holderName: account.holderName,
          balance: account.balance,
          isActive: account.isActive,
          lastTransactions: account.transactions.slice(-5) // Last 5 transactions
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get bank account by user ID
   * @param {string} userId - User's MongoDB ID
   * @returns {Object} Bank account info
   */
  static async getAccountByUserId(userId) {
    try {
      const account = await BankAccount.findOne({ userId });
      if (!account) {
        return { success: false, message: 'No bank account found for this user' };
      }

      return {
        success: true,
        data: {
          accountNumber: account.accountNumber,
          holderName: account.holderName,
          balance: account.balance,
          isActive: account.isActive,
          transactions: account.transactions
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = BankService;
