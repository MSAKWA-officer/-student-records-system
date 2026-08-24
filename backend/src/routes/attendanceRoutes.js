const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate, authorize, restrictQueryToOwnStudent } = require('../middleware/auth');

router.use(authenticate); // all attendance routes require login

router.get('/', restrictQueryToOwnStudent, attendanceController.getAllAttendance);
router.get('/:id', authorize('admin', 'headteacher', 'teacher', 'staff'), attendanceController.getAttendanceById);
router.post('/', authorize('admin', 'headteacher', 'teacher'), attendanceController.createAttendance);
router.put('/:id', authorize('admin', 'headteacher', 'teacher'), attendanceController.updateAttendance);
router.delete('/:id', authorize('admin'), attendanceController.deleteAttendance);

module.exports = router;
