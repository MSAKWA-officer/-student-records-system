const { Result, Student, Exam, Subject, Term, AcademicYear } = require('../models');

const includeRelations = [
  { model: Student },
  { model: Subject },
  { model: Exam, include: [{ model: Term, include: [{ model: AcademicYear }] }] },
];

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

    const results = await Result.findAll({
      where: { student_id, exam_id },
      include: [{ model: Subject }],
      order: [[{ model: Subject }, 'name', 'ASC']],
    });

    const subjects = results.map((r) => ({
      result_id: r.id,
      subject_id: r.subject_id,
      subject_name: r.Subject?.name,
      marks_obtained: r.marks_obtained,
      max_marks: exam.max_marks,
      grade: r.grade,
      remarks: r.remarks,
      points: r.grade ? GRADE_POINTS[r.grade] ?? null : null,
    }));

    const gradedSubjects = subjects.filter((s) => s.points != null);
    const totalPoints = gradedSubjects.reduce((sum, s) => sum + s.points, 0);
    const division = computeDivision(totalPoints, gradedSubjects.length);

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
      total_points: gradedSubjects.length ? totalPoints : null,
      division,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch the exam results.', error: err.message });
  }
};

// GET /api/results?student_id=&exam_id=&subject_id=
exports.getAllResults = async (req, res) => {
  try {
    const { student_id, exam_id, subject_id } = req.query;
    const where = {};
    if (student_id) where.student_id = student_id;
    if (exam_id) where.exam_id = exam_id;
    if (subject_id) where.subject_id = subject_id;

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

    const grade = computeGrade(marksObtained, maxMarks);

    await result.update({ ...req.body, grade });
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
