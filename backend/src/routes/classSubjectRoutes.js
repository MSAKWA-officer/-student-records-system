const express = require('express');
const router = express.Router();
const classSubjectController = require('../controllers/classSubjectController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate); // all class-subject routes require login

router.get('/', classSubjectController.getAllClassSubjects);
router.get('/:id', classSubjectController.getClassSubjectById);
router.post('/', authorize('admin', 'headteacher'), classSubjectController.createClassSubject);
router.put('/:id', authorize('admin', 'headteacher'), classSubjectController.updateClassSubject);
router.delete('/:id', authorize('admin'), classSubjectController.deleteClassSubject);

module.exports = router;
