const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate); // all teacher routes require login

router.get('/', teacherController.getAllTeachers);
router.get('/:id', teacherController.getTeacherById);
router.post('/', authorize('admin', 'headteacher'), teacherController.createTeacher);
router.put('/:id', authorize('admin', 'headteacher'), teacherController.updateTeacher);
router.delete('/:id', authorize('admin'), teacherController.deleteTeacher);
router.post('/:id/create-login', authorize('admin', 'headteacher'), teacherController.createLogin);

module.exports = router;