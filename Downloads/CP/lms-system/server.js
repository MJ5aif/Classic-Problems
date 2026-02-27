/**
 * LMS System - Main Server Entry Point
 * 
 * A full-stack Learning Management System with simulated banking
 * Built with: Node.js, Express.js, MongoDB, EJS
 * 
 * @author LMS Team
 * @version 1.0.0
 */

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const morgan = require('morgan');
const path = require('path');

// Load environment variables
dotenv.config();

// Import database config
const connectDB = require('./config/db');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { protect } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/authRoutes');
const bankRoutes = require('./routes/bankRoutes');
const courseRoutes = require('./routes/courseRoutes');
const adminRoutes = require('./routes/adminRoutes');
const instructorRoutes = require('./routes/instructorRoutes');
const learnerRoutes = require('./routes/learnerRoutes');
const viewRoutes = require('./routes/viewRoutes');

// Initialize Express app
const app = express();

// ======================
// MIDDLEWARE CONFIGURATION
// ======================

// Body parser - Parse JSON and URL-encoded data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'lms_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// HTTP request logger (development only)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded videos
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to optionally parse JWT and attach user to all requests (for views)
app.use(async (req, res, next) => {
  try {
    const jwt = require('jsonwebtoken');
    const User = require('./models/User');
    let token = null;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    }
  } catch (err) {
    // Token invalid - just continue without user
  }
  next();
});

// ======================
// API ROUTES
// ======================

// Authentication routes
app.use('/auth', authRoutes);

// Bank API routes (simulated)
app.use('/bank', bankRoutes);

// Course routes
app.use('/courses', courseRoutes);

// Admin routes
app.use('/admin', adminRoutes);

// Instructor routes
app.use('/instructor', instructorRoutes);

// Learner routes
app.use('/learner', learnerRoutes);

// View routes (EJS pages)
app.use('/', viewRoutes);

// ======================
// ERROR HANDLING
// ======================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

// ======================
// SERVER STARTUP
// ======================

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start the server
    app.listen(PORT, () => {
      console.log(`\n🚀 ================================`);
      console.log(`   LMS Server Running!`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Port: ${PORT}`);
      console.log(`   URL: http://localhost:${PORT}`);
      console.log(`🚀 ================================\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
