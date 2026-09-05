const { Announcement } = require('../models');

exports.getAllAnnouncements = async (req, res) => {
  try {
    const where = {};
    if (req.query.active === 'true') where.is_active = true;
    if (req.query.active === 'false') where.is_active = false;
    if (req.query.audience) where.audience = req.query.audience;

    const announcements = await Announcement.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    // Frontend expects `body` — mirror `message` into `body` on the way out
    // without renaming the actual DB column.
    const shaped = announcements.map((a) => {
      const json = a.toJSON();
      return { ...json, body: json.message };
    });

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Announcement haikupatikana' });
    const json = announcement.toJSON();
    res.json({ ...json, body: json.message });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    // Frontend (AnnouncementCreate.jsx) sends `body`; DB column is `message`.
    const { title, message, body, audience, is_active } = req.body;
    const messageText = message ?? body;

    const announcement = await Announcement.create({
      title,
      message: messageText,
      audience: audience || 'all',
      is_active: is_active !== undefined ? is_active : true,
      posted_by: req.user?.id || null,
    });

    const json = announcement.toJSON();
    res.status(201).json({ ...json, body: json.message });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByPk(id);
    if (!announcement) return res.status(404).json({ message: 'Announcement haikupatikana' });

    const { body, message, ...rest } = req.body;
    const updates = { ...rest };
    if (message !== undefined || body !== undefined) {
      updates.message = message ?? body;
    }

    await announcement.update(updates);
    const json = announcement.toJSON();
    res.json({ ...json, body: json.message });
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
