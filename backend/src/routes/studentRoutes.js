const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate, authorize, restrictToOwnStudentRecord } = require('../middleware/auth');

router.use(authenticate); // all student routes require login

// Listing all students is a staff-only action — a student account should
// never be able to browse other students.
router.get('/', authorize('admin', 'headteacher', 'teacher', 'staff'), studentController.getAllStudents);
// Must come before '/:id' so 'eligible' isn't treated as an id.
router.get('/eligible', authorize('admin', 'headteacher', 'teacher', 'staff'), studentController.getEligibleStudents);
router.get('/:id/report-card', restrictToOwnStudentRecord, studentController.getReportCard);
router.get('/:id', restrictToOwnStudentRecord, studentController.getStudentById);
router.post('/', authorize('admin', 'headteacher'), studentController.createStudent);
router.put('/:id', authorize('admin', 'headteacher'), studentController.updateStudent);
router.delete('/:id', authorize('admin'), studentController.deleteStudent);
router.post('/:id/enroll', authorize('admin', 'headteacher'), studentController.enrollStudent);
router.post('/:id/create-login', authorize('admin', 'headteacher'), studentController.createLogin);

module.exports = router;
