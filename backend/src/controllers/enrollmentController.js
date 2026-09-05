const { sequelize, Enrollment, Student, SchoolClass, Stream, AcademicYear, Subject, EnrollmentSubject } = require('../models');

const includeRelations = [
  { model: Student },
  { model: SchoolClass },
  { model: Stream },
  { model: AcademicYear },
  { model: EnrollmentSubject, include: [{ model: Subject }] },
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
// Body: { student_id, school_class_id, stream_id, academic_year_id, subject_ids: [] }
// subject_ids should be a subset of the subjects allocated to that class
// (via ClassSubject) for that year/stream — this is where we record which
// of those subjects THIS student actually takes (some are optional/elective,
// so not every student takes every subject their class offers).
exports.createEnrollment = async (req, res) => {
  const { student_id, school_class_id, stream_id, academic_year_id, subject_ids } = req.body;

  if (!student_id || !school_class_id || !academic_year_id) {
    return res.status(400).json({ message: 'Student, class and academic year are required.' });
  }
  if (!Array.isArray(subject_ids) || subject_ids.length === 0) {
    return res.status(400).json({ message: 'Select at least one subject for this student.' });
  }

  const t = await sequelize.transaction();
  try {
    const [student, schoolClass, academicYear] = await Promise.all([
      Student.findByPk(student_id),
      SchoolClass.findByPk(school_class_id),
      AcademicYear.findByPk(academic_year_id),
    ]);
    if (!student) { await t.rollback(); return res.status(404).json({ message: 'Student not found.' }); }
    if (!schoolClass) { await t.rollback(); return res.status(404).json({ message: 'Class not found.' }); }
    if (!academicYear) { await t.rollback(); return res.status(404).json({ message: 'Academic year not found.' }); }

    if (stream_id) {
      const stream = await Stream.findByPk(stream_id);
      if (!stream) { await t.rollback(); return res.status(404).json({ message: 'Stream not found.' }); }
    }

    const subjects = await Subject.findAll({ where: { id: subject_ids } });
    if (subjects.length !== subject_ids.length) {
      await t.rollback();
      return res.status(404).json({ message: 'One or more selected subjects were not found.' });
    }

    const enrollment = await Enrollment.create({
      student_id,
      school_class_id,
      stream_id: stream_id || null,
      academic_year_id,
    }, { transaction: t });

    await EnrollmentSubject.bulkCreate(
      subject_ids.map((subject_id) => ({ enrollment_id: enrollment.id, subject_id })),
      { transaction: t }
    );

    await t.commit();

    const created = await Enrollment.findByPk(enrollment.id, { include: includeRelations });
    res.status(201).json(created);
  } catch (err) {
    await t.rollback();
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This student is already enrolled for this academic year.' });
    }
    res.status(400).json({ message: 'Failed to add the enrollment.', error: err.message });
  }
};

// PUT /api/enrollments/:id
// Body can include subject_ids: [] to replace this student's subject
// selection for this enrollment (e.g. they add/drop an elective).
exports.updateEnrollment = async (req, res) => {
  const { subject_ids, ...rest } = req.body;
  const t = await sequelize.transaction();
  try {
    const enrollment = await Enrollment.findByPk(req.params.id);
    if (!enrollment) { await t.rollback(); return res.status(404).json({ message: 'Enrollment not found.' }); }

    if (rest.school_class_id) {
      const schoolClass = await SchoolClass.findByPk(rest.school_class_id);
      if (!schoolClass) { await t.rollback(); return res.status(404).json({ message: 'Class not found.' }); }
    }
    if (rest.stream_id) {
      const stream = await Stream.findByPk(rest.stream_id);
      if (!stream) { await t.rollback(); return res.status(404).json({ message: 'Stream not found.' }); }
    }
    if (rest.academic_year_id) {
      const academicYear = await AcademicYear.findByPk(rest.academic_year_id);
      if (!academicYear) { await t.rollback(); return res.status(404).json({ message: 'Academic year not found.' }); }
    }

    await enrollment.update(rest, { transaction: t });

    if (Array.isArray(subject_ids)) {
      if (subject_ids.length === 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Select at least one subject for this student.' });
      }
      const subjects = await Subject.findAll({ where: { id: subject_ids } });
      if (subjects.length !== subject_ids.length) {
        await t.rollback();
        return res.status(404).json({ message: 'One or more selected subjects were not found.' });
      }
      await EnrollmentSubject.destroy({ where: { enrollment_id: enrollment.id }, transaction: t });
      await EnrollmentSubject.bulkCreate(
        subject_ids.map((subject_id) => ({ enrollment_id: enrollment.id, subject_id })),
        { transaction: t }
      );
    }

    await t.commit();
    const updated = await Enrollment.findByPk(enrollment.id, { include: includeRelations });
    res.json(updated);
  } catch (err) {
    await t.rollback();
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

    await EnrollmentSubject.destroy({ where: { enrollment_id: enrollment.id } });
    await enrollment.destroy();
    res.json({ message: 'Enrollment removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
