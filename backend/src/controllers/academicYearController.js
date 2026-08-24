const { AcademicYear, ClassSubject, Enrollment } = require('../models');

// GET /api/academic-years
exports.getAllAcademicYears = async (req, res) => {
  try {
    const years = await AcademicYear.findAll({
      order: [['year_name', 'DESC']],
    });
    res.json(years);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch academic years.', error: err.message });
  }
};

// GET /api/academic-years/:id
exports.getAcademicYearById = async (req, res) => {
  try {
    const year = await AcademicYear.findByPk(req.params.id);
    if (!year) return res.status(404).json({ message: 'Academic year not found.' });
    res.json(year);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/academic-years
exports.createAcademicYear = async (req, res) => {
  try {
    const { year_name, start_date, end_date, is_current } = req.body;

    // Kama mwaka huu mpya ni "is_current", wengine wote wawe si current
    if (is_current) {
      await AcademicYear.update({ is_current: false }, { where: {} });
    }

    const year = await AcademicYear.create({ year_name, start_date, end_date, is_current: !!is_current });
    res.status(201).json(year);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This academic year already exists.' });
    }
    res.status(400).json({ message: 'Failed to add the academic year.', error: err.message });
  }
};

// PUT /api/academic-years/:id
exports.updateAcademicYear = async (req, res) => {
  try {
    const year = await AcademicYear.findByPk(req.params.id);
    if (!year) return res.status(404).json({ message: 'Academic year not found.' });

    if (req.body.is_current) {
      await AcademicYear.update({ is_current: false }, { where: {} });
    }

    await year.update(req.body);
    res.json(year);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This academic year already exists.' });
    }
    res.status(400).json({ message: 'Failed to update the academic year.', error: err.message });
  }
};

// DELETE /api/academic-years/:id
exports.deleteAcademicYear = async (req, res) => {
  try {
    const year = await AcademicYear.findByPk(req.params.id);
    if (!year) return res.status(404).json({ message: 'Academic year not found.' });

    const classSubjectCount = await ClassSubject.count({ where: { academic_year_id: year.id } });
    const enrollmentCount = await Enrollment.count({ where: { academic_year_id: year.id } });
    if (classSubjectCount > 0 || enrollmentCount > 0) {
      return res.status(409).json({ message: 'This academic year already has linked records and cannot be deleted.' });
    }

    await year.destroy();
    res.json({ message: 'Academic year removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
