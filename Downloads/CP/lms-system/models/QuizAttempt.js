/**
 * QuizAttempt Model
 * Records each learner's attempt at a course quiz material
 */

const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
  // The learner who attempted
  learnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // The course the quiz belongs to
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },

  // The specific material (quiz) id inside the course
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  // Answers submitted: array index = question index, value = chosen option index (0-3)
  answers: {
    type: [Number],
    default: []
  },

  // Graded results
  score: { type: Number, default: 0 },           // correct answers count
  totalQuestions: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },       // 0-100

  // How long learner took (seconds)
  timeTaken: { type: Number, default: 0 },

  // Was it a timeout submission or manual submit
  timedOut: { type: Boolean, default: false }

}, {
  timestamps: true
});

// A learner can have only one attempt per quiz (re-attempt overwrites)
quizAttemptSchema.index({ learnerId: 1, courseId: 1, materialId: 1 }, { unique: true });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
