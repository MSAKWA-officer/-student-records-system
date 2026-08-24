const { Subject, ClassSubject } = require('../models');
const { Op } = require('sequelize');

// GET /api/subjects?search=&education_level=
exports.getAllSubjects = async (req, res) => {
  try {
    const { search, education_level } = req.query;
    const where = {};
    if (education_level) where.education_level = education_level;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
      ];
    }

    const subjects = await Subject.findAll({
      where,
      order: [['name', 'ASC']],
    });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch subjects.', error: err.message });
  }
};

// GET /api/subjects/:id
exports.getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });
    res.json(subject);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/subjects
exports.createSubject = async (req, res) => {
  try {
    const { name, code, education_level } = req.body;
    const subject = await Subject.create({ name, code, education_level });
    res.status(201).json(subject);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Subject code already exists.' });
    }
    res.status(400).json({ message: 'Failed to add the subject.', error: err.message });
  }
};

// PUT /api/subjects/:id
exports.updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });
    await subject.update(req.body);
    res.json(subject);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Subject code already exists.' });
    }
    res.status(400).json({ message: 'Failed to update the subject.', error: err.message });
  }
};

// DELETE /api/subjects/:id
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });

    const usageCount = await ClassSubject.count({ where: { subject_id: subject.id } });
    if (usageCount > 0) {
      return res.status(409).json({ message: 'This subject is already allocated to a class and cannot be deleted.' });
    }

    await subject.destroy();
    res.json({ message: 'Subject removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};