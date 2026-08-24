const { ClassSubject, SchoolClass, Subject, Teacher, AcademicYear, Stream } = require('../models');

const includeRelations = [
  { model: SchoolClass },
  { model: Subject },
  { model: Teacher },
  { model: AcademicYear },
  { model: Stream },
];

// GET /api/class-subjects?school_class_id=&subject_id=&teacher_id=&academic_year_id=&stream_id=
exports.getAllClassSubjects = async (req, res) => {
  try {
    const { school_class_id, subject_id, teacher_id, academic_year_id, stream_id } = req.query;
    const where = {};
    if (school_class_id) where.school_class_id = school_class_id;
    if (subject_id) where.subject_id = subject_id;
    if (teacher_id) where.teacher_id = teacher_id;
    if (academic_year_id) where.academic_year_id = academic_year_id;
    if (stream_id) where.stream_id = stream_id;

    const assignments = await ClassSubject.findAll({
      where,
      include: includeRelations,
      order: [
        [SchoolClass, 'level', 'ASC'],
        [Subject, 'name', 'ASC'],
      ],
    });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch subject allocations.', error: err.message });
  }
};

// GET /api/class-subjects/:id
exports.getClassSubjectById = async (req, res) => {
  try {
    const assignment = await ClassSubject.findByPk(req.params.id, { include: includeRelations });
    if (!assignment) return res.status(404).json({ message: 'This allocation was not found.' });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/class-subjects
// Body: { school_class_id, subject_id, teacher_id, academic_year_id, stream_ids: [] }
// Empty/missing stream_ids => the allocation covers ALL Streams of that class (stream_id = null).
// stream_ids with more than one Stream => one allocation will be created per selected stream.
exports.createClassSubject = async (req, res) => {
  try {
    const { school_class_id, subject_id, teacher_id, academic_year_id, stream_ids } = req.body;

    if (!school_class_id || !subject_id || !academic_year_id) {
      return res.status(400).json({ message: 'Class, subject and academic year are required.' });
    }

    const [schoolClass, subject, academicYear] = await Promise.all([
      SchoolClass.findByPk(school_class_id),
      Subject.findByPk(subject_id),
      AcademicYear.findByPk(academic_year_id),
    ]);
    if (!schoolClass) return res.status(404).json({ message: 'Class not found.' });
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });
    if (!academicYear) return res.status(404).json({ message: 'Academic year not found.' });

    if (teacher_id) {
      const teacher = await Teacher.findByPk(teacher_id);
      if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
    }

    const cleanStreamIds = Array.isArray(stream_ids) ? stream_ids.filter(Boolean) : [];

    if (cleanStreamIds.length > 0) {
      const streams = await Stream.findAll({ where: { id: cleanStreamIds, school_class_id } });
      if (streams.length !== cleanStreamIds.length) {
        return res.status(400).json({ message: 'Some of the selected streams do not belong to this class.' });
      }
    }

    const streamIdsToCreate = cleanStreamIds.length > 0 ? cleanStreamIds : [null];

    const created = [];
    for (const streamId of streamIdsToCreate) {
      const existing = await ClassSubject.findOne({
        where: { school_class_id, subject_id, academic_year_id, stream_id: streamId },
      });
      if (existing) continue; // skip if this allocation already exists
      const row = await ClassSubject.create({
        school_class_id,
        subject_id,
        teacher_id: teacher_id || null,
        academic_year_id,
        stream_id: streamId,
      });
      created.push(row.id);
    }

    if (created.length === 0) {
      return res.status(409).json({ message: 'This allocation (subject/class/stream/year) already exists.' });
    }

    const full = await ClassSubject.findAll({ where: { id: created }, include: includeRelations });
    res.status(201).json(streamIdsToCreate.length > 1 ? full : full[0]);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This subject has already been allocated to this class/stream for this year.' });
    }
    res.status(400).json({ message: 'Failed to add the subject allocation.', error: err.message });
  }
};

// PUT /api/class-subjects/:id
// Normally used to change the teacher assigned to teach that subject in the class
exports.updateClassSubject = async (req, res) => {
  try {
    const assignment = await ClassSubject.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'This allocation was not found.' });

    const { teacher_id } = req.body;
    if (teacher_id) {
      const teacher = await Teacher.findByPk(teacher_id);
      if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
    }

    await assignment.update({ teacher_id: teacher_id === undefined ? assignment.teacher_id : (teacher_id || null) });

    const full = await ClassSubject.findByPk(assignment.id, { include: includeRelations });
    res.json(full);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update the subject allocation.', error: err.message });
  }
};

// DELETE /api/class-subjects/:id
exports.deleteClassSubject = async (req, res) => {
  try {
    const assignment = await ClassSubject.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'This allocation was not found.' });

    await assignment.destroy();
    res.json({ message: 'Subject allocation removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
