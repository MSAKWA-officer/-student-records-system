const { Result, Student, Exam, Subject, Term, AcademicYear, Enrollment, EnrollmentSubject, ClassSubject } = require('../models');
const { Op } = require('sequelize');

const includeRelations = [
  { model: Student },
  { model: Subject },
  { model: Exam, include: [{ model: Term, include: [{ model: AcademicYear }] }] },
];

// A teacher may only record/edit results for a subject they are actually
// allocated to teach, for the class/stream/year the student is currently
// enrolled in. Admin/headteacher are not restricted. Returns null if
// allowed, or a { status, message } object describing why it's rejected.
async function checkTeacherOwnership(req, { studentId, subjectId, examId }) {
  if (req.user?.role !== 'teacher') return null;

  const teacherId = req.user.teacher_id;
  if (!teacherId) {
    return { status: 403, message: 'Your account is not linked to a teacher profile.' };
  }

  const exam = await Exam.findByPk(examId, { include: [{ model: Term }] });
  if (!exam) return { status: 404, message: 'Exam not found.' };
  const academicYearId = exam.Term?.academic_year_id;

  const enrollment = await Enrollment.findOne({
    where: { student_id: studentId, ...(academicYearId ? { academic_year_id: academicYearId } : {}) },
    order: [['id', 'DESC']],
  });
  if (!enrollment) {
    return { status: 404, message: "This student's class enrollment could not be found for this exam's year." };
  }

  const allocation = await ClassSubject.findOne({
    where: {
      teacher_id: teacherId,
      subject_id: subjectId,
      school_class_id: enrollment.school_class_id,
      ...(academicYearId ? { academic_year_id: academicYearId } : {}),
    },
  });
  // stream_id = null on the allocation means "all streams" of that class.
  const matchesStream =
    allocation && (allocation.stream_id === null || allocation.stream_id === enrollment.stream_id);

  if (!allocation || !matchesStream) {
    return { status: 403, message: 'You are not assigned to teach this subject to this student.' };
  }

  return null;
}

// Simple grade based on the percentage of marks obtained
function computeGrade(marksObtained, maxMarks) {
  if (marksObtained == null || !maxMarks) return null;
  const pct = (marksObtained / maxMarks) * 100;
  if (pct >= 80) return 'A';
  if (pct >= 65) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 35) return 'D';
  return 'F';
}

// Points for each grade (NECTA O-Level style: A is the best = lowest points).
// Change this mapping if your school uses a different system (A-Level, etc.).
const GRADE_POINTS = { A: 1, B: 2, C: 3, D: 4, F: 5 };

// Division from the total points of the counted subjects (normally the best 7
// subjects for O-Level, but here we use all subjects with results recorded
// for that exam). Adjust these thresholds to match your school's rules.
function computeDivision(totalPoints, subjectCount) {
  if (!subjectCount) return null;
  if (totalPoints <= 17) return 'I';
  if (totalPoints <= 21) return 'II';
  if (totalPoints <= 25) return 'III';
  if (totalPoints <= 33) return 'IV';
  return '0';
}

// GET /api/results/exam-slip?student_id=&exam_id=
// Results for a single student for a single exam (e.g. First Term - Mock
// Exam), including Subject, Marks, Grade, Remarks and Division.
//
// The subject list is built from the student's own registered subjects
// (EnrollmentSubject, for the enrollment matching this exam's academic
// year) — "kulingana na masomo aliyosajiliwa" — not just whichever
// subjects happen to already have a result recorded. Subjects with no
// mark yet are still listed (flagged as incomplete) instead of silently
// disappearing, and Division is only computed automatically once every
// registered subject has been graded, using the best 7 subjects sat.
exports.getExamResultSlip = async (req, res) => {
  try {
    const { student_id, exam_id } = req.query;
    if (!student_id || !exam_id) {
      return res.status(400).json({ message: 'student_id and exam_id are required.' });
    }

    const exam = await Exam.findByPk(exam_id, { include: [{ model: Term, include: [{ model: AcademicYear }] }] });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });

    const student = await Student.findByPk(student_id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const academicYearId = exam.Term?.academic_year_id;

    const enrollment = await Enrollment.findOne({
      where: { student_id, ...(academicYearId ? { academic_year_id: academicYearId } : {}) },
      order: [['id', 'DESC']],
    });

    const enrollmentSubjects = enrollment
      ? await EnrollmentSubject.findAll({ where: { enrollment_id: enrollment.id }, include: [{ model: Subject }] })
      : [];

    const results = await Result.findAll({
      where: { student_id, exam_id },
      include: [{ model: Subject }],
    });
    const resultBySubjectId = new Map(results.map((r) => [r.subject_id, r]));

    // Prefer the student's registered subject list; fall back to whatever
    // results already exist (e.g. older data with no matching enrollment)
    // so nothing that was already recorded ever disappears from the slip.
    const subjectEntries = enrollmentSubjects.length
      ? enrollmentSubjects.map((es) => ({ subject_id: es.subject_id, subject_name: es.Subject?.name }))
      : results.map((r) => ({ subject_id: r.subject_id, subject_name: r.Subject?.name }));

    const bySubjectId = new Map();
    subjectEntries.forEach((s) => {
      if (!bySubjectId.has(s.subject_id)) bySubjectId.set(s.subject_id, s);
    });
    const orderedSubjects = Array.from(bySubjectId.values()).sort((a, b) =>
      (a.subject_name || '').localeCompare(b.subject_name || '')
    );

    const subjects = orderedSubjects.map((s) => {
      const r = resultBySubjectId.get(s.subject_id);
      const isComplete = !!r;
      return {
        result_id: r?.id || null,
        subject_id: s.subject_id,
        subject_name: s.subject_name,
        marks_obtained: isComplete ? r.marks_obtained : null,
        max_marks: exam.max_marks,
        grade: isComplete ? r.grade : null,
        remarks: isComplete ? r.remarks : null,
        points: isComplete && r.grade ? GRADE_POINTS[r.grade] ?? null : null,
        is_complete: isComplete,
      };
    });

    // The slip as a whole is only "complete" once every registered subject
    // has a mark — while anything is still missing, Division stays hidden
    // rather than showing a figure that would change once the rest of the
    // marks are entered.
    const allComplete = subjects.length > 0 && subjects.every((s) => s.is_complete);
    const gradedSubjects = subjects.filter((s) => s.points != null);
    const best7 = [...gradedSubjects].sort((a, b) => a.points - b.points).slice(0, 7);
    const totalPoints = best7.reduce((sum, s) => sum + s.points, 0);
    const division = allComplete && best7.length ? computeDivision(totalPoints, best7.length) : null;

    res.json({
      student: {
        id: student.id,
        full_name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' '),
        admission_number: student.admission_number,
      },
      exam: {
        id: exam.id,
        name: exam.name,
        max_marks: exam.max_marks,
        term_name: exam.Term?.name,
        academic_year_name: exam.Term?.AcademicYear?.year_name,
      },
      subjects,
      subjects_sat: gradedSubjects.length,
      total_points: allComplete && best7.length ? totalPoints : null,
      is_complete: allComplete,
      division,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch the exam results.', error: err.message });
  }
};

// GET /api/results?student_id=&exam_id=&subject_id=&school_class_id=&stream_id=
// A teacher only ever sees results for subjects they are allocated to
// teach — they cannot browse another teacher's subject by simply changing
// the subject_id filter.
//
// school_class_id / stream_id are optional scoping filters: when a class
// (and optionally a stream within it) is selected on the results pages,
// only the results belonging to students enrolled in that class/stream are
// returned — the query is never a system-wide pull once a class is chosen.
exports.getAllResults = async (req, res) => {
  try {
    const { student_id, exam_id, subject_id, school_class_id, stream_id } = req.query;
    const where = {};
    if (student_id) where.student_id = student_id;
    if (exam_id) where.exam_id = exam_id;
    if (subject_id) where.subject_id = subject_id;

    if (school_class_id || stream_id) {
      const enrollmentWhere = {};
      if (school_class_id) enrollmentWhere.school_class_id = school_class_id;
      if (stream_id) enrollmentWhere.stream_id = stream_id;

      const enrollments = await Enrollment.findAll({ where: enrollmentWhere, attributes: ['student_id'] });
      const scopedStudentIds = [...new Set(enrollments.map((e) => e.student_id))];

      if (scopedStudentIds.length === 0) return res.json([]);

      if (where.student_id) {
        if (!scopedStudentIds.map(String).includes(String(where.student_id))) return res.json([]);
      } else {
        where.student_id = { [Op.in]: scopedStudentIds };
      }
    }

    if (req.user?.role === 'teacher') {
      const teacherId = req.user.teacher_id;
      const allocations = teacherId
        ? await ClassSubject.findAll({ where: { teacher_id: teacherId }, attributes: ['subject_id'] })
        : [];
      const allowedSubjectIds = [...new Set(allocations.map((a) => a.subject_id))];

      if (subject_id) {
        if (!allowedSubjectIds.map(String).includes(String(subject_id))) {
          return res.status(403).json({ message: 'You are not assigned to teach this subject.' });
        }
      } else {
        if (allowedSubjectIds.length === 0) return res.json([]);
        where.subject_id = allowedSubjectIds;
      }
    }

    const results = await Result.findAll({
      where,
      include: includeRelations,
      order: [['id', 'DESC']],
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch results.', error: err.message });
  }
};

// GET /api/results/:id
exports.getResultById = async (req, res) => {
  try {
    const result = await Result.findByPk(req.params.id, { include: includeRelations });
    if (!result) return res.status(404).json({ message: 'Result not found.' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/results
// Body: { student_id, exam_id, subject_id, marks_obtained, remarks }
exports.createResult = async (req, res) => {
  try {
    const { student_id, exam_id, subject_id, marks_obtained, remarks } = req.body;

    if (!student_id || !exam_id || !subject_id || marks_obtained === undefined || marks_obtained === null) {
      return res.status(400).json({ message: 'Student, exam, subject and marks are required.' });
    }

    const [student, exam, subject] = await Promise.all([
      Student.findByPk(student_id),
      Exam.findByPk(exam_id),
      Subject.findByPk(subject_id),
    ]);
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });

    if (marks_obtained < 0 || marks_obtained > exam.max_marks) {
      return res.status(400).json({ message: `Marks must be between 0 and ${exam.max_marks}.` });
    }

    const ownershipError = await checkTeacherOwnership(req, { studentId: student_id, subjectId: subject_id, examId: exam_id });
    if (ownershipError) return res.status(ownershipError.status).json({ message: ownershipError.message });

    const grade = computeGrade(marks_obtained, exam.max_marks);

    const result = await Result.create({
      student_id,
      exam_id,
      subject_id,
      marks_obtained,
      grade,
      remarks: remarks || null,
      entered_by: req.user?.id || null,
    });

    const created = await Result.findByPk(result.id, { include: includeRelations });
    res.status(201).json(created);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'A result already exists for this student, subject and exam.' });
    }
    res.status(400).json({ message: 'Failed to add the result.', error: err.message });
  }
};

// PUT /api/results/:id
exports.updateResult = async (req, res) => {
  try {
    const result = await Result.findByPk(req.params.id, { include: [{ model: Exam }] });
    if (!result) return res.status(404).json({ message: 'Result not found.' });

    const maxMarks = result.Exam?.max_marks || 100;
    const marksObtained = req.body.marks_obtained !== undefined ? req.body.marks_obtained : result.marks_obtained;

    if (marksObtained < 0 || marksObtained > maxMarks) {
      return res.status(400).json({ message: `Marks must be between 0 and ${maxMarks}.` });
    }

    const ownershipError = await checkTeacherOwnership(req, {
      studentId: result.student_id,
      subjectId: result.subject_id,
      examId: result.exam_id,
    });
    if (ownershipError) return res.status(ownershipError.status).json({ message: ownershipError.message });

    const grade = computeGrade(marksObtained, maxMarks);

    // Only marks/remarks are editable here — student_id/subject_id/exam_id
    // are intentionally ignored even if sent, so an update can't be used to
    // move a result onto a student/subject the caller isn't allowed to touch.
    await result.update({ marks_obtained: marksObtained, remarks: req.body.remarks ?? result.remarks, grade });
    const updated = await Result.findByPk(result.id, { include: includeRelations });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update the result.', error: err.message });
  }
};

// DELETE /api/results/:id
exports.deleteResult = async (req, res) => {
  try {
    const result = await Result.findByPk(req.params.id);
    if (!result) return res.status(404).json({ message: 'Result not found.' });

    await result.destroy();
    res.json({ message: 'Result removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
