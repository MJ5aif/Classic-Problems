/**
 * Certificate Model
 * Represents completion certificates issued to learners
 */

const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  // The learner who earned the certificate
  learnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Learner ID is required']
  },

  // The completed course
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course ID is required']
  },

  // Date the certificate was issued
  issueDate: {
    type: Date,
    default: Date.now
  },

  // Unique certificate ID for verification
  certificateNumber: {
    type: String,
    unique: true
  },

  // Application status: pending (applied), accepted, rejected
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },

  // Instructor who reviews the application
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // When student applied
  appliedAt: {
    type: Date,
    default: Date.now
  },

  // When instructor reviewed
  reviewedAt: {
    type: Date,
    default: null
  },

  // Rejection reason (optional)
  rejectionReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

/**
 * Pre-save middleware: Generate unique certificate number
 */
certificateSchema.pre('save', function() {
  if (!this.certificateNumber) {
    // Generate format: CERT-YEAR-RANDOM
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.certificateNumber = `CERT-${year}-${random}`;
  }
});

module.exports = mongoose.model('Certificate', certificateSchema);
