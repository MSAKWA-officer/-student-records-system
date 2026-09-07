const { Exam, Term, AcademicYear, Result } = require('../models');

const includeRelations = [{ model: Term, include: [{ model: AcademicYear }] }];

// GET /api/exams?term_id=
exports.getAllExams = async (req, res) => {
  try {
    const { term_id } = req.query;
    const where = {};
    if (term_id) where.term_id = term_id;

    const exams = await Exam.findAll({
      where,
      include: includeRelations,
      order: [
        [Term, 'start_date', 'DESC'],
        ['start_date', 'ASC'],
      ],
    });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch exams.', error: err.message });
  }
};

// GET /api/exams/:id
exports.getExamById = async (req, res) => {
  try {
    const exam = await Exam.findByPk(req.params.id, { include: includeRelations });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/exams
// Body: { name, term_id, start_date, end_date, weight_percent }
// max_marks is NOT accepted here — every subject is always marked out of
// 100 (see the Exam model), so it is not a per-exam choice.
exports.createExam = async (req, res) => {
  try {
    const { name, term_id, start_date, end_date, weight_percent } = req.body;

    if (!name || !term_id) {
      return res.status(400).json({ message: 'Exam name and term are required.' });
    }
    if (start_date && end_date && end_date < start_date) {
      return res.status(400).json({ message: 'End date cannot be before the start date.' });
    }

    const term = await Term.findByPk(term_id);
    if (!term) return res.status(404).json({ message: 'Term not found.' });

    const exam = await Exam.create({
      name,
      term_id,
      start_date: start_date || null,
      end_date: end_date || start_date || null,
      max_marks: 100,
      weight_percent: weight_percent ?? 100,
    });

    const created = await Exam.findByPk(exam.id, { include: includeRelations });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: 'Failed to add the exam.', error: err.message });
  }
};

// PUT /api/exams/:id
// max_marks is deliberately stripped from the update body for the same
// reason as above — it always stays 100 per subject.
exports.updateExam = async (req, res) => {
  try {
    const exam = await Exam.findByPk(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });

    if (req.body.term_id) {
      const term = await Term.findByPk(req.body.term_id);
      if (!term) return res.status(404).json({ message: 'Term not found.' });
    }

    const { name, term_id, start_date, end_date, weight_percent } = req.body;
    const nextStart = start_date !== undefined ? start_date : exam.start_date;
    const nextEnd = end_date !== undefined ? end_date : exam.end_date;
    if (nextStart && nextEnd && nextEnd < nextStart) {
      return res.status(400).json({ message: 'End date cannot be before the start date.' });
    }

    await exam.update({ name, term_id, start_date, end_date, weight_percent });
    const updated = await Exam.findByPk(exam.id, { include: includeRelations });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update the exam.', error: err.message });
  }
};

// DELETE /api/exams/:id
exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findByPk(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });

    const resultCount = await Result.count({ where: { exam_id: exam.id } });
    if (resultCount > 0) {
      return res.status(409).json({ message: 'This exam has linked results and cannot be deleted.' });
    }

    await exam.destroy();
    res.json({ message: 'Exam removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
