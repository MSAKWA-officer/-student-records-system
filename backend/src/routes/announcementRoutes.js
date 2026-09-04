const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { authenticate, authorize } = require('../middleware/auth');

// Public/read for any logged-in user (dashboard banner etc.)
router.get('/', authenticate, announcementController.getAllAnnouncements);
router.get('/:id', authenticate, announcementController.getAnnouncementById);

// Only admins can create/edit/delete announcements
router.post('/', authenticate, authorize(['admin']), announcementController.createAnnouncement);
router.put('/:id', authenticate, authorize(['admin']), announcementController.updateAnnouncement);
router.delete('/:id', authenticate, authorize(['admin']), announcementController.deleteAnnouncement);

module.exports = router;
