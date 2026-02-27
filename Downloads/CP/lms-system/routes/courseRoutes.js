/**
 * Course Routes
 * Handles course listing, purchasing, materials (video/document/quiz), completion, certificates
 */

const express = require('express');
const router = express.Router();
const {
  getCourses,
  getCourseById,
  createCourse,
  addVideoMaterial,
  addDocumentMaterial,
  addQuizMaterial,
  addAnnouncementMaterial,
  addBlogMaterial,
  getQuizAttempts,
  submitQuiz,
  getQuizResult,
  removeMaterial,
  buyCourse,
  getMyCourses,
  applyCertificate,
  reviewCertificate,
  getInstructorCertApps,
  getCertificate,
  getInstructorCourses,
  getEnrolledStudents,
  editMaterial,
  rateCourse
} = require('../controllers/courseController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// Public route — Get all published courses
router.get('/', getCourses);

// Learner routes
router.post('/buy/:id', protect, authorize('learner'), buyCourse);
router.get('/my-courses', protect, authorize('learner'), getMyCourses);
router.post('/certificate/apply/:courseId', protect, authorize('learner'), applyCertificate);
router.get('/certificate/:courseId', protect, authorize('learner'), getCertificate);

// Instructor certificate review routes
router.get('/certificates/pending', protect, authorize('instructor', 'admin'), getInstructorCertApps);
router.put('/certificate/:certId/review', protect, authorize('instructor', 'admin'), reviewCertificate);

// Quiz submit & result (learner)
router.post('/:courseId/quiz/:materialId/submit', protect, authorize('learner'), submitQuiz);
router.get('/:courseId/quiz/:materialId/result', protect, authorize('learner'), getQuizResult);

// Instructor routes
router.post('/', protect, authorize('instructor'), createCourse);
router.put('/:id/material/video', protect, authorize('instructor'), addVideoMaterial);
router.put('/:id/material/document', protect, authorize('instructor'), addDocumentMaterial);
router.put('/:id/material/quiz', protect, authorize('instructor'), addQuizMaterial);
router.put('/:id/material/announcement', protect, authorize('instructor'), addAnnouncementMaterial);
router.put('/:id/material/blog', protect, authorize('instructor'), addBlogMaterial);
router.get('/:courseId/quiz/:materialId/attempts', protect, authorize('instructor', 'admin'), getQuizAttempts);
router.delete('/:courseId/material/:materialId', protect, authorize('instructor'), removeMaterial);
router.put('/:courseId/material/:materialId/edit', protect, authorize('instructor'), editMaterial);
router.get('/instructor/my-courses', protect, authorize('instructor'), getInstructorCourses);

// Enrolled students (instructor or admin)
router.get('/:id/enrolled', protect, authorize('instructor', 'admin'), getEnrolledStudents);

// Rate a course (learner who purchased it)
router.post('/:courseId/rate', protect, authorize('learner'), rateCourse);

// Get single course (any user)
router.get('/:id', getCourseById);

module.exports = router;
