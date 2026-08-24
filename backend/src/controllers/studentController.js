const { Student, Enrollment, SchoolClass, Stream, AcademicYear, Teacher, ClassSubject, Subject, Term, Exam, Result, User } = require('../models');
const { Op } = require('sequelize');

// GET /api/students?search=&class_id=&status=
exports.getAllStudents = async (req, res) => {
  try {
    const { search, class_id, stream_id, status, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { admission_number: { [Op.like]: `%${search}%` } },
      ];
    }

    const include = [{
      model: Enrollment,
      include: [
        { model: SchoolClass },
        { model: Stream },
        { model: AcademicYear },
      ],
    }];

    if (class_id || stream_id) {
      const enrollmentWhere = {};
      if (class_id) enrollmentWhere.school_class_id = class_id;
      if (stream_id) enrollmentWhere.stream_id = stream_id;
      include[0].where = enrollmentWhere;
    }

    const students = await Student.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['last_name', 'ASC']],
      distinct: true,
    });

    res.json({
      total: students.count,
      page: parseInt(page),
      pages: Math.ceil(students.count / limit),
      data: students.rows,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch students.', error: err.message });
  }
};

// GET /api/students/:id
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id, {
      include: [{
        model: Enrollment,
        include: [{ model: SchoolClass }, { model: Stream }, { model: AcademicYear }],
      }],
    });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    res.json(student);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/students
exports.createStudent = async (req, res) => {
  try {
    const student = await Student.create(req.body);
    res.status(201).json(student);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This admission number already exists.' });
    }
    res.status(400).json({ message: 'Failed to add the student.', error: err.message });
  }
};

// PUT /api/students/:id
exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    await student.update(req.body);
    res.json(student);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update the record.', error: err.message });
  }
};

// DELETE /api/students/:id
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    await student.destroy();
    res.json({ message: 'Student removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /api/students/:id/report-card?academic_year_id=&term_id=
// A student's results report - all subjects they take, for a single term
// (if term_id is given) or the whole year (if term_id is omitted, results
// from all terms are combined).
exports.getReportCard = async (req, res) => {
  try {
    const studentId = req.params.id;
    const { academic_year_id, term_id } = req.query;

    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const enrollmentWhere = { student_id: studentId };
    if (academic_year_id) enrollmentWhere.academic_year_id = academic_year_id;

    const enrollment = await Enrollment.findOne({
      where: enrollmentWhere,
      include: [{ model: SchoolClass }, { model: Stream }, { model: AcademicYear }],
      order: [['academic_year_id', 'DESC']],
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'This student has no class enrollment for that year.' });
    }

    const yearId = enrollment.academic_year_id;

    // All subjects this student takes (from their class for that year).
    // A subject allocation can be for a specific Stream (stream_id) or for ALL
    // Streams (stream_id = null), so we take all allocations relevant to this
    // student's stream.
    const classSubjectsRaw = await ClassSubject.findAll({
      where: {
        school_class_id: enrollment.school_class_id,
        academic_year_id: yearId,
        [Op.or]: [{ stream_id: null }, { stream_id: enrollment.stream_id }],
      },
      include: [{ model: Subject }, { model: Teacher }],
    });

    // If a subject has both an "All Streams" allocation and one specific to this
    // student's stream, use the stream-specific one (it has more accurate teacher info).
    const classSubjectBySubjectId = new Map();
    classSubjectsRaw.forEach((cs) => {
      const existing = classSubjectBySubjectId.get(cs.subject_id);
      if (!existing || (cs.stream_id !== null && existing.stream_id === null)) {
        classSubjectBySubjectId.set(cs.subject_id, cs);
      }
    });
    const classSubjects = Array.from(classSubjectBySubjectId.values());

    // Terms within scope (a single term or the whole year)
    const termWhere = term_id ? { id: term_id } : { academic_year_id: yearId };
    const terms = await Term.findAll({ where: termWhere });
    const termIds = terms.map((t) => t.id);

    const exams = termIds.length
      ? await Exam.findAll({ where: { term_id: termIds }, include: [{ model: Term }] })
      : [];
    const examIds = exams.map((e) => e.id);

    const results = examIds.length
      ? await Result.findAll({
        where: { student_id: studentId, exam_id: examIds },
        include: [{ model: Subject }, { model: Exam, include: [{ model: Term }] }],
      })
      : [];

    const subjects = classSubjects.map((cs) => {
      const subjectResults = results
        .filter((r) => r.subject_id === cs.subject_id)
        .map((r) => ({
          exam_id: r.exam_id,
          exam_name: r.Exam?.name,
          term_name: r.Exam?.Term?.name,
          marks_obtained: r.marks_obtained,
          max_marks: r.Exam?.max_marks,
          grade: r.grade,
        }));

      const pctList = subjectResults
        .filter((r) => r.max_marks)
        .map((r) => (r.marks_obtained / r.max_marks) * 100);
      const average = pctList.length
        ? Math.round((pctList.reduce((a, b) => a + b, 0) / pctList.length) * 100) / 100
        : null;

      return {
        subject_id: cs.subject_id,
        subject_name: cs.Subject?.name,
        subject_code: cs.Subject?.code,
        teacher_name: cs.Teacher?.full_name || null,
        results: subjectResults,
        average,
      };
    });

    const subjectAverages = subjects.filter((s) => s.average != null).map((s) => s.average);
    const overallAverage = subjectAverages.length
      ? Math.round((subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length) * 100) / 100
      : null;

    res.json({
      student: {
        id: student.id,
        admission_number: student.admission_number,
        full_name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' '),
        gender: student.gender,
      },
      school_class: enrollment.SchoolClass?.name || null,
      stream: enrollment.Stream?.name || null,
      academic_year: enrollment.AcademicYear?.year_name || null,
      term: term_id ? (terms[0]?.name || null) : 'Mwaka Mzima',
      subjects,
      overall_average: overallAverage,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate the results report.', error: err.message });
  }
};

// POST /api/students/:id/create-login
// Body: { email, password }
// Creates a User account with role 'student' linked to this student record,
// so the student can log in and see only their own report card, result
// slips and attendance.
exports.createLogin = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    if (student.user_id) {
      return res.status(400).json({ message: 'This student already has a login account.' });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');

    const user = await User.create({
      full_name: fullName,
      email,
      password,
      role: 'student',
    });

    student.user_id = user.id;
    await student.save();

    res.status(201).json({ message: 'Student account created.', email: user.email });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This email is already registered.' });
    }
    res.status(400).json({ message: 'Failed to create the account.', error: err.message });
  }
};

// POST /api/students/:id/enroll
exports.enrollStudent = async (req, res) => {
  try {
    const { school_class_id, stream_id, academic_year_id } = req.body;
    const enrollment = await Enrollment.create({
      student_id: req.params.id,
      school_class_id,
      stream_id,
      academic_year_id,
    });
    res.status(201).json(enrollment);
  } catch (err) {
    res.status(400).json({ message: 'Failed to enroll in the class.', error: err.message });
  }
};
