require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { sequelize } = require('./models');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const classRoutes = require('./routes/classRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const academicYearRoutes = require('./routes/academicYearRoutes');
const classSubjectRoutes = require('./routes/classSubjectRoutes');
const termRoutes = require('./routes/termRoutes');
const examRoutes = require('./routes/examRoutes');
const resultRoutes = require('./routes/resultRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Student Records API is live.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/class-subjects', classSubjectRoutes);
app.use('/api/terms', termRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error.' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');

    // sync() creates any tables that don't exist yet. We deliberately do NOT
    // use { alter: true } here: on MySQL, calling alter sync repeatedly adds
    // a brand new index/foreign key each time instead of safely reusing the
    // old one, and a table can hit MySQL's 64-index-per-table limit after
    // enough restarts during development ("Too many keys specified").
    // If you change a model (new column, new unique constraint, etc.),
    // apply that change to the database yourself with an ALTER TABLE
    // statement (or a proper migration) instead of relying on auto-sync.
    await sequelize.sync();
    console.log('✅ Tables are set up.');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to the database:', err.message);
    process.exit(1);
  }
}

// Only run the local server (with its own DB connect + listen) when this
// file is executed directly, e.g. `node src/server.js` or `npm run dev`.
// When Vercel does `require('./src/server.js')` to load the serverless
// function, this block is skipped and only `module.exports = app` below
// runs — Vercel handles the DB connection per-request and never calls
// app.listen() itself (binding a port is not allowed in serverless).
if (require.main === module) {
  start();
}

module.exports = app;