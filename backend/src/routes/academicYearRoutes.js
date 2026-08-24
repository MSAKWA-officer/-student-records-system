const express = require('express');
const router = express.Router();
const academicYearController = require('../controllers/academicYearController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate); // all academic year routes require login

router.get('/', academicYearController.getAllAcademicYears);
router.get('/:id', academicYearController.getAcademicYearById);
router.post('/', authorize('admin', 'headteacher'), academicYearController.createAcademicYear);
router.put('/:id', authorize('admin', 'headteacher'), academicYearController.updateAcademicYear);
router.delete('/:id', authorize('admin'), academicYearController.deleteAcademicYear);

module.exports = router;
