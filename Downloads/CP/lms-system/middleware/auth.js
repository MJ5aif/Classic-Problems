/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user to request object
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - Verify JWT token
 * Checks for token in cookies or Authorization header
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies first, then Authorization header
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // No token found
    if (!token) {
      // If it's an API request, return JSON
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. No token provided. Please login.'
        });
      }
      // Otherwise redirect to login page
      return res.redirect('/auth/login');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and attach to request
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token is invalid.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    // Token expired or invalid
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please login again.'
      });
    }
    return res.redirect('/auth/login');
  }
};

/**
 * Generate JWT Token
 * @param {string} id - User ID
 * @returns {string} JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

module.exports = { protect, generateToken };
