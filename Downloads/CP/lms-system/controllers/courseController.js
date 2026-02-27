/**
 * Course Controller
 * Handles course CRUD, material upload (video/document/quiz), purchasing, completion, certificates
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const Course = require('../models/Course');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Certificate = require('../models/Certificate');
const QuizAttempt = require('../models/QuizAttempt');
const BankService = require('../services/bankService');
const BankAccount = require('../models/BankAccount');

// LMS Organisation bank account
const LMS_ACCOUNT_NUMBER = '1000000001';
const LMS_SECRET = 'lms_secret_2024';

// ─────────────────────────────────────────────
// MULTER — local video upload
// ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/videos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /mp4|mov|avi|mkv|webm/i;
  if (allowed.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed (mp4, mov, avi, mkv, webm)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB
});

// Export multer middleware so routes can use it
const uploadVideoMiddleware = upload.single('videoFile');

// ─────────────────────────────────────────────
// GET /courses — all published courses
// ─────────────────────────────────────────────
const getCourses = async (req, res) => {
  try {
    const courses = await Course.find({ isPublished: true })
      .populate('instructorId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: courses.length, data: courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /courses/:id
// ─────────────────────────────────────────────
const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructorId', 'name email');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /courses — create course (Instructor)
// ─────────────────────────────────────────────
const createCourse = async (req, res) => {
  try {
    const { title, description, price, category } = req.body;

    if (!title || !description || price === undefined) {
      return res.status(400).json({ success: false, message: 'Title, description, and price are required' });
    }

    const course = await Course.create({
      title,
      description,
      price,
      instructorId: req.user._id,
      materials: [],
      category: category || 'General',
      isPublished: true
    });

    // Lump-sum bonus ৳500 to instructor on course creation
    const instructorAccount = await BankAccount.findOne({ userId: req.user._id });
    const lmsAccount = await BankAccount.findOne({ accountNumber: LMS_ACCOUNT_NUMBER });

    if (instructorAccount && lmsAccount && lmsAccount.balance >= 500) {
      await BankService.transfer(
        LMS_ACCOUNT_NUMBER, LMS_SECRET,
        instructorAccount.accountNumber, 500,
        `Lump sum payment for uploading course: ${title}`
      );
      await User.findByIdAndUpdate(req.user._id, { $inc: { walletBalance: 500 } });
    }

    res.status(201).json({
      success: true,
      message: 'Course created successfully. Lump sum payment of ৳500 transferred.',
      data: course
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /courses/:id/material/video — add VIDEO material (Instructor)
// Handles both YouTube link and local file upload
// ─────────────────────────────────────────────
const addVideoMaterial = (req, res) => {
  uploadVideoMiddleware(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    try {
      const { title, videoSource, videoUrl, order } = req.body;
      if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

      const source = videoSource || 'youtube';
      if (source === 'youtube' && !videoUrl) {
        return res.status(400).json({ success: false, message: 'YouTube URL is required' });
      }
      if (source === 'upload' && !req.file) {
        return res.status(400).json({ success: false, message: 'Video file is required for upload type' });
      }

      const course = await Course.findById(req.params.id);
      if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
      if (course.instructorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'You can only edit your own courses' });
      }

      course.materials.push({
        title,
        type: 'video',
        videoSource: source,
        videoUrl: source === 'youtube' ? (videoUrl || '') : '',
        videoFile: source === 'upload' ? `/uploads/videos/${req.file.filename}` : '',
        order: order ? Number(order) : course.materials.length + 1
      });
      await course.save();

      res.status(200).json({ success: true, message: 'Video material added successfully', data: course });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

// ─────────────────────────────────────────────
// PUT /courses/:id/material/document — add DOCUMENT material (Instructor)
// Accepts a Google Drive link
// ─────────────────────────────────────────────
const addDocumentMaterial = async (req, res) => {
  try {
    const { title, driveLink, order } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!driveLink) return res.status(400).json({ success: false, message: 'Google Drive link is required' });

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (course.instructorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own courses' });
    }

    course.materials.push({
      title,
      type: 'document',
      driveLink,
      order: order ? Number(order) : course.materials.length + 1
    });
    await course.save();

    res.status(200).json({ success: true, message: 'Document material added successfully', data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /courses/:id/material/quiz — add QUIZ material (Instructor)
// Body: { title, timer, questions: [{question, options:[4], correctAnswer}] }
// ─────────────────────────────────────────────
const addQuizMaterial = async (req, res) => {
  try {
    const { title, timer, questions, order } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    let parsedQuestions = questions;
    if (typeof questions === 'string') {
      try { parsedQuestions = JSON.parse(questions); }
      catch (e) { return res.status(400).json({ success: false, message: 'Invalid questions format' }); }
    }

    if (!Array.isArray(parsedQuestions) || parsedQuestions.length < 1) {
      return res.status(400).json({ success: false, message: 'At least 1 question is required' });
    }
    if (parsedQuestions.length > 20) {
      return res.status(400).json({ success: false, message: 'Maximum 20 questions allowed per quiz' });
    }

    for (let i = 0; i < parsedQuestions.length; i++) {
      const q = parsedQuestions[i];
      if (!q.question || !q.question.trim()) {
        return res.status(400).json({ success: false, message: `Question ${i + 1} text is missing` });
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        return res.status(400).json({ success: false, message: `Question ${i + 1} must have exactly 4 options` });
      }
      if (q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer > 3) {
        return res.status(400).json({ success: false, message: `Question ${i + 1} must have a valid correct answer (0-3)` });
      }
    }

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (course.instructorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own courses' });
    }

    course.materials.push({
      title,
      type: 'quiz',
      order: order ? Number(order) : course.materials.length + 1,
      quiz: {
        timer: timer ? Number(timer) : 10,
        questions: parsedQuestions
      }
    });
    await course.save();

    res.status(200).json({ success: true, message: 'Quiz added successfully', data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// MULTER — PDF upload
// ─────────────────────────────────────────────
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/pdfs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});
const uploadPdf = multer({
  storage: pdfStorage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pdf' || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'), false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});
const uploadPdfMiddleware = uploadPdf.single('pdfFile');

// ─────────────────────────────────────────────
// PUT /courses/:id/material/document  (updated — supports Drive link OR PDF upload)
// ─────────────────────────────────────────────
const addDocumentMaterialV2 = (req, res) => {
  uploadPdfMiddleware(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      const { title, driveLink, order } = req.body;
      if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

      const hasDrive = driveLink && driveLink.trim();
      const hasPdf   = !!req.file;
      if (!hasDrive && !hasPdf) {
        return res.status(400).json({ success: false, message: 'Provide a Google Drive/URL link or upload a PDF file' });
      }

      const course = await Course.findById(req.params.id);
      if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
      if (course.instructorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'You can only edit your own courses' });
      }

      course.materials.push({
        title,
        type: 'document',
        driveLink: hasDrive ? driveLink.trim() : '',
        pdfFile:   hasPdf   ? `/uploads/pdfs/${req.file.filename}` : '',
        order: order ? Number(order) : course.materials.length + 1
      });
      await course.save();
      res.status(200).json({ success: true, message: 'Document added successfully', data: course });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

// ─────────────────────────────────────────────
// PUT /courses/:id/material/announcement
// ─────────────────────────────────────────────
const addAnnouncementMaterial = async (req, res) => {
  try {
    const { title, content, order } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!content || !content.trim()) return res.status(400).json({ success: false, message: 'Content is required' });

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (course.instructorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    course.materials.push({
      title,
      type: 'announcement',
      content: content.trim(),
      order: order ? Number(order) : course.materials.length + 1
    });
    await course.save();
    res.status(200).json({ success: true, message: 'Announcement added', data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /courses/:id/material/blog
// Body: { title, content, codeBlocks: [{language, code, caption}] }
// ─────────────────────────────────────────────
const addBlogMaterial = async (req, res) => {
  try {
    let { title, content, codeBlocks, order } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!content || !content.trim()) return res.status(400).json({ success: false, message: 'Content is required' });

    if (typeof codeBlocks === 'string') {
      try { codeBlocks = JSON.parse(codeBlocks); } catch { codeBlocks = []; }
    }
    if (!Array.isArray(codeBlocks)) codeBlocks = [];

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (course.instructorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    course.materials.push({
      title,
      type: 'blog',
      content: content.trim(),
      codeBlocks: codeBlocks.map(cb => ({
        language: (cb.language || 'javascript').toLowerCase(),
        code:     cb.code || '',
        caption:  cb.caption || ''
      })),
      order: order ? Number(order) : course.materials.length + 1
    });
    await course.save();
    res.status(200).json({ success: true, message: 'Blog post added', data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /courses/:courseId/quiz/:materialId/attempts  — instructor view
// ─────────────────────────────────────────────
const getQuizAttempts = async (req, res) => {
  try {
    const { courseId, materialId } = req.params;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (course.instructorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const attempts = await QuizAttempt.find({ courseId, materialId })
      .populate('learnerId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: attempts.length, data: attempts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// Updated submitQuiz — returns full question data for result display
// ─────────────────────────────────────────────
const submitQuiz = async (req, res) => {
  try {
    const { courseId, materialId } = req.params;
    const { answers, timeTaken, timedOut } = req.body;
    const learnerId = req.user._id;

    const user = await User.findById(learnerId);
    const purchased = user.purchasedCourses.some(pc => pc.courseId.toString() === courseId);
    if (!purchased) {
      return res.status(403).json({ success: false, message: 'You have not purchased this course' });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const material = course.materials.id(materialId);
    if (!material || material.type !== 'quiz') {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const questions = material.quiz.questions;
    const totalQuestions = questions.length;
    let score = 0;
    const parsedAnswers = Array.isArray(answers) ? answers : [];

    questions.forEach((q, idx) => {
      if (parsedAnswers[idx] !== undefined && Number(parsedAnswers[idx]) === q.correctAnswer) score++;
    });

    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    await QuizAttempt.findOneAndUpdate(
      { learnerId, courseId, materialId },
      { answers: parsedAnswers, score, totalQuestions, percentage, timeTaken: timeTaken || 0, timedOut: timedOut || false },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: `Quiz submitted! You scored ${score}/${totalQuestions} (${percentage}%)`,
      attempt: { score, totalQuestions, percentage, timedOut: timedOut || false, answers: parsedAnswers },
      questions: questions.map(q => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /courses/:courseId/quiz/:materialId/result
// ─────────────────────────────────────────────
const getQuizResult = async (req, res) => {
  try {
    const { courseId, materialId } = req.params;
    const attempt = await QuizAttempt.findOne({ learnerId: req.user._id, courseId, materialId });
    if (!attempt) return res.status(404).json({ success: false, message: 'No attempt found for this quiz' });
    res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /courses/:courseId/material/:materialId
// ─────────────────────────────────────────────
const removeMaterial = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (course.instructorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only modify your own courses' });
    }

    const mat = course.materials.id(req.params.materialId);
    if (mat && mat.type === 'video' && mat.videoFile) {
      const filePath = path.join(__dirname, '../public', mat.videoFile);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    course.materials = course.materials.filter(m => m._id.toString() !== req.params.materialId);
    await course.save();

    res.status(200).json({ success: true, message: 'Material removed successfully', data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /courses/buy/:id
// ─────────────────────────────────────────────
const buyCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const learnerId = req.user._id;
    const { pin } = req.body;

    // Verify bank PIN
    const userWithPin = await User.findById(learnerId).select('+bankPin');
    const expectedPin = userWithPin.bankPin || '1234';
    if (!pin) {
      return res.status(400).json({ success: false, message: 'Bank PIN is required to purchase a course.' });
    }
    if (String(pin).trim() !== String(expectedPin).trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect bank PIN. Please try again.' });
    }

    if (!req.user.bankAccountNumber) {
      return res.status(400).json({ success: false, message: 'Please set up your bank account first before purchasing a course' });
    }

    const course = await Course.findById(courseId).populate('instructorId');
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const alreadyPurchased = req.user.purchasedCourses.some(pc => pc.courseId.toString() === courseId);
    if (alreadyPurchased) return res.status(400).json({ success: false, message: 'You have already purchased this course' });

    const amount = course.price;
    const transaction = await Transaction.create({ buyerId: learnerId, courseId, amount, status: 'pending', description: `Purchase of course: ${course.title}` });

    const transferResult = await BankService.transfer(req.user.bankAccountNumber, req.user.bankSecret, LMS_ACCOUNT_NUMBER, amount, `Course purchase: ${course.title}`);

    if (!transferResult.success) {
      transaction.status = 'failed';
      await transaction.save();
      return res.status(400).json({ success: false, message: `Payment failed: ${transferResult.message}`, transactionId: transaction._id });
    }

    const instructorShare = Math.round(amount * 0.7);
    const lmsCommission = amount - instructorShare;

    const instructorAccount = await BankAccount.findOne({ userId: course.instructorId._id });
    if (instructorAccount) {
      await BankService.transfer(LMS_ACCOUNT_NUMBER, LMS_SECRET, instructorAccount.accountNumber, instructorShare, `Revenue share for course: ${course.title}`);
      await User.findByIdAndUpdate(course.instructorId._id, { $inc: { walletBalance: instructorShare } });
    }

    transaction.status = 'success';
    transaction.instructorPayment = { instructorId: course.instructorId._id, amount: instructorShare };
    transaction.lmsCommission = lmsCommission;
    await transaction.save();

    await User.findByIdAndUpdate(learnerId, {
      $push: { purchasedCourses: { courseId, purchasedAt: new Date(), completed: false } },
      $inc: { walletBalance: -amount }
    });

    course.enrolledCount += 1;
    course.enrolledStudents.push({ studentId: learnerId, enrolledAt: new Date() });
    await course.save();

    res.status(200).json({
      success: true,
      message: `Course "${course.title}" purchased successfully!`,
      data: { transactionId: transaction._id, course: course.title, amountPaid: amount, instructorPayment: instructorShare, lmsCommission }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /courses/my-courses
// ─────────────────────────────────────────────
const getMyCourses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'purchasedCourses.courseId',
      populate: { path: 'instructorId', select: 'name email' }
    });
    res.status(200).json({ success: true, count: user.purchasedCourses.length, data: user.purchasedCourses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /courses/certificate/apply/:courseId  — student applies for certificate
// ─────────────────────────────────────────────
const applyCertificate = async (req, res) => {
  try {
    const { courseId } = req.params;
    const learnerId = req.user._id;

    const user = await User.findById(learnerId);
    const purchasedCourse = user.purchasedCourses.find(pc => pc.courseId.toString() === courseId);
    if (!purchasedCourse) return res.status(400).json({ success: false, message: 'You have not purchased this course.' });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

    // Check if already applied
    const existing = await Certificate.findOne({ learnerId, courseId });
    if (existing) {
      return res.status(400).json({ success: false, message: `Certificate application already ${existing.status}.` });
    }

    // Mark course completed
    purchasedCourse.completed = true;
    await user.save();

    const certificate = await Certificate.create({
      learnerId,
      courseId,
      instructorId: course.instructorId,
      status: 'pending',
      appliedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Certificate application submitted! Waiting for instructor approval.',
      data: { certificateId: certificate._id, status: certificate.status }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /courses/certificate/:certId/review  — instructor accepts / rejects
// ─────────────────────────────────────────────
const reviewCertificate = async (req, res) => {
  try {
    const { certId } = req.params;
    const { action, reason } = req.body; // action: 'accept' | 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be accept or reject.' });
    }

    const cert = await Certificate.findById(certId).populate('courseId', 'title instructorId');
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate application not found.' });

    // Only course instructor or admin can review
    const isInstructor = cert.courseId.instructorId.toString() === req.user._id.toString();
    if (req.user.role !== 'admin' && !isInstructor) {
      return res.status(403).json({ success: false, message: 'Not authorised to review this certificate.' });
    }

    if (cert.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Application already ${cert.status}.` });
    }

    cert.status = action === 'accept' ? 'accepted' : 'rejected';
    cert.reviewedAt = new Date();
    if (action === 'reject' && reason) cert.rejectionReason = reason;
    await cert.save();

    const updatedCert = await Certificate.findById(certId)
      .populate('learnerId', 'name email')
      .populate('courseId', 'title');

    res.status(200).json({
      success: true,
      message: `Certificate ${cert.status} for ${updatedCert.learnerId.name}.`,
      data: updatedCert
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /courses/certificates/pending  — instructor sees pending applications
// ─────────────────────────────────────────────
const getInstructorCertApps = async (req, res) => {
  try {
    const instructorCourses = await Course.find({ instructorId: req.user._id }).select('_id');
    const courseIds = instructorCourses.map(c => c._id);
    const certs = await Certificate.find({ courseId: { $in: courseIds } })
      .populate('learnerId', 'name email profilePicture')
      .populate('courseId', 'title')
      .sort({ appliedAt: -1 });
    res.status(200).json({ success: true, count: certs.length, data: certs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /courses/certificate/:courseId  (existing — updated to check status)
// ─────────────────────────────────────────────
const getCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ learnerId: req.user._id, courseId: req.params.courseId })
      .populate('courseId', 'title description')
      .populate('learnerId', 'name email');

    if (!certificate) return res.status(404).json({ success: false, message: 'Certificate not found. Please complete the course first.' });

    res.status(200).json({ success: true, data: certificate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /courses/instructor/my-courses
// ─────────────────────────────────────────────
const getInstructorCourses = async (req, res) => {
  try {
    const courses = await Course.find({ instructorId: req.user._id })
      .populate('enrolledStudents.studentId', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: courses.length, data: courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /courses/:id/enrolled
// ─────────────────────────────────────────────
const getEnrolledStudents = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('enrolledStudents.studentId', 'name email')
      .populate('instructorId', 'name email');

    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    if (req.user.role === 'instructor' && course.instructorId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({
      success: true,
      count: course.enrolledStudents.length,
      data: { course: { title: course.title, _id: course._id }, enrolledStudents: course.enrolledStudents }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// PUT /courses/:courseId/material/:materialId/edit
// ─────────────────────────────────────────────
const editMaterial = async (req, res) => {
  try {
    const { courseId, materialId } = req.params;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (course.instructorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const material = course.materials.id(materialId);
    if (!material) return res.status(404).json({ success: false, message: 'Material not found' });

    const { title, videoUrl, driveLink, timer, questions } = req.body;

    if (title !== undefined && title.trim()) material.title = title.trim();

    if (material.type === 'video') {
      if (videoUrl !== undefined) material.videoUrl = videoUrl;
    } else if (material.type === 'document') {
      if (driveLink !== undefined) material.driveLink = driveLink;
    } else if (material.type === 'quiz') {
      if (timer !== undefined) material.quiz.timer = Number(timer);
      if (questions !== undefined) {
        if (!Array.isArray(questions) || questions.length < 1 || questions.length > 20) {
          return res.status(400).json({ success: false, message: '1–20 questions required' });
        }
        for (const q of questions) {
          if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => !o)) {
            return res.status(400).json({ success: false, message: 'Each question needs exactly 4 filled options' });
          }
          if (q.correctAnswer < 0 || q.correctAnswer > 3) {
            return res.status(400).json({ success: false, message: 'Invalid correct answer index' });
          }
        }
        material.quiz.questions = questions;
      }
    }

    await course.save();
    res.json({ success: true, message: 'Material updated successfully', material });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /courses/:courseId/rate
 * Learner rates a course they purchased (1–5 stars + optional review)
 */
const rateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const learnerId = req.user._id;
    const { value, review } = req.body;

    const ratingValue = parseInt(value, 10);
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    // Must have purchased the course
    const hasPurchased = req.user.purchasedCourses.some(pc => pc.courseId.toString() === courseId);
    if (!hasPurchased) {
      return res.status(403).json({ success: false, message: 'You must purchase this course before rating it.' });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

    // Update or insert this user's rating
    const existingIdx = course.ratings.findIndex(r => r.userId.toString() === learnerId.toString());
    if (existingIdx >= 0) {
      course.ratings[existingIdx].value = ratingValue;
      course.ratings[existingIdx].review = review || '';
      course.ratings[existingIdx].createdAt = new Date();
    } else {
      course.ratings.push({ userId: learnerId, value: ratingValue, review: review || '' });
    }

    // Recalculate cached averages
    course.ratingCount = course.ratings.length;
    course.avgRating = Math.round((course.ratings.reduce((s, r) => s + r.value, 0) / course.ratingCount) * 10) / 10;

    await course.save();

    return res.json({ success: true, message: 'Rating submitted!', avgRating: course.avgRating, ratingCount: course.ratingCount });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getCourses,
  getCourseById,
  createCourse,
  addVideoMaterial,
  addDocumentMaterial: addDocumentMaterialV2,
  addQuizMaterial,
  addAnnouncementMaterial,
  addBlogMaterial,
  getQuizAttempts,
  editMaterial,
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
  rateCourse
};

