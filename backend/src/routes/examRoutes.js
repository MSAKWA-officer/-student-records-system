const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate); // all exam routes require login

router.get('/', examController.getAllExams);
router.get('/:id', examController.getExamById);
router.post('/', authorize('admin', 'headteacher', 'teacher'), examController.createExam);
router.put('/:id', authorize('admin', 'headteacher', 'teacher'), examController.updateExam);
router.delete('/:id', authorize('admin'), examController.deleteExam);

module.exports = router;
