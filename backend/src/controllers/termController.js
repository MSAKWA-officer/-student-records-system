const { Term, AcademicYear, Exam } = require('../models');

const includeRelations = [{ model: AcademicYear }];

// GET /api/terms?academic_year_id=
exports.getAllTerms = async (req, res) => {
  try {
    const { academic_year_id } = req.query;
    const where = {};
    if (academic_year_id) where.academic_year_id = academic_year_id;

    const terms = await Term.findAll({
      where,
      include: includeRelations,
      order: [
        [AcademicYear, 'year_name', 'DESC'],
        ['start_date', 'ASC'],
      ],
    });
    res.json(terms);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch terms.', error: err.message });
  }
};

// GET /api/terms/:id
exports.getTermById = async (req, res) => {
  try {
    const term = await Term.findByPk(req.params.id, { include: includeRelations });
    if (!term) return res.status(404).json({ message: 'Term not found.' });
    res.json(term);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/terms
// Body: { name, academic_year_id, start_date, end_date, is_current }
exports.createTerm = async (req, res) => {
  try {
    const { name, academic_year_id, start_date, end_date, is_current } = req.body;

    if (!name || !academic_year_id) {
      return res.status(400).json({ message: 'Term name and academic year are required.' });
    }

    const academicYear = await AcademicYear.findByPk(academic_year_id);
    if (!academicYear) return res.status(404).json({ message: 'Academic year not found.' });

    // If this new term is "is_current", make sure all others are not current
    if (is_current) {
      await Term.update({ is_current: false }, { where: {} });
    }

    const term = await Term.create({
      name,
      academic_year_id,
      start_date: start_date || null,
      end_date: end_date || null,
      is_current: !!is_current,
    });

    const created = await Term.findByPk(term.id, { include: includeRelations });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: 'Failed to add the term.', error: err.message });
  }
};

// PUT /api/terms/:id
exports.updateTerm = async (req, res) => {
  try {
    const term = await Term.findByPk(req.params.id);
    if (!term) return res.status(404).json({ message: 'Term not found.' });

    if (req.body.academic_year_id) {
      const academicYear = await AcademicYear.findByPk(req.body.academic_year_id);
      if (!academicYear) return res.status(404).json({ message: 'Academic year not found.' });
    }

    if (req.body.is_current) {
      await Term.update({ is_current: false }, { where: {} });
    }

    await term.update(req.body);
    const updated = await Term.findByPk(term.id, { include: includeRelations });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update the term.', error: err.message });
  }
};

// DELETE /api/terms/:id
exports.deleteTerm = async (req, res) => {
  try {
    const term = await Term.findByPk(req.params.id);
    if (!term) return res.status(404).json({ message: 'Term not found.' });

    const examCount = await Exam.count({ where: { term_id: term.id } });
    if (examCount > 0) {
      return res.status(409).json({ message: 'This term has linked exams and cannot be deleted.' });
    }

    await term.destroy();
    res.json({ message: 'Term removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
