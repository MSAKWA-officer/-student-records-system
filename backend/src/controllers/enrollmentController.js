const { Enrollment, Student, SchoolClass, Stream, AcademicYear } = require('../models');

const includeRelations = [
  { model: Student },
  { model: SchoolClass },
  { model: Stream },
  { model: AcademicYear },
];

// GET /api/enrollments?student_id=&school_class_id=&stream_id=&academic_year_id=
exports.getAllEnrollments = async (req, res) => {
  try {
    const { student_id, school_class_id, stream_id, academic_year_id } = req.query;
    const where = {};
    if (student_id) where.student_id = student_id;
    if (school_class_id) where.school_class_id = school_class_id;
    if (stream_id) where.stream_id = stream_id;
    if (academic_year_id) where.academic_year_id = academic_year_id;

    const enrollments = await Enrollment.findAll({
      where,
      include: includeRelations,
      order: [
        [AcademicYear, 'year_name', 'DESC'],
        [SchoolClass, 'level', 'ASC'],
      ],
    });
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch class enrollments.', error: err.message });
  }
};

// GET /api/enrollments/:id
exports.getEnrollmentById = async (req, res) => {
  try {
    const enrollment = await Enrollment.findByPk(req.params.id, { include: includeRelations });
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found.' });
    res.json(enrollment);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/enrollments
// Body: { student_id, school_class_id, stream_id, academic_year_id }
exports.createEnrollment = async (req, res) => {
  try {
    const { student_id, school_class_id, stream_id, academic_year_id } = req.body;

    if (!student_id || !school_class_id || !academic_year_id) {
      return res.status(400).json({ message: 'Student, class and academic year are required.' });
    }

    const [student, schoolClass, academicYear] = await Promise.all([
      Student.findByPk(student_id),
      SchoolClass.findByPk(school_class_id),
      AcademicYear.findByPk(academic_year_id),
    ]);
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    if (!schoolClass) return res.status(404).json({ message: 'Class not found.' });
    if (!academicYear) return res.status(404).json({ message: 'Academic year not found.' });

    if (stream_id) {
      const stream = await Stream.findByPk(stream_id);
      if (!stream) return res.status(404).json({ message: 'Stream not found.' });
    }

    const enrollment = await Enrollment.create({
      student_id,
      school_class_id,
      stream_id: stream_id || null,
      academic_year_id,
    });

    const created = await Enrollment.findByPk(enrollment.id, { include: includeRelations });
    res.status(201).json(created);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This student is already enrolled for this academic year.' });
    }
    res.status(400).json({ message: 'Failed to add the enrollment.', error: err.message });
  }
};

// PUT /api/enrollments/:id
exports.updateEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findByPk(req.params.id);
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found.' });

    if (req.body.school_class_id) {
      const schoolClass = await SchoolClass.findByPk(req.body.school_class_id);
      if (!schoolClass) return res.status(404).json({ message: 'Class not found.' });
    }
    if (req.body.stream_id) {
      const stream = await Stream.findByPk(req.body.stream_id);
      if (!stream) return res.status(404).json({ message: 'Stream not found.' });
    }
    if (req.body.academic_year_id) {
      const academicYear = await AcademicYear.findByPk(req.body.academic_year_id);
      if (!academicYear) return res.status(404).json({ message: 'Academic year not found.' });
    }

    await enrollment.update(req.body);
    const updated = await Enrollment.findByPk(enrollment.id, { include: includeRelations });
    res.json(updated);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This student is already enrolled for this academic year.' });
    }
    res.status(400).json({ message: 'Failed to update the enrollment.', error: err.message });
  }
};

// DELETE /api/enrollments/:id
exports.deleteEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findByPk(req.params.id);
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found.' });

    await enrollment.destroy();
    res.json({ message: 'Enrollment removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
