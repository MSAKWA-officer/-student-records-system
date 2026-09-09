const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { authenticate, authorize, restrictQueryToOwnStudent } = require('../middleware/auth');

router.use(authenticate); // all result routes require login

router.get('/', authorize('admin', 'headteacher', 'teacher', 'staff'), resultController.getAllResults);
router.get('/exam-slip', restrictQueryToOwnStudent, resultController.getExamResultSlip);
// NOTE: this must stay ABOVE the "/:id" route below — Express matches
// routes in the order they're declared, so "/:id" would otherwise treat
// "class-analysis" as an id and swallow this request.
router.get(
  '/class-analysis',
  authorize('admin', 'headteacher', 'teacher', 'staff'),
  resultController.getClassAnalysisReport
);
// Same reasoning as /class-analysis above: must stay above "/:id".
// NECTA-style Division Performance reports (whole class / whole school).
router.get('/class-report', authorize('admin', 'headteacher'), resultController.getClassResultsReport);
router.get('/school-report', authorize('admin', 'headteacher'), resultController.getSchoolResultsReport);
router.get('/:id', authorize('admin', 'headteacher', 'teacher', 'staff'), resultController.getResultById);
router.post('/', authorize('admin', 'headteacher', 'teacher'), resultController.createResult);
router.put('/:id', authorize('admin', 'headteacher', 'teacher'), resultController.updateResult);
router.delete('/:id', authorize('admin'), resultController.deleteResult);

module.exports = router;
