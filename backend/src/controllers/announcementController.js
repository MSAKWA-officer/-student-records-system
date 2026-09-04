const { Announcement } = require('../models');

exports.getAllAnnouncements = async (req, res) => {
  try {
    const where = {};
    if (req.query.active === 'true') where.is_active = true;
    if (req.query.active === 'false') where.is_active = false;

    const announcements = await Announcement.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Announcement haikupatikana' });
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, is_active } = req.body;
    const announcement = await Announcement.create({
      title,
      message,
      is_active: is_active !== undefined ? is_active : true,
      posted_by: req.user?.id || null,
    });
    res.status(201).json(announcement);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByPk(id);
    if (!announcement) return res.status(404).json({ message: 'Announcement haikupatikana' });
    await announcement.update(req.body);
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByPk(id);
    if (!announcement) return res.status(404).json({ message: 'Announcement haikupatikana' });
    await announcement.destroy();
    res.json({ message: 'Announcement imefutwa' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
