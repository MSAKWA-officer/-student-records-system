const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate); // all class routes require login

// SchoolClass
router.get('/', classController.getAllClasses);
router.get('/:id', classController.getClassById);
router.post('/', authorize('admin', 'headteacher'), classController.createClass);
router.put('/:id', authorize('admin', 'headteacher'), classController.updateClass);
router.delete('/:id', authorize('admin'), classController.deleteClass);

// Stream (nested under a class)
router.get('/:id/streams', classController.getStreamsForClass);
router.post('/:id/streams', authorize('admin', 'headteacher'), classController.createStream);
router.put('/streams/:streamId', authorize('admin', 'headteacher'), classController.updateStream);
router.delete('/streams/:streamId', authorize('admin'), classController.deleteStream);

module.exports = router;