const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate); // all subject routes require login

router.get('/', subjectController.getAllSubjects);
router.get('/:id', subjectController.getSubjectById);
router.post('/', authorize('admin', 'headteacher'), subjectController.createSubject);
router.put('/:id', authorize('admin', 'headteacher'), subjectController.updateSubject);
router.delete('/:id', authorize('admin'), subjectController.deleteSubject);

module.exports = router;