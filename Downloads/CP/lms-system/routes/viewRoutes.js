/**
 * View Routes
 * Renders EJS pages for the frontend
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Course = require('../models/Course');
const User = require('../models/User');
const Certificate = require('../models/Certificate');
const Transaction = require('../models/Transaction');
const BankService = require('../services/bankService');
const QuizAttempt = require('../models/QuizAttempt');

/**
 * GET / - Home page
 */
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find({ isPublished: true })
      .populate('instructorId', 'name')
      .limit(5);

    res.render('home', {
      title: 'LMS - Learning Management System',
      courses,
      user: req.user || null
    });
  } catch (error) {
    res.render('home', {
      title: 'LMS - Learning Management System',
      courses: [],
      user: null
    });
  }
});

/**
 * GET /dashboard - Role-based dashboard
 */
router.get('/dashboard', protect, async (req, res) => {
  try {
    const user = req.user;

    if (user.role === 'admin') {
      // Admin dashboard
      const totalCourses = await Course.countDocuments();
      const totalLearners = await User.countDocuments({ role: 'learner' });
      const totalInstructors = await User.countDocuments({ role: 'instructor' });
      const transactions = await Transaction.find({ status: 'success' })
        .populate('buyerId', 'name email')
        .populate('courseId', 'title price')
        .sort({ createdAt: -1 })
        .limit(20);
      const allCourses = await Course.find()
        .populate('instructorId', 'name')
        .populate('enrolledStudents.studentId', 'name email');
      const bankResult = await BankService.getBalance('1000000001');

      res.render('adminDashboard', {
        title: 'Admin Dashboard - LMS',
        user,
        stats: { totalCourses, totalLearners, totalInstructors },
        transactions,
        allCourses,
        lmsBalance: bankResult.success ? bankResult.data.balance : 0
      });
    } else if (user.role === 'instructor') {
      // Instructor dashboard
      const courses = await Course.find({ instructorId: user._id })
        .populate('enrolledStudents.studentId', 'name email');
      const bankResult = await BankService.getAccountByUserId(user._id);

      // Pending certificate applications for this instructor's courses
      const courseIds = courses.map(c => c._id);
      const pendingCerts = await Certificate.find({
        courseId: { $in: courseIds }, status: 'pending'
      }).populate('learnerId', 'name email').populate('courseId', 'title');

      res.render('instructorDashboard', {
        title: 'Instructor Dashboard - LMS',
        user,
        courses,
        bankBalance: bankResult.success ? bankResult.data.balance : 0,
        pendingCerts
      });
    } else {
      // Learner dashboard
      const fullUser = await User.findById(user._id).populate({
        path: 'purchasedCourses.courseId',
        populate: { path: 'instructorId', select: 'name' }
      });
      const bankResult = await BankService.getAccountByUserId(user._id);

      // Build certificate status map: courseId -> cert
      const certList = await Certificate.find({ learnerId: user._id });
      const myCertificates = {};
      certList.forEach(c => { myCertificates[c.courseId.toString()] = c; });

      res.render('learnerDashboard', {
        title: 'My Learning - LMS',
        user: fullUser,
        bankBalance: bankResult.success ? bankResult.data.balance : 0,
        hasBankAccount: bankResult.success,
        myCertificates
      });
    }
  } catch (error) {
    res.redirect('/');
  }
});

/**
 * GET /courses-page - Course listing page
 */
router.get('/courses-page', async (req, res) => {
  try {
    const courses = await Course.find({ isPublished: true })
      .populate('instructorId', 'name');

    res.render('courses', {
      title: 'Courses - LMS',
      courses,
      user: req.user || null
    });
  } catch (error) {
    res.render('courses', {
      title: 'Courses - LMS',
      courses: [],
      user: null
    });
  }
});

/**
 * GET /course/:id - Course detail page (access-controlled)
 */
router.get('/course/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructorId', 'name email')
      .populate('enrolledStudents.studentId', 'name email');

    if (!course) {
      return res.redirect('/courses-page');
    }

    const user = req.user;
    let hasPurchased = false;
    let isOwner = false;
    let isAdmin = false;

    if (user) {
      if (user.role === 'admin') {
        isAdmin = true;
      }
      if (user.role === 'instructor' && course.instructorId._id.toString() === user._id.toString()) {
        isOwner = true;
      }
      if (user.role === 'learner') {
        hasPurchased = user.purchasedCourses.some(
          pc => pc.courseId.toString() === course._id.toString()
        );
      }
    }

    // Determine if full content should be shown
    const showContent = hasPurchased || isOwner || isAdmin;

    // Build quiz score map for learner (materialId -> attempt summary)
    let quizScores = {};
    if (user && user.role === 'learner' && hasPurchased) {
      const attempts = await QuizAttempt.find({ learnerId: user._id, courseId: course._id });
      attempts.forEach(a => {
        quizScores[a.materialId.toString()] = {
          score: a.score,
          totalQuestions: a.totalQuestions,
          percentage: a.percentage
        };
      });
    }

    res.render('courseDetail', {
      title: `${course.title} - LMS`,
      course,
      user: user || null,
      hasPurchased,
      isOwner,
      isAdmin,
      showContent,
      quizScores
    });
  } catch (error) {
    res.redirect('/courses-page');
  }
});

/**
 * GET /course-manage/:id - Instructor course management page
 */
router.get('/course-manage/:id', protect, async (req, res) => {
  try {
    const user = req.user;

    // Only instructors can access this page
    if (!user || user.role !== 'instructor') {
      return res.redirect('/dashboard');
    }

    const course = await Course.findById(req.params.id)
      .populate('enrolledStudents.studentId', 'name email');

    if (!course) {
      return res.redirect('/dashboard');
    }

    // Verify the instructor owns this course
    if (course.instructorId.toString() !== user._id.toString()) {
      return res.redirect('/dashboard');
    }

    res.render('instructorCourseManage', {
      title: `Manage: ${course.title} - LMS`,
      user,
      course
    });
  } catch (error) {
    res.redirect('/dashboard');
  }
});

/**
 * GET /certificate-page/:courseId - Certificate view page
 */
router.get('/certificate-page/:courseId', protect, async (req, res) => {
  try {
    const certificate = await Certificate.findOne({
      learnerId: req.user._id,
      courseId: req.params.courseId
    }).populate('courseId', 'title description')
      .populate('learnerId', 'name email');

    if (!certificate) {
      return res.redirect('/dashboard');
    }

    res.render('certificate', {
      title: 'Certificate - LMS',
      certificate,
      user: req.user
    });
  } catch (error) {
    res.redirect('/dashboard');
  }
});

/**
 * GET /profile - View & edit own profile (all roles)
 */
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'purchasedCourses.courseId',
      populate: { path: 'instructorId', select: 'name' }
    });

    // Instructor: count courses & enrolled
    let instructorStats = null;
    if (user.role === 'instructor') {
      const courses = await Course.find({ instructorId: user._id });
      const totalSells = courses.reduce((sum, c) => sum + (c.enrolledCount || 0), 0);
      const totalRatings = courses.reduce((sum, c) => sum + (c.ratingCount || 0), 0);
      const weightedSum = courses.reduce((sum, c) => sum + (c.avgRating || 0) * (c.ratingCount || 0), 0);
      const overallAvgRating = totalRatings > 0 ? Math.round((weightedSum / totalRatings) * 10) / 10 : 0;
      instructorStats = { courseCount: courses.length, totalSells, avgRating: overallAvgRating, totalRatings };
    }

    // Learner: quiz attempts count
    let learnerStats = null;
    if (user.role === 'learner') {
      const quizCount = await QuizAttempt.countDocuments({ learnerId: user._id });
      const completedCount = user.purchasedCourses ? user.purchasedCourses.filter(pc => pc.completed).length : 0;
      learnerStats = { quizCount, completedCount, enrolledCount: user.purchasedCourses ? user.purchasedCourses.length : 0 };
    }

    res.render('profile', {
      title: `${user.name} — Profile`,
      user,
      instructorStats,
      learnerStats,
      isOwnProfile: true
    });
  } catch (error) {
    res.redirect('/dashboard');
  }
});

/**
 * GET /profile/:userId - View another user's public profile
 */
router.get('/profile/:userId', protect, async (req, res) => {
  try {
    // Redirect to own profile if viewing self
    if (req.params.userId === req.user._id.toString()) {
      return res.redirect('/profile');
    }

    const user = await User.findById(req.params.userId).populate({
      path: 'purchasedCourses.courseId',
      populate: { path: 'instructorId', select: 'name' }
    });

    if (!user) return res.redirect('/courses-page');

    let instructorStats = null;
    if (user.role === 'instructor') {
      const courses = await Course.find({ instructorId: user._id });
      const totalSells = courses.reduce((sum, c) => sum + (c.enrolledCount || 0), 0);
      const totalRatings = courses.reduce((sum, c) => sum + (c.ratingCount || 0), 0);
      const weightedSum = courses.reduce((sum, c) => sum + (c.avgRating || 0) * (c.ratingCount || 0), 0);
      const overallAvgRating = totalRatings > 0 ? Math.round((weightedSum / totalRatings) * 10) / 10 : 0;
      instructorStats = { courseCount: courses.length, totalSells, avgRating: overallAvgRating, totalRatings };
    }

    let learnerStats = null;
    if (user.role === 'learner') {
      const quizCount = await QuizAttempt.countDocuments({ learnerId: user._id });
      const completedCount = user.purchasedCourses ? user.purchasedCourses.filter(pc => pc.completed).length : 0;
      learnerStats = { quizCount, completedCount, enrolledCount: user.purchasedCourses ? user.purchasedCourses.length : 0 };
    }

    res.render('profile', {
      title: `${user.name} — Profile`,
      user,
      instructorStats,
      learnerStats,
      isOwnProfile: false,
      currentUser: req.user
    });
  } catch (error) {
    res.redirect('/courses-page');
  }
});

/**
 * GET /transaction-history - Full financial transaction history for learner / instructor
 */
router.get('/transaction-history', protect, async (req, res) => {
  try {
    const user = req.user;
    if (user.role === 'admin') return res.redirect('/dashboard');

    // Full bank ledger (all credit/debit entries)
    const bankResult = await BankService.getAccountByUserId(user._id);
    const bankAccount = bankResult.success ? bankResult.data : null;

    let transactions = [];

    if (user.role === 'learner') {
      // All course purchases made by this learner
      transactions = await Transaction.find({ buyerId: user._id })
        .populate('courseId', 'title price thumbnail')
        .populate('instructorPayment.instructorId', 'name')
        .sort({ createdAt: -1 });
    } else if (user.role === 'instructor') {
      // All sales on this instructor's courses
      transactions = await Transaction.find({ 'instructorPayment.instructorId': user._id })
        .populate('courseId', 'title price thumbnail')
        .populate('buyerId', 'name email avatar')
        .sort({ createdAt: -1 });
    }

    res.render('transactionHistory', {
      title: 'Transaction History — EduLearn Pro',
      user,
      bankAccount,
      transactions
    });
  } catch (error) {
    res.redirect('/dashboard');
  }
});

/**
 * GET /course/:courseId/content/:materialId - individual content page
 */
router.get('/course/:courseId/content/:materialId', async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId)
      .populate('instructorId', 'name email')
      .populate('enrolledStudents.studentId', 'name email');

    if (!course) return res.redirect('/courses-page');

    const user = req.user;
    let hasPurchased = false, isOwner = false, isAdmin = false;

    if (user) {
      if (user.role === 'admin') isAdmin = true;
      if (user.role === 'instructor' && course.instructorId._id.toString() === user._id.toString()) isOwner = true;
      if (user.role === 'learner') {
        hasPurchased = user.purchasedCourses.some(pc => pc.courseId.toString() === course._id.toString());
      }
    }

    const showContent = hasPurchased || isOwner || isAdmin;
    const material = course.materials.id(req.params.materialId);
    if (!material) return res.redirect(`/course/${req.params.courseId}`);

    // For quiz: fetch existing attempt if learner
    let quizAttempt = null;
    if (material.type === 'quiz' && user && user.role === 'learner' && hasPurchased) {
      const QuizAttempt = require('../models/QuizAttempt');
      quizAttempt = await QuizAttempt.findOne({ learnerId: user._id, courseId: course._id, materialId: material._id });
    }

    // Quiz attempts for instructor
    let quizAttempts = null;
    if (material.type === 'quiz' && (isOwner || isAdmin)) {
      const QuizAttempt = require('../models/QuizAttempt');
      quizAttempts = await QuizAttempt.find({ courseId: course._id, materialId: material._id })
        .populate('learnerId', 'name email').sort({ createdAt: -1 });
    }

    // Find index for prev/next navigation
    const matIndex = course.materials.findIndex(m => m._id.toString() === material._id.toString());
    const prevMat = matIndex > 0 ? course.materials[matIndex - 1] : null;
    const nextMat = matIndex < course.materials.length - 1 ? course.materials[matIndex + 1] : null;

    res.render('contentPage', {
      title: `${material.title} — ${course.title}`,
      course,
      material,
      user: user || null,
      hasPurchased,
      isOwner,
      isAdmin,
      showContent,
      quizAttempt,
      quizAttempts,
      prevMat,
      nextMat
    });
  } catch (error) {
    res.redirect('/courses-page');
  }
});

module.exports = router;
