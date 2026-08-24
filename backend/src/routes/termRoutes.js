const express = require('express');
const router = express.Router();
const termController = require('../controllers/termController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate); // all term routes require login

router.get('/', termController.getAllTerms);
router.get('/:id', termController.getTermById);
router.post('/', authorize('admin', 'headteacher'), termController.createTerm);
router.put('/:id', authorize('admin', 'headteacher'), termController.updateTerm);
router.delete('/:id', authorize('admin'), termController.deleteTerm);

module.exports = router;
