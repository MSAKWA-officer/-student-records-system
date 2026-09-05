const express = require('express');
const router = express.Router();
const classGatewayController = require('../controllers/classGatewayController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize(['admin']), classGatewayController.getAllGateways);
router.post('/', authenticate, authorize(['admin']), classGatewayController.createGateway);
router.put('/:id', authenticate, authorize(['admin']), classGatewayController.updateGateway);
router.delete('/:id', authenticate, authorize(['admin']), classGatewayController.deleteGateway);

module.exports = router;