const {
  Result,
  Student,
  Exam,
  Subject,
  Term,
  AcademicYear,
  SchoolClass,
  Enrollment,
  EnrollmentSubject,
} = require('../models');
const { Op } = require('sequelize');

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

// ---------------------------------------------------------------------
// Class Analysis Report (Division Summary + Top 10 Best/Lowest + Subject
// Performance) for one class in one exam. Powers ClassAnalysisReportPage.jsx.
// ---------------------------------------------------------------------

// Government/school header details for the printed report. There's no
// Settings table yet, so these are hardcoded here — move them into one if
// the school's details ever need to change without a code deploy.
const REPORT_SCHOOL_NAME = 'Ubungo Islamic High School';
const REPORT_REGION_LINE = 'UBUNGO, DAR ES SALAAM ';

function buildClassAnalysisMeta(schoolClass, exam) {
  return {
    school_name: REPORT_SCHOOL_NAME,
    region_line: REPORT_REGION_LINE,
    class_name: schoolClass.name,
    exam_name: exam.name,
    academic_year: exam.Term?.AcademicYear?.year_name,
    generated_at: new Date().toLocaleString('en-GB', { hour12: false }).replace(',', ''),
  };
}

const EMPTY_GRADE_COUNTS = { A: 0, B: 0, C: 0, D: 0, F: 0, total: 0 };

// GET /api/results/class-analysis?class_id=&exam_id=
exports.getClassAnalysisReport = async (req, res) => {
  try {
    const { class_id, exam_id } = req.query;
    if (!class_id || !exam_id) {
      return res.status(400).json({ message: 'class_id and exam_id are required.' });
    }

    const exam = await Exam.findByPk(exam_id, { include: [{ model: Term, include: [{ model: AcademicYear }] }] });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });

    const schoolClass = await SchoolClass.findByPk(class_id);
    if (!schoolClass) return res.status(404).json({ message: 'Class not found.' });

    const meta = buildClassAnalysisMeta(schoolClass, exam);
    const academicYearId = exam.Term?.academic_year_id;

    // Students enrolled in this class for the exam's academic year.
    const enrollmentWhere = { school_class_id: class_id };
    if (academicYearId) enrollmentWhere.academic_year_id = academicYearId;
    const enrollments = await Enrollment.findAll({ where: enrollmentWhere, include: [{ model: Student }] });
    const students = enrollments.map((e) => e.Student).filter(Boolean);
    const studentIds = students.map((s) => s.id);

    if (studentIds.length === 0) {
      return res.json({ meta, divisionSummary: [], topBest: [], topLowest: [], subjectPerformance: [] });
    }

    // Every result for these students, for this exam, across all subjects.
    const results = await Result.findAll({
      where: { exam_id, student_id: studentIds },
      include: [{ model: Subject }],
    });

    const resultsByStudent = new Map();
    for (const r of results) {
      if (!resultsByStudent.has(r.student_id)) resultsByStudent.set(r.student_id, []);
      resultsByStudent.get(r.student_id).push(r);
    }

    // Per-student total points (best-effort: every graded subject counts)
    // and Division, reusing the same rules as the individual result slip.
    const studentSummaries = students
      .map((s) => {
        const studentResults = resultsByStudent.get(s.id) || [];
        const gradedSubjects = studentResults.filter((r) => r.grade && GRADE_POINTS[r.grade] != null);
        if (gradedSubjects.length === 0) return null; // no results yet — excluded from ranking/division
        const totalPoints = gradedSubjects.reduce((sum, r) => sum + GRADE_POINTS[r.grade], 0);
        return {
          full_name: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' '),
          gender: s.gender, // 'male' | 'female'
          total_points: totalPoints,
          division: computeDivision(totalPoints, gradedSubjects.length),
        };
      })
      .filter(Boolean);

    // --- Division Performance Summary (rows: F / M / TOTAL, columns: I..IV, 0) ---
    const blankDivisionRow = () => ({ I: 0, II: 0, III: 0, IV: 0, '0': 0 });
    const divisionCounts = { F: blankDivisionRow(), M: blankDivisionRow(), TOTAL: blankDivisionRow() };
    for (const s of studentSummaries) {
      const sexKey = s.gender === 'female' ? 'F' : 'M';
      divisionCounts[sexKey][s.division] += 1;
      divisionCounts.TOTAL[s.division] += 1;
    }
    const divisionSummary = ['F', 'M', 'TOTAL'].map((sex) => ({ sex, divisions: divisionCounts[sex] }));

    // --- Top 10 Best / Lowest (fewer points = better, NECTA O-Level style) ---
    const ranked = [...studentSummaries].sort(
      (a, b) => a.total_points - b.total_points || a.full_name.localeCompare(b.full_name)
    );
    const toRankedRow = (s, rank) => ({
      rank,
      student_name: s.full_name,
      class_name: schoolClass.name,
      points: s.total_points,
      division: s.division,
    });
    const topBest = ranked.slice(0, 10).map((s, i) => toRankedRow(s, i + 1));
    const topLowest = [...ranked]
      .reverse()
      .slice(0, 10)
      .map((s, i) => toRankedRow(s, i + 1));

    // --- Subject Performance Summary (Subject x Sex x Grade A-F) ---
    const genderById = new Map(students.map((s) => [s.id, s.gender]));
    const subjectMap = new Map(); // subject_id -> { subject_name, F: counts, M: counts }
    for (const r of results) {
      if (!r.grade) continue;
      if (!subjectMap.has(r.subject_id)) {
        subjectMap.set(r.subject_id, {
          subject_name: r.Subject?.name || `Subject #${r.subject_id}`,
          F: { ...EMPTY_GRADE_COUNTS },
          M: { ...EMPTY_GRADE_COUNTS },
        });
      }
      const sexKey = genderById.get(r.student_id) === 'female' ? 'F' : 'M';
      const bucket = subjectMap.get(r.subject_id)[sexKey];
      bucket[r.grade] += 1;
      bucket.total += 1;
    }

    const subjectPerformance = Array.from(subjectMap.values())
      .map(({ subject_name, F, M }) => {
        const T = { ...EMPTY_GRADE_COUNTS };
        ['A', 'B', 'C', 'D', 'F'].forEach((g) => {
          T[g] = F[g] + M[g];
        });
        T.total = F.total + M.total;
        return { subject_name, rows: [{ sex: 'F', ...F }, { sex: 'M', ...M }, { sex: 'T', ...T }] };
      })
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

    res.json({ meta, divisionSummary, topBest, topLowest, subjectPerformance });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate the class analysis report.', error: err.message });
  }
};

// ---------------------------------------------------------------------
// NECTA-style Class / School Division Report (Division Performance
// Summary, per-student AGG/DIV with DETAILED SUBJECTS by subject CODE,
// and the Examination Centre Overall/Subjects Performance summaries).
// Powers ClassDivisionReportPage.jsx / SchoolDivisionReportPage.jsx.
// Separate from getClassAnalysisReport above (which powers a different
// page, ClassAnalysisReportPage.jsx) — both can coexist.
// ---------------------------------------------------------------------

const DIVISION_REPORT_REGION = 'Mbeya';
const DIVISION_REPORT_DISTRICT = 'Mbeya City';

// Competency band for a subject/centre GPA, in line with the standard NECTA
// 1.0–5.0 GPA scale used on examination-centre performance summaries.
function competencyLevel(gpa) {
  if (gpa == null || Number.isNaN(gpa)) return null;
  if (gpa <= 1.5) return 'Grade A (Excellent)';
  if (gpa <= 2.5) return 'Grade B (Good)';
  if (gpa <= 3.5) return 'Grade C (Average)';
  if (gpa <= 4.5) return 'Grade D (Satisfactory)';
  return 'Grade F (Fail)';
}

function studentFullName(student) {
  return [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
}

// Shared builder behind getClassResultsReport / getSchoolResultsReport.
// `enrollments` must include Student (and, for the school-wide report,
// SchoolClass) — one row per student to appear on the report.
async function buildDivisionReport(enrollments, exam) {
  const enrollmentIds = enrollments.map((e) => e.id);
  const studentIds = enrollments.map((e) => e.student_id);

  const enrollmentSubjects = enrollmentIds.length
    ? await EnrollmentSubject.findAll({
        where: { enrollment_id: { [Op.in]: enrollmentIds } },
        include: [{ model: Subject }],
      })
    : [];
  const subjectsByEnrollmentId = new Map();
  enrollmentSubjects.forEach((es) => {
    if (!subjectsByEnrollmentId.has(es.enrollment_id)) subjectsByEnrollmentId.set(es.enrollment_id, []);
    subjectsByEnrollmentId.get(es.enrollment_id).push(es);
  });

  const results = studentIds.length
    ? await Result.findAll({
        where: { exam_id: exam.id, student_id: { [Op.in]: studentIds } },
        include: [{ model: Subject }],
      })
    : [];
  const resultsByStudentId = new Map();
  results.forEach((r) => {
    if (!resultsByStudentId.has(r.student_id)) resultsByStudentId.set(r.student_id, new Map());
    resultsByStudentId.get(r.student_id).set(r.subject_id, r);
  });

  const studentRows = [];
  const allGradedEntries = []; // flat list of { subject_id, code, name, grade, points } across every student, for GPA

  for (const enrollment of enrollments) {
    const student = enrollment.Student;
    if (!student) continue;

    const regSubjects = subjectsByEnrollmentId.get(enrollment.id) || [];
    const resultMap = resultsByStudentId.get(student.id) || new Map();

    // Prefer the student's registered subjects; fall back to whatever
    // results already exist so a student never silently disappears just
    // because EnrollmentSubject wasn't set up for them.
    const subjectSource = regSubjects.length
      ? regSubjects.map((es) => ({ subject_id: es.subject_id, subject: es.Subject }))
      : Array.from(resultMap.values()).map((r) => ({ subject_id: r.subject_id, subject: r.Subject }));

    const graded = [];
    subjectSource.forEach((s) => {
      const r = resultMap.get(s.subject_id);
      if (r && r.grade && s.subject) {
        const points = GRADE_POINTS[r.grade] ?? null;
        const entry = { subject_id: s.subject_id, code: s.subject.code || s.subject.name, name: s.subject.name, grade: r.grade, points };
        graded.push(entry);
        allGradedEntries.push(entry);
      }
    });

    const isAbsent = subjectSource.length === 0 || graded.length === 0;
    const allComplete = subjectSource.length > 0 && graded.length === subjectSource.length;

    let agg = null;
    let div = null;
    if (!isAbsent && allComplete) {
      const best7 = [...graded].sort((a, b) => a.points - b.points).slice(0, 7);
      agg = best7.reduce((sum, s) => sum + s.points, 0);
      div = computeDivision(agg, best7.length);
    }

    studentRows.push({
      candidate_number: student.candidate_number || student.admission_number,
      name: studentFullName(student),
      sex: student.gender === 'female' ? 'F' : 'M',
      class_name: enrollment.SchoolClass?.name || null,
      agg,
      div,
      subjects: graded.map((g) => ({ code: g.code, grade: g.grade })),
      absent: isAbsent,
    });
  }

  // Sort by name, matching the printed sheet convention.
  studentRows.sort((a, b) => a.name.localeCompare(b.name));

  // --- Division Performance Summary (by sex) ---------------------------
  const blankTally = () => ({ I: 0, II: 0, III: 0, IV: 0, zero: 0 });
  const tally = { F: blankTally(), M: blankTally(), T: blankTally() };
  studentRows.forEach((s) => {
    if (!s.div) return;
    const key = s.div === '0' ? 'zero' : s.div;
    tally[s.sex][key] += 1;
    tally.T[key] += 1;
  });
  const divisionsBySex = [
    { sex: 'F', ...tally.F },
    { sex: 'M', ...tally.M },
    { sex: 'T', ...tally.T },
  ];

  // --- Overall counts ----------------------------------------------------
  const registered = studentRows.length;
  const absent = studentRows.filter((s) => s.absent).length;
  const sat = registered - absent;
  const incomplete = studentRows.filter((s) => !s.absent && s.div == null).length;
  const clean = sat - incomplete;
  const withheld = 0; // not tracked yet — wire up if/when a "withheld" status exists
  const no_ca = 0; // no continuous-assessment component tracked yet

  // --- Centre GPA (average grade point across every graded subject entry) —
  const gpa = allGradedEntries.length
    ? allGradedEntries.reduce((sum, e) => sum + e.points, 0) / allGradedEntries.length
    : null;

  // --- Examination Centre Subjects Performance ---------------------------
  const bySubject = new Map();
  allGradedEntries.forEach((e) => {
    if (!bySubject.has(e.subject_id)) bySubject.set(e.subject_id, { code: e.code, name: e.name, entries: [] });
    bySubject.get(e.subject_id).entries.push(e);
  });
  const subjectsPerformance = Array.from(bySubject.values())
    .map((s) => {
      const subjSat = s.entries.length;
      const subjPass = s.entries.filter((e) => e.grade !== 'F').length;
      const subjGpa = subjSat ? s.entries.reduce((sum, e) => sum + e.points, 0) / subjSat : null;
      return {
        code: s.code,
        name: s.name,
        reg: registered, // NECTA convention: REG = whole centre register, not per-subject
        sat: subjSat,
        pass: subjPass,
        gpa: subjGpa,
        competency: competencyLevel(subjGpa),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    meta: {
      school_name: REPORT_SCHOOL_NAME,
      region: DIVISION_REPORT_REGION,
      district: DIVISION_REPORT_DISTRICT,
      exam_name: exam.name,
      year_name: exam.Term?.AcademicYear?.year_name || null,
    },
    registered,
    absent,
    sat,
    withheld,
    no_ca,
    clean,
    incomplete,
    divisionsBySex,
    gpa,
    students: studentRows,
    subjectsPerformance,
  };
}

// GET /api/results/class-report?exam_id=&school_class_id=&stream_id=
exports.getClassResultsReport = async (req, res) => {
  try {
    const { exam_id, school_class_id, stream_id } = req.query;
    if (!exam_id || !school_class_id) {
      return res.status(400).json({ message: 'exam_id and school_class_id are required.' });
    }

    const exam = await Exam.findByPk(exam_id, { include: [{ model: Term, include: [{ model: AcademicYear }] }] });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });

    const schoolClass = await SchoolClass.findByPk(school_class_id);
    if (!schoolClass) return res.status(404).json({ message: 'Class not found.' });

    const academicYearId = exam.Term?.academic_year_id;
    const enrollmentWhere = { school_class_id, ...(academicYearId ? { academic_year_id: academicYearId } : {}) };
    if (stream_id) enrollmentWhere.stream_id = stream_id;

    const enrollments = await Enrollment.findAll({ where: enrollmentWhere, include: [{ model: Student }] });

    const report = await buildDivisionReport(enrollments, exam);
    report.meta.class_name = schoolClass.name;
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Failed to build the class results report.', error: err.message });
  }
};

// GET /api/results/school-report?exam_id=
exports.getSchoolResultsReport = async (req, res) => {
  try {
    const { exam_id } = req.query;
    if (!exam_id) return res.status(400).json({ message: 'exam_id is required.' });

    const exam = await Exam.findByPk(exam_id, { include: [{ model: Term, include: [{ model: AcademicYear }] }] });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });

    const academicYearId = exam.Term?.academic_year_id;
    const enrollments = await Enrollment.findAll({
      where: { ...(academicYearId ? { academic_year_id: academicYearId } : {}) },
      include: [{ model: Student }, { model: SchoolClass }],
    });

    const report = await buildDivisionReport(enrollments, exam);
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Failed to build the school results report.', error: err.message });
  }
};
