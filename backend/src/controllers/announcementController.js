const { Announcement, User } = require('../models');

const includeRelations = [{ model: User, attributes: ['id', 'full_name', 'email'] }];

// GET /api/announcements?audience=&active=
exports.getAllAnnouncements = async (req, res) => {
  try {
    const { audience, active } = req.query;
    const where = {};
    if (audience) where.audience = audience;
    if (active !== undefined) where.is_active = active === 'true';

    const announcements = await Announcement.findAll({
      where,
      include: includeRelations,
      order: [['createdAt', 'DESC']],
    });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch announcements.', error: err.message });
  }
};

// GET /api/announcements/:id
exports.getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id, { include: includeRelations });
    if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/announcements
// Body: { title, body, audience }
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, body, audience, posted_by_name } = req.body;

    if (!title || !body) {
      return res.status(400).json({ message: 'Title and body are required.' });
    }

    const announcement = await Announcement.create({
      title,
      body,
      audience: audience || 'all',
      posted_by: req.user.id,
      posted_by_name: posted_by_name || null,
    });

    const created = await Announcement.findByPk(announcement.id, { include: includeRelations });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: 'Failed to post the announcement.', error: err.message });
  }
};

// PUT /api/announcements/:id
exports.updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });

    await announcement.update(req.body);
    const updated = await Announcement.findByPk(announcement.id, { include: includeRelations });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update the announcement.', error: err.message });
  }
};

// DELETE /api/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });

    await announcement.destroy();
    res.json({ message: 'Announcement removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
