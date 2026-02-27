/**
 * User Model
 * Represents all users in the LMS system (admin, instructor, learner)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Full name of the user
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },

  // Email address (unique identifier for login)
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },

  // Hashed password
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },

  // User role: admin, instructor, or learner
  role: {
    type: String,
    enum: ['admin', 'instructor', 'learner'],
    default: 'learner'
  },

  // Simulated bank account number
  bankAccountNumber: {
    type: String,
    default: null
  },

  // Simulated bank secret key for transactions
  bankSecret: {
    type: String,
    default: null
  },

  // Wallet balance for simulated transactions
  walletBalance: {
    type: Number,
    default: 0
  },

  // Courses purchased by the learner
  purchasedCourses: [{
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    },
    purchasedAt: {
      type: Date,
      default: Date.now
    },
    completed: {
      type: Boolean,
      default: false
    }
  }],

  // ── Profile fields ──────────────────────────────
  profilePicture: {
    type: String,
    default: null
  },
  coverPhoto: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: '',
    maxlength: [600, 'Bio cannot exceed 600 characters']
  },
  headline: {
    type: String,
    default: '',
    maxlength: [150, 'Headline cannot exceed 150 characters']
  },
  location: {
    type: String,
    default: '',
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  website: {
    type: String,
    default: ''
  },
  linkedinUrl: {
    type: String,
    default: ''
  },
  skills: [{
    type: String,
    trim: true
  }],

  // 4-digit bank PIN for course purchases (default 1234)
  bankPin: {
    type: String,
    default: '1234',
    select: false  // never returned in queries by default
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

/**
 * Pre-save middleware: Hash password before saving
 */
userSchema.pre('save', async function() {
  // Only hash if password is modified
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance method: Compare entered password with hashed password
 */
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
