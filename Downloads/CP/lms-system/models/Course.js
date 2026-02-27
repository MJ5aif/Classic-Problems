/**
 * Course Model
 * Represents courses available in the LMS platform
 */

const mongoose = require('mongoose');

// Quiz question sub-schema
const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: {
    type: [String],
    validate: {
      validator: v => v.length === 4,
      message: 'Each question must have exactly 4 options'
    },
    required: true
  },
  correctAnswer: { type: Number, min: 0, max: 3, required: true } // index 0-3
}, { _id: true });

// Material sub-schema — supports three types: video, document, quiz
const materialSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },

  type: {
    type: String,
    enum: ['video', 'document', 'quiz', 'announcement', 'blog'],
    required: true
  },

  order: { type: Number, default: 0 },

  // ── VIDEO fields ──────────────────────────────────────
  videoSource: {
    type: String,
    enum: ['youtube', 'upload'],
    default: 'youtube'
  },
  videoUrl: { type: String, default: '' },   // YouTube watch URL
  videoFile: { type: String, default: '' },  // Uploaded file path

  // ── DOCUMENT fields ───────────────────────────────────
  driveLink: { type: String, default: '' },  // Google Drive / external link
  pdfFile:   { type: String, default: '' },  // Locally uploaded PDF path

  // ── QUIZ fields ───────────────────────────────────────
  quiz: {
    timer: { type: Number, default: 10 },    // minutes
    questions: [questionSchema]
  },

  // ── ANNOUNCEMENT / BLOG fields ────────────────────────
  content:    { type: String, default: '' }, // Plain text or markdown-lite body
  codeBlocks: [{                             // Code snippets for blog posts
    language: { type: String, default: 'javascript' },
    code:     { type: String, default: '' },
    caption:  { type: String, default: '' }
  }]
}, { _id: true });

const courseSchema = new mongoose.Schema({
  // Course title
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  // Course description
  description: {
    type: String,
    required: [true, 'Course description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },

  // Course price in USD
  price: {
    type: Number,
    required: [true, 'Course price is required'],
    min: [0, 'Price cannot be negative']
  },

  // Reference to the instructor who created the course
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Instructor ID is required']
  },

  // Array of course materials/content
  materials: [materialSchema],

  // Students who enrolled (purchased) this course
  enrolledStudents: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Whether the course is published and visible to learners
  isPublished: {
    type: Boolean,
    default: false
  },

  // Thumbnail/image URL for the course
  thumbnail: {
    type: String,
    default: 'https://via.placeholder.com/400x200?text=Course+Image'
  },

  // Category for filtering
  category: {
    type: String,
    default: 'General'
  },

  // Number of enrolled students
  enrolledCount: {
    type: Number,
    default: 0
  },

  // Course ratings from learners
  ratings: [{
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    value:     { type: Number, min: 1, max: 5, required: true },
    review:    { type: String, default: '', maxlength: 500 },
    createdAt: { type: Date, default: Date.now }
  }],

  // Cached averages (updated on every new rating)
  avgRating:   { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Course', courseSchema);
