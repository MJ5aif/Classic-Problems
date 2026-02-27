/**
 * Auth Controller
 * Handles user registration, login, and authentication
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

/**
 * POST /auth/register
 * Register a new user (learner by default)
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please login instead.'
      });
    }

    // Allow 'learner' or 'instructor' for public registration; block 'admin'
    const userRole = (role === 'instructor') ? 'instructor' : 'learner';

    // Create the user
    const user = await User.create({
      name,
      email,
      password,
      role: userRole
    });

    // Generate JWT token
    const token = generateToken(user._id);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: process.env.NODE_ENV === 'production'
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /auth/login
 * Login user and return JWT token
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user by email (include password for comparison)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production'
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          hasBankAccount: !!user.bankAccountNumber
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /auth/logout
 * Logout user and clear cookie
 */
const logout = (req, res) => {
  res.cookie('token', '', { maxAge: 1 });
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

/**
 * GET /auth/me
 * Get current logged-in user profile
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('purchasedCourses.courseId');
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// MULTER — profile picture upload
// ─────────────────────────────────────────────
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/profiles');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, unique);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/i;
    if (allowed.test(path.extname(file.originalname)) && allowed.test(file.mimetype.split('/')[1])) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed (jpeg, jpg, png, gif, webp)'), false);
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB (for large cover photos)
});

/**
 * PUT /auth/profile
 * Update current user's profile info
 */
const updateProfile = async (req, res) => {
  try {
    const { name, bio, headline, location, website, linkedinUrl, skills } = req.body;

    const updates = {};
    if (name !== undefined && name.trim()) updates.name = name.trim();
    if (bio !== undefined) updates.bio = bio.slice(0, 600);
    if (headline !== undefined) updates.headline = headline.slice(0, 150);
    if (location !== undefined) updates.location = location.slice(0, 100);
    if (website !== undefined) updates.website = website;
    if (linkedinUrl !== undefined) updates.linkedinUrl = linkedinUrl;
    if (skills !== undefined) {
      const arr = Array.isArray(skills) ? skills : skills.split(',');
      updates.skills = arr.map(s => s.trim()).filter(Boolean).slice(0, 20);
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true, runValidators: true
    });

    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /auth/profile/picture
 * Upload / replace profile picture
 */
const uploadProfilePicture = [
  profileUpload.single('profilePicture'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file uploaded' });
      }

      const newPath = `/uploads/profiles/${req.file.filename}`;

      // Delete old picture if it's a locally uploaded one
      const existing = await User.findById(req.user._id).select('profilePicture');
      if (existing.profilePicture && existing.profilePicture.startsWith('/uploads/profiles/')) {
        const oldFile = path.join(__dirname, '../public', existing.profilePicture);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { profilePicture: newPath },
        { new: true }
      );

      res.json({ success: true, message: 'Profile picture updated', data: { profilePicture: user.profilePicture } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
];

/**
 * PUT /auth/profile/cover
 * Upload / replace cover photo
 */
const uploadCoverPhoto = [
  profileUpload.single('coverPhoto'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file uploaded' });
      }

      const newPath = `/uploads/profiles/${req.file.filename}`;

      // Delete old cover if locally uploaded
      const existing = await User.findById(req.user._id).select('coverPhoto');
      if (existing.coverPhoto && existing.coverPhoto.startsWith('/uploads/profiles/')) {
        const oldFile = path.join(__dirname, '../public', existing.coverPhoto);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { coverPhoto: newPath },
        { new: true }
      );

      res.json({ success: true, message: 'Cover photo updated', data: { coverPhoto: user.coverPhoto } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
];

// ─────────────────────────────────────────────
// PUT /auth/change-pin  — change bank PIN
// ─────────────────────────────────────────────
const changeBankPin = async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin) {
      return res.status(400).json({ success: false, message: 'Current PIN and new PIN are required.' });
    }
    if (!/^\d{4}$/.test(String(newPin))) {
      return res.status(400).json({ success: false, message: 'New PIN must be exactly 4 digits.' });
    }
    const user = await User.findById(req.user._id).select('+bankPin');
    const expectedPin = user.bankPin || '1234';
    if (String(currentPin).trim() !== String(expectedPin).trim()) {
      return res.status(400).json({ success: false, message: 'Current PIN is incorrect.' });
    }
    user.bankPin = String(newPin);
    await user.save();
    res.json({ success: true, message: 'Bank PIN changed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, logout, getMe, updateProfile, uploadProfilePicture, uploadCoverPhoto, changeBankPin };