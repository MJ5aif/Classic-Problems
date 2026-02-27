/**
 * Auth Routes
 * Handles registration, login, logout, and profile
 */

const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, updateProfile, uploadProfilePicture, uploadCoverPhoto, changeBankPin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/profile/picture', protect, ...uploadProfilePicture);
router.put('/profile/cover', protect, ...uploadCoverPhoto);
router.put('/change-pin', protect, changeBankPin);

// View routes (render EJS pages)
router.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'Login - LMS', user: null });
});

router.get('/register', (req, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  res.render('register', { title: 'Register - LMS', user: null });
});

module.exports = router;
