const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate); // all enrollment routes require login

router.get('/', enrollmentController.getAllEnrollments);
router.get('/:id', enrollmentController.getEnrollmentById);
router.post('/', authorize('admin', 'headteacher'), enrollmentController.createEnrollment);
router.put('/:id', authorize('admin', 'headteacher'), enrollmentController.updateEnrollment);
router.delete('/:id', authorize('admin'), enrollmentController.deleteEnrollment);

module.exports = router;
