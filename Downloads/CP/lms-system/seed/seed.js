/**
 * Database Seed Script
 * Creates initial data: admin, 3 instructors, 5 courses, bank accounts
 * 
 * Run with: npm run seed
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Load env
dotenv.config();

// Import models
const User = require('../models/User');
const Course = require('../models/Course');
const BankAccount = require('../models/BankAccount');
const Transaction = require('../models/Transaction');
const Certificate = require('../models/Certificate');
const QuizAttempt = require('../models/QuizAttempt');

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lms-system';

// ============================
// SEED DATA DEFINITIONS
// ============================

// LMS Admin account
const adminData = {
  name: 'LMS Admin',
  email: 'admin@lms.com',
  password: 'admin123',
  role: 'admin'
};

// 3 Instructors
const instructorsData = [
  {
    name: 'A.K.M. Fakhrul Hossain',
    email: 'fakhrul.hossain@lms.com',
    password: 'ins@123',
    role: 'instructor'
  },
  {
    name: 'Ishtiaque Zahid',
    email: 'ishtiaque.zahid@lms.com',
    password: 'ins@1234',
    role: 'instructor'
  },
  {
    name: 'Mainul Hasan',
    email: 'mainul.hasan@lms.com',
    password: 'ins@12345',
    role: 'instructor'
  }
];

// 5 Courses — NO pre-loaded materials; instructors will add content manually
const coursesData = [
  {
    title: 'Full-Stack Web Development with MERN',
    description: 'Master the MERN stack (MongoDB, Express.js, React, Node.js). Build real-world projects from scratch including REST APIs, authentication systems, and responsive frontends. Perfect for beginners wanting to become full-stack developers.',
    price: 149,
    category: 'Web Development',
    materials: []
  },
  {
    title: 'Python for Data Science & Machine Learning',
    description: 'Learn Python programming for data analysis and machine learning. Covers NumPy, Pandas, Matplotlib, Scikit-learn, and TensorFlow. Includes hands-on projects with real datasets and algorithmic thinking exercises.',
    price: 199,
    category: 'Data Science',
    materials: []
  },
  {
    title: 'React Native Mobile App Development',
    description: 'Build cross-platform mobile applications using React Native. Learn navigation, state management with Redux, API integration, and deploying to App Store and Google Play. Create 3 complete apps.',
    price: 129,
    category: 'Mobile Development',
    materials: []
  },
  {
    title: 'Cybersecurity Fundamentals & Ethical Hacking',
    description: 'Comprehensive cybersecurity course covering network security, cryptography, penetration testing, and ethical hacking. Learn to identify vulnerabilities and protect systems using industry-standard tools.',
    price: 179,
    category: 'Cybersecurity',
    materials: []
  },
  {
    title: 'Cloud Computing with AWS & DevOps',
    description: 'Master Amazon Web Services and DevOps practices. Cover EC2, S3, Lambda, Docker, Kubernetes, CI/CD pipelines, Infrastructure as Code with Terraform, and monitoring with CloudWatch.',
    price: 169,
    category: 'Cloud Computing',
    materials: []
  }
];

// Bank accounts data
const bankAccountsData = {
  // LMS Organization account
  lms: {
    accountNumber: '1000000001',
    secretKey: 'lms_secret_2024',
    holderName: 'LMS Organization',
    balance: 100000
  },
  // Instructor bank accounts
  instructors: [
    { accountNumber: '2000000001', secretKey: 'fakhrul_secret', holderName: 'A.K.M. Fakhrul Hossain', balance: 500 },
    { accountNumber: '2000000002', secretKey: 'ishtiaque_secret', holderName: 'Ishtiaque Zahid', balance: 500 },
    { accountNumber: '2000000003', secretKey: 'mainul_secret', holderName: 'Mainul Hasan', balance: 500 }
  ]
};

// ============================
// SEED FUNCTION
// ============================

async function seedDatabase() {
  try {
    console.log('\n🌱 ================================');
    console.log('   LMS Database Seeder');
    console.log('🌱 ================================\n');

    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Course.deleteMany({});
    await BankAccount.deleteMany({});
    await Transaction.deleteMany({});
    await Certificate.deleteMany({});
    await QuizAttempt.deleteMany({});
    console.log('✅ Database cleared');

    // 1. Create Admin
    console.log('\n👤 Creating Admin...');
    const admin = await User.create(adminData);
    console.log(`   ✅ Admin: ${admin.email}`);

    // Create admin bank account (LMS Organization)
    await BankAccount.create({
      userId: admin._id,
      ...bankAccountsData.lms,
      transactions: [{ type: 'credit', amount: 100000, description: 'Initial LMS Organization fund' }]
    });
    await User.findByIdAndUpdate(admin._id, {
      bankAccountNumber: bankAccountsData.lms.accountNumber,
      bankSecret: bankAccountsData.lms.secretKey,
      walletBalance: 100000
    });
    console.log(`   ✅ LMS Bank Account: ${bankAccountsData.lms.accountNumber} (Balance: ৳100,000)`);

    // 2. Create 3 Instructors
    console.log('\n👨‍🏫 Creating 3 Instructors...');
    const instructors = [];
    for (let i = 0; i < instructorsData.length; i++) {
      const instructor = await User.create(instructorsData[i]);
      instructors.push(instructor);

      // Create instructor bank account
      await BankAccount.create({
        userId: instructor._id,
        ...bankAccountsData.instructors[i],
        transactions: [{ type: 'credit', amount: 5000, description: 'Initial instructor balance' }]
      });

      // Update user with bank info
      await User.findByIdAndUpdate(instructor._id, {
        bankAccountNumber: bankAccountsData.instructors[i].accountNumber,
        bankSecret: bankAccountsData.instructors[i].secretKey,
        walletBalance: 5000
      });

      console.log(`   ✅ Instructor ${i + 1}: ${instructor.name} (${instructor.email}) | Bank: ${bankAccountsData.instructors[i].accountNumber}`);
    }

    // 3. Create 5 Courses (distributed among 3 instructors)
    console.log('\n📚 Creating 5 Courses...');
    const instructorAssignment = [0, 1, 2, 0, 1]; // Distribute courses: Instructor 1 gets 2, Instructor 2 gets 2, Instructor 3 gets 1

    for (let i = 0; i < coursesData.length; i++) {
      const course = await Course.create({
        ...coursesData[i],
        instructorId: instructors[instructorAssignment[i]]._id,
        isPublished: true
      });
      console.log(`   ✅ Course ${i + 1}: "${course.title}" by ${instructors[instructorAssignment[i]].name} (৳${course.price})`);
    }

    // Summary
    console.log('\n🎉 ================================');
    console.log('   SEEDING COMPLETE!');
    console.log('🎉 ================================\n');
    console.log('📊 Summary:');
    console.log(`   • 1 Admin (admin@lms.com / admin123)`);
    console.log(`   • 3 Instructors`);
    console.log(`   • 5 Published Courses`);
    console.log(`   • 4 Bank Accounts Created`);
    console.log('\n🔑 Login Credentials:');
    console.log('   ┌──────────────────────────┬────────────────────────────┬───────────────┐');
    console.log('   │ Role                     │ Email                      │ Password      │');
    console.log('   ├──────────────────────────┼────────────────────────────┼───────────────┤');
    console.log('   │ Admin                    │ admin@lms.com              │ admin123      │');
    console.log('   │ Instructor 1             │ fakhrul.hossain@lms.com    │ ins@123       │');
    console.log('   │ Instructor 2             │ ishtiaque.zahid@lms.com    │ ins@1234      │');
    console.log('   │ Instructor 3             │ mainul.hasan@lms.com       │ ins@12345     │');
    console.log('   └──────────────────────────┴────────────────────────────┴───────────────┘');
    console.log('\n💡 Learners & Instructors can register via the UI or API\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the seeder
seedDatabase();
