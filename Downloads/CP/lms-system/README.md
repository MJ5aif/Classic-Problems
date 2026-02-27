# 📚 LMS - Learning Management System

A full-stack Learning Management System built with **Node.js**, **Express.js**, **MongoDB**, and **EJS**. Simulates interactions between an LMS Organization, Instructors, Learners, and a Bank System.

---

## 🏗 Architecture

```
lms-system/
├── config/          # Database configuration
├── controllers/     # Route handlers (auth, bank, course, admin)
├── middleware/       # JWT auth, role-based access, error handler
├── models/          # Mongoose schemas (User, Course, Transaction, Certificate, BankAccount)
├── routes/          # Express route definitions
├── services/        # Bank service (simulated banking API)
├── views/           # EJS templates (frontend pages)
│   └── partials/    # Header & footer partials
├── public/css/      # Stylesheets
├── seed/            # Database seeder with dummy data
├── server.js        # Application entry point
├── .env             # Environment variables
└── package.json     # Dependencies & scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (running locally or MongoDB Atlas)
- **npm** (comes with Node.js)

### Installation

```bash
# 1. Navigate to the project directory
cd lms-system

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Edit .env file if needed (default values work for local development)

# 4. Make sure MongoDB is running
# For local MongoDB:
mongod

# 5. Seed the database (creates admin, instructors, courses, bank accounts)
npm run seed

# 6. Start the server
npm run dev     # Development mode (auto-restart with nodemon)
# or
npm start       # Production mode
```

### Access the Application

Open your browser and navigate to: **http://localhost:3000**

---

## 🔑 Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@lms.com | admin123 |
| **Instructor 1** | john.smith@lms.com | instructor123 |
| **Instructor 2** | sarah.johnson@lms.com | instructor123 |
| **Instructor 3** | michael.chen@lms.com | instructor123 |
| **Learner** | Register a new account | - |

---

## 📡 API Endpoints

### 🔐 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and receive JWT token |
| GET | `/auth/logout` | Logout (clears token) |
| GET | `/auth/me` | Get current user profile |

### 🏦 Bank (Simulated)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/bank/create-account` | Create a bank account |
| POST | `/bank/transfer` | Transfer funds between accounts |
| GET | `/bank/balance/:accountNumber` | Get account balance |
| GET | `/bank/my-balance` | Get logged-in user's balance |

### 📚 Courses
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/courses` | List all published courses | Public |
| GET | `/courses/:id` | Get single course details | Public |
| POST | `/courses` | Create a new course | Instructor |
| PUT | `/courses/:id/material` | Add material to course | Instructor |
| POST | `/courses/buy/:id` | Purchase a course | Learner |
| GET | `/courses/my-courses` | Get purchased courses | Learner |
| POST | `/courses/complete/:courseId` | Mark course complete | Learner |
| GET | `/courses/certificate/:courseId` | Get certificate | Learner |

### 👨‍🏫 Instructor
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/instructor/balance` | Get instructor bank balance |
| GET | `/courses/instructor/my-courses` | Get instructor's courses |

### 🏢 Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/transactions` | View all transactions |
| GET | `/admin/balance` | View LMS organization balance |
| GET | `/admin/dashboard` | Get dashboard statistics |

### 🎓 Learner
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/learner/balance` | Get learner bank balance |

---

## 🔁 User Flow

### Learner Journey
1. **Register** a new account at `/auth/register`
2. **Login** at `/auth/login`
3. **Set up bank account** on the dashboard (10-digit account number + secret key)
4. **Browse courses** at `/courses-page`
5. **Purchase a course** (funds are transferred via the Bank API)
6. **Access course materials** on the dashboard
7. **Complete course** to receive a certificate
8. **View/Print certificate**

### Transaction Flow
```
Learner pays $X → Bank validates → LMS receives full amount →
LMS keeps 30% commission → 70% transferred to Instructor
```

### Instructor Journey
1. **Login** with instructor credentials
2. **Create courses** (receives ৳500 lump sum per course uploaded)
3. **Add materials** to courses
4. **Earn revenue** from course sales (70% of price)
5. **Check bank balance**

---

## 📦 Seeded Data

- **1 Admin** account with LMS Organization bank account (৳100,000)
- **3 Instructors** with individual bank accounts (৳5,000 each)
- **5 Published Courses** with materials (distributed across instructors)

### Courses:
1. Full-Stack Web Development with MERN - ৳149
2. Python for Data Science & Machine Learning - ৳199
3. React Native Mobile App Development - ৳129
4. Cybersecurity Fundamentals & Ethical Hacking - ৳179
5. Cloud Computing with AWS & DevOps - ৳169

---

## 🛡 Security Features

- **bcrypt** password hashing (12 salt rounds)
- **JWT** token-based authentication (7-day expiry)
- **Role-based access control** middleware
- **Input validation** on all endpoints
- **HTTP-only cookies** for token storage
- **Centralized error handling**

---

## 🎨 UI Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | `/` | Landing page with featured courses |
| Login | `/auth/login` | User login form |
| Register | `/auth/register` | New user registration |
| Courses | `/courses-page` | Browse all available courses |
| Dashboard | `/dashboard` | Role-based dashboard (auto-redirects) |
| Certificate | `/certificate-page/:courseId` | View/print completion certificate |

---

## 📮 Postman Collection

Import `LMS_API_Collection.postman_collection.json` into Postman to test all APIs.

**Usage:**
1. Import the collection file into Postman
2. Set the `baseUrl` variable to `http://localhost:3000`
3. Login first to get a token
4. Copy the token from the login response and set it as the `token` variable
5. Use the endpoints in order

---

## 🧰 Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Frontend | EJS Templates + CSS |
| Banking | Custom simulated service |

---

## 📝 Notes

- Exactly **5 courses** are seeded (requirement)
- Exactly **3 instructors** are seeded (requirement)
- All bank transactions are **simulated internally**
- Certificates are generated with **unique IDs**
- Instructor gets **৳500 lump sum** on course upload
- Instructor gets **70%** of each course sale
- LMS keeps **30% commission** on each sale
- All entities can **check their bank balance**

---

## 📄 License

ISC License
