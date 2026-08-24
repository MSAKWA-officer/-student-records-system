const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { authenticate, authorize, restrictQueryToOwnStudent } = require('../middleware/auth');

router.use(authenticate); // all result routes require login

router.get('/', authorize('admin', 'headteacher', 'teacher', 'staff'), resultController.getAllResults);
router.get('/exam-slip', restrictQueryToOwnStudent, resultController.getExamResultSlip);
router.get('/:id', authorize('admin', 'headteacher', 'teacher', 'staff'), resultController.getResultById);
router.post('/', authorize('admin', 'headteacher', 'teacher'), resultController.createResult);
router.put('/:id', authorize('admin', 'headteacher', 'teacher'), resultController.updateResult);
router.delete('/:id', authorize('admin'), resultController.deleteResult);

module.exports = router;
