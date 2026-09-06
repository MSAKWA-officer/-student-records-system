import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { UploadCloud, Download, Search, GraduationCap } from 'lucide-react';
import { resultsApi } from '../resultsApi';
import { studentsApi } from '../../students/studentsApi';
import { examsApi } from '../../exams/examsApi';
import { classesApi } from '../../classes/classesApi';
import { classSubjectsApi } from '../../classSubjects/classSubjectsApi';
import { enrollmentsApi } from '../../enrollments/enrollmentsApi';
import { useAuth } from '../../../context/AuthContext';
import {
  filterOLevelClasses,
  autoRemark,
  studentFullName,
  computeBest7Division,
} from './oLevelResultHelpers';

// Recognised column header variants in an uploaded spreadsheet, normalised to
// lowercase letters/digits only. Only three columns are required — Admission
// No., Student and Marks. Grade/remarks/division are worked out automatically.
const ADMISSION_HEADERS = ['admissionnumber', 'admissionno', 'admno', 'regno', 'registrationnumber'];
const STUDENT_HEADERS = ['student', 'studentname', 'fullname', 'name'];
const MARKS_HEADERS = ['marks', 'marksobtained', 'score', 'mark'];

function normalizeHeader(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickField(row, candidates) {
  const normalizedEntries = Object.keys(row).map((k) => [normalizeHeader(k), row[k]]);
  for (const candidate of candidates) {
    const match = normalizedEntries.find(([key]) => key === candidate);
    if (match) return match[1];
  }
  return undefined;
}

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// O-Level Results — Create/Upload page (Form 1-4 only). Reachable from the
// "Upload Result" button on the O-Level ResultList page. A teacher only
// ever sees the classes/subjects they are actually allocated to teach, so
// they can only upload marks for their own students.
export default function ResultCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isTeacher = user?.role === 'teacher';

  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]); // allocations for the selected class

  const [classId, setClassId] = useState(searchParams.get('class_id') || '');
  const [streamId, setStreamId] = useState(searchParams.get('stream_id') || '');
  const [subjectId, setSubjectId] = useState(searchParams.get('subject_id') || '');
  const [examId, setExamId] = useState(searchParams.get('exam_id') || '');

  const [students, setStudents] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  // --- Single Student Entry mode ---
  const [mode, setMode] = useState('bulk'); // 'bulk' | 'single'
  const [studentSearch, setStudentSearch] = useState('');
  const [studentId, setStudentId] = useState(searchParams.get('student_id') || '');
  const [singleRows, setSingleRows] = useState([]);
  const [loadingSingle, setLoadingSingle] = useState(false);
  const [singleError, setSingleError] = useState('');
  const [savingSingle, setSavingSingle] = useState(false);
  const [singleSummary, setSingleSummary] = useState('');
  const [lastSingleSummary, setLastSingleSummary] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [classesRes, examsRes] = await Promise.all([classesApi.getAll(), examsApi.getAll()]);
        setClasses(filterOLevelClasses(classesRes.data));
        setExams(examsRes.data);
      } catch (err) {
        setError('Failed to load base data (classes/exams).');
      } finally {
        setLoadingLookups(false);
      }
    })();
  }, []);

  const selectedClass = useMemo(() => classes.find((c) => String(c.id) === String(classId)), [classes, classId]);
  const streamsForSelectedClass = selectedClass?.Streams || [];
  const selectedExam = useMemo(() => exams.find((ex) => String(ex.id) === String(examId)), [exams, examId]);
  const academicYearId = selectedExam?.Term?.academic_year_id;

  // Subjects actually allocated to this class (and, for a teacher, only the
  // ones allocated to them) — never the full subject catalogue. This is
  // what makes sure a teacher can only ever upload marks for a subject they
  // teach, and only for students in a class that subject is allocated to.
  useEffect(() => {
    if (!classId) {
      setClassSubjects([]);
      return;
    }
    setLoadingClassSubjects(true);
    classSubjectsApi
      .getAll({
        school_class_id: classId,
        ...(streamId ? { stream_id: streamId } : {}),
        ...(academicYearId ? { academic_year_id: academicYearId } : {}),
        ...(isTeacher ? { teacher_id: user.teacher_id } : {}),
      })
      .then((res) => setClassSubjects(res.data))
      .catch(() => setClassSubjects([]))
      .finally(() => setLoadingClassSubjects(false));
  }, [classId, streamId, academicYearId, isTeacher, user?.teacher_id]);

  const availableSubjects = useMemo(() => {
    const bySubject = new Map();
    classSubjects.forEach((cs) => {
      const existing = bySubject.get(cs.subject_id);
      if (!existing || (cs.stream_id !== null && existing.stream_id === null)) {
        bySubject.set(cs.subject_id, cs);
      }
    });
    return Array.from(bySubject.values())
      .map((cs) => cs.Subject)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classSubjects]);

  // If the previously chosen subject is no longer in this class's allocated
  // list (e.g. after switching class), clear it so nothing is uploaded to
  // a subject this teacher isn't assigned to.
  useEffect(() => {
    if (subjectId && !availableSubjects.some((s) => String(s.id) === String(subjectId))) {
      setSubjectId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSubjects]);

  const readyToUpload = mode === 'bulk' && classId && subjectId && examId;
  const showSingleSection = mode === 'single' && !!classId;
  const singleReady = mode === 'single' && classId && examId;

  useEffect(() => {
    setStudentSearch('');
    setLastSingleSummary('');
  }, [classId]);

  useEffect(() => {
    if (mode === 'bulk') resetImport();
    if (!classId) {
      setStudents([]);
      return;
    }
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, streamId, subjectId, examId, mode]);

  async function loadStudents() {
    setLoadingStudents(true);
    setError('');
    try {
      const params = { class_id: classId, limit: 1000 };
      if (streamId) params.stream_id = streamId;
      // Bulk mode: only students actually registered (enrolled) for the
      // chosen subject are loaded — some subjects are optional/elective,
      // so not every student in the class/stream takes this subject.
      if (mode === 'bulk' && subjectId) params.subject_id = subjectId;
      if (academicYearId) params.academic_year_id = academicYearId;
      const res = await studentsApi.getAll(params);
      setStudents(res.data.data || []);
    } catch (err) {
      setError('Failed to load students for this class/stream.');
    } finally {
      setLoadingStudents(false);
    }
  }

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) =>
        String(s.admission_number).toLowerCase().includes(term) ||
        studentFullName(s).toLowerCase().includes(term)
    );
  }, [students, studentSearch]);

  useEffect(() => {
    if (!singleReady || !studentId) {
      setSingleRows([]);
      return;
    }
    loadSingleStudentResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleReady, studentId, examId, classId, streamId]);

  async function loadSingleStudentResults() {
    setLoadingSingle(true);
    setSingleError('');
    setSingleSummary('');
    try {
      const [csRes, resultsRes, enrollRes] = await Promise.all([
        classSubjectsApi.getAll({
          school_class_id: classId,
          ...(streamId ? { stream_id: streamId } : {}),
          ...(academicYearId ? { academic_year_id: academicYearId } : {}),
          ...(isTeacher ? { teacher_id: user.teacher_id } : {}),
        }),
        resultsApi.getAll({ student_id: studentId, exam_id: examId }),
        enrollmentsApi.getAll({
          student_id: studentId,
          ...(academicYearId ? { academic_year_id: academicYearId } : {}),
        }),
      ]);

      // The subjects THIS student is actually registered (enrolled) for —
      // not every subject allocated to the class, since electives mean not
      // every student in a class takes every subject.
      const enrollment = (enrollRes.data || [])[0];
      if (!enrollment) {
        setSingleError(
          'This student has no subject registration (enrollment) for this exam\'s academic year yet. Register their subjects from the Enrollments page first.'
        );
        setSingleRows([]);
        return;
      }
      const enrolledSubjectIds = new Set((enrollment.EnrollmentSubjects || []).map((es) => es.subject_id));

      const bySubject = new Map();
      csRes.data.forEach((cs) => {
        if (!enrolledSubjectIds.has(cs.subject_id)) return; // not registered for this subject
        const existing = bySubject.get(cs.subject_id);
        if (!existing || (cs.stream_id !== null && existing.stream_id === null)) {
          bySubject.set(cs.subject_id, cs);
        }
      });

      const existingBySubject = new Map(resultsRes.data.map((r) => [r.subject_id, r]));

      const rows = Array.from(bySubject.values())
        .sort((a, b) => (a.Subject?.name || '').localeCompare(b.Subject?.name || ''))
        .map((cs) => {
          const existing = existingBySubject.get(cs.subject_id);
          return {
            subjectId: cs.subject_id,
            subjectName: cs.Subject?.name || '—',
            resultId: existing?.id || null,
            marks: existing?.marks_obtained != null ? String(existing.marks_obtained) : '',
            grade: existing?.grade || null,
          };
        });

      setSingleRows(rows);
    } catch (err) {
      setSingleError('Failed to load subjects/results for this student.');
      setSingleRows([]);
    } finally {
      setLoadingSingle(false);
    }
  }

  function updateSingleRow(subjId, field, value) {
    setSingleRows((rows) => rows.map((r) => (r.subjectId === subjId ? { ...r, [field]: value } : r)));
  }

  const singleSummaryStats = useMemo(() => {
    const total = singleRows.length;
    const graded = singleRows.filter((r) => r.resultId && r.grade);
    const missing = total - graded.length;
    const isComplete = total > 0 && missing === 0;
    const { division } = computeBest7Division(graded);
    return { total, gradedCount: graded.length, missing, isComplete, division: isComplete ? division : null };
  }, [singleRows]);

  async function saveSingleStudentResults() {
    const maxMarks = selectedExam?.max_marks;
    const rowsToSave = singleRows.filter((r) => r.marks !== '' && r.marks !== null);

    const invalid = rowsToSave.some((r) => {
      const n = Number(r.marks);
      return Number.isNaN(n) || n < 0 || (maxMarks && n > maxMarks);
    });
    if (invalid) {
      setSingleError(`Marks must be numbers between 0 and ${maxMarks || 100}.`);
      return;
    }

    setSavingSingle(true);
    setSingleError('');
    setSingleSummary('');
    let ok = 0;
    let failed = 0;

    for (const row of rowsToSave) {
      const payload = {
        student_id: studentId,
        exam_id: examId,
        subject_id: row.subjectId,
        marks_obtained: Number(row.marks),
      };
      try {
        if (row.resultId) {
          await resultsApi.update(row.resultId, payload);
        } else {
          await resultsApi.create(payload);
        }
        ok += 1;
      } catch (err) {
        failed += 1;
      }
    }

    setSavingSingle(false);
    const summaryMsg = `Saved ${ok} of ${rowsToSave.length}${failed ? ` — ${failed} failed` : ''} for ${
      studentFullName(students.find((s) => String(s.id) === String(studentId)) || {}) || 'the student'
    }.`;

    setLastSingleSummary(summaryMsg);
    setStudentId('');
    setStudentSearch('');
    setSingleRows([]);
    setSingleSummary('');
  }

  function resetImport() {
    setImportRows([]);
    setImportFileName('');
    setImportError('');
    setImportSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function downloadBulkTemplate() {
    const rows =
      students.length > 0
        ? students.map((s) => ({ 'Admission No.': s.admission_number, Student: studentFullName(s), Marks: '' }))
        : [{ 'Admission No.': '', Student: '', Marks: '' }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    const suffix = selectedClass ? `-${selectedClass.name.replace(/\s+/g, '-')}` : '';
    XLSX.writeFile(workbook, `o-level-results-upload-template${suffix}.xlsx`);
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportSummary(null);
    setImportFileName(file.name);

    if (!readyToUpload) {
      setImportError('Select a Class, Subject and Exam first, then upload the file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const parsed = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!parsed.length) {
          setImportError('No rows were found in this file.');
          setImportRows([]);
          return;
        }

        const preview = parsed.map((raw) => {
          const admissionNumber = String(pickField(raw, ADMISSION_HEADERS) ?? '').trim();
          const studentNameRaw = String(pickField(raw, STUDENT_HEADERS) ?? '').trim();
          const marksRaw = pickField(raw, MARKS_HEADERS);
          const student = students.find(
            (s) => String(s.admission_number).trim().toLowerCase() === admissionNumber.toLowerCase()
          );
          const nameMatches = student ? namesMatch(studentNameRaw, studentFullName(student)) : false;
          const marksNumber = marksRaw === '' || marksRaw === undefined ? NaN : Number(marksRaw);
          const maxMarks = selectedExam?.max_marks;
          const marksValid = !Number.isNaN(marksNumber) && marksNumber >= 0 && (!maxMarks || marksNumber <= maxMarks);

          return {
            admissionNumber,
            studentNameRaw,
            marksRaw: marksRaw === undefined ? '' : String(marksRaw),
            studentId: student?.id || null,
            studentName: student ? studentFullName(student) : null,
            nameMatches,
            marksValid,
          };
        });

        setImportRows(preview);
      } catch (err) {
        setImportError('Could not read this file. Please upload a valid Excel (.xlsx/.xls) or CSV file.');
        setImportRows([]);
      }
    };
    reader.onerror = () => setImportError('Failed to read the selected file.');
    reader.readAsArrayBuffer(file);
  }

  const matchedRows = importRows.filter((r) => r.studentId && r.nameMatches && r.marksValid);
  const unmatchedRows = importRows.filter((r) => !r.studentId);
  const mismatchedRows = importRows.filter((r) => r.studentId && !r.nameMatches);
  const invalidMarksRows = importRows.filter((r) => r.studentId && r.nameMatches && !r.marksValid);

  function rowStatus(r) {
    if (!r.studentId) return { label: 'Admission number not found', tone: 'amber' };
    if (!r.nameMatches) return { label: 'Name does not match admission number', tone: 'red' };
    if (!r.marksValid) return { label: 'Invalid marks', tone: 'red' };
    return { label: 'Ready', tone: 'emerald' };
  }

  async function saveImportedResults() {
    if (!matchedRows.length) return;
    setImporting(true);
    setImportSummary(null);
    let ok = 0;
    let failed = 0;
    for (const row of matchedRows) {
      try {
        const payload = {
          student_id: row.studentId,
          exam_id: examId,
          subject_id: subjectId,
          marks_obtained: Number(row.marksRaw),
        };
        try {
          await resultsApi.create(payload);
        } catch (err) {
          if (err.response?.status === 409) {
            const existing = await resultsApi.getAll({ exam_id: examId, subject_id: subjectId, student_id: row.studentId });
            const existingResult = (existing.data || [])[0];
            if (existingResult) {
              await resultsApi.update(existingResult.id, payload);
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
        ok += 1;
      } catch (err) {
        failed += 1;
      }
    }
    setImporting(false);
    setImportRows([]);
    setImportFileName('');
    setImportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImportSummary({ ok, failed, total: matchedRows.length });
  }

  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5">
          <Link to="/dashboard/results/o-level" className="text-sm text-blue-600 hover:underline">
            ← Back to O-Level Results
          </Link>
          <div className="mt-2 flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <GraduationCap size={18} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-black">Upload O-Level Results</h2>
              <p className="mt-1 text-sm text-black">
                Form 1 - Form 4 only. Choose the Class, Stream, Subject and Exam the file/entry applies to first.
                {isTeacher && ' Only classes/subjects allocated to you are shown.'}
              </p>
            </div>
          </div>
        </div>

        {/* Mode switch */}
        <div className="flex gap-2 border-b border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === 'bulk' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Bulk Upload (Excel)
          </button>
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === 'single' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Single Student Entry
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-4 border-b border-slate-100 px-6 py-5 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-black">Class *</label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setStreamId('');
                setSubjectId('');
              }}
              disabled={loadingLookups}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {classes.length === 0 && !loadingLookups && (
              <p className="mt-1 text-xs text-amber-600">
                {isTeacher ? 'You are not allocated to any O-Level class yet.' : 'No O-Level (Form 1-4) classes found.'}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-black">Stream</label>
            <select
              value={streamId}
              onChange={(e) => setStreamId(e.target.value)}
              disabled={!classId || streamsForSelectedClass.length === 0}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">All Streams</option>
              {streamsForSelectedClass.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {mode === 'bulk' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Subject *</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={!classId || loadingClassSubjects}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select Subject --</option>
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
              {classId && !loadingClassSubjects && availableSubjects.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  {isTeacher ? 'No subjects are allocated to you for this class.' : 'No subjects allocated to this class.'}
                </p>
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-black">Exam *</label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              disabled={loadingLookups}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select Exam --</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} {ex.Term ? `(${ex.Term.name})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="px-6 pt-4 text-sm text-red-600">{error}</p>}

        {mode === 'bulk' && !readyToUpload && !error && (
          <p className="px-6 py-6 text-sm text-black">
            Select a Class, Subject and Exam above to enable the upload (Stream is optional).
          </p>
        )}

        {mode === 'single' && !showSingleSection && !error && (
          <p className="px-6 py-6 text-sm text-black">
            Select a Class above to see its students (Stream is optional). You can pick the Exam either before
            or after choosing the student.
          </p>
        )}

        {/* --- Bulk Upload --- */}
        {readyToUpload && (
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-2">
              <UploadCloud size={18} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-black">Upload results from Excel</h3>
            </div>
            <p className="mt-1 text-xs text-black">
              Upload an .xlsx, .xls or .csv file with exactly three columns —{' '}
              <span className="font-medium">Admission No.</span>, <span className="font-medium">Student</span> and{' '}
              <span className="font-medium">Marks</span>. Grade, remarks and division are filled in automatically.
              Results apply to <span className="font-medium">{selectedClass?.name}</span>
              {streamId ? ` · Stream ${streamsForSelectedClass.find((s) => String(s.id) === String(streamId))?.name}` : ''} ·{' '}
              {availableSubjects.find((s) => String(s.id) === String(subjectId))?.name || 'this subject'} ·{' '}
              {selectedExam?.name || 'this exam'}.
            </p>

            {loadingStudents && <p className="mt-3 text-sm text-black">Loading students...</p>}

            {!loadingStudents && (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={downloadBulkTemplate}
                    className="flex items-center gap-2 rounded-md border border-slate-300 px-3.5 py-2 text-sm font-semibold text-black transition hover:bg-slate-50"
                    title="Download a template pre-filled with Admission No. and Student for this class/stream"
                  >
                    <Download size={16} /> Download Template
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelected}
                    className="block text-sm text-black file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500"
                  />
                  {importFileName && (
                    <button onClick={resetImport} className="text-sm text-slate-500 hover:underline">
                      Clear
                    </button>
                  )}
                  <span className="text-xs text-black">
                    {students.length} student(s) registered for this subject in this selection
                  </span>
                </div>

                {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}

                {importSummary && importRows.length === 0 && (
                  <p className="mt-3 text-sm font-medium text-emerald-700">
                    Saved {importSummary.ok} of {importSummary.total}
                    {importSummary.failed > 0 ? ` — ${importSummary.failed} failed` : ''}. Upload another file to
                    continue, or{' '}
                    <Link to="/dashboard/results/o-level" className="underline">
                      go back to O-Level Results
                    </Link>
                    .
                  </p>
                )}

                {importRows.length > 0 && (
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-black">
                      <span>{importRows.length} rows read from "{importFileName}"</span>
                      <span className="font-medium text-emerald-600">{matchedRows.length} ready to save</span>
                      {unmatchedRows.length > 0 && (
                        <span className="font-medium text-amber-600">{unmatchedRows.length} admission number(s) not found</span>
                      )}
                      {mismatchedRows.length > 0 && (
                        <span className="font-medium text-red-600">{mismatchedRows.length} name/admission mismatch</span>
                      )}
                      {invalidMarksRows.length > 0 && (
                        <span className="font-medium text-red-600">{invalidMarksRows.length} row(s) with invalid marks</span>
                      )}
                    </div>

                    <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-slate-200">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
                          <tr>
                            <th className="px-3 py-2 font-medium">Admission No.</th>
                            <th className="px-3 py-2 font-medium">Student</th>
                            <th className="px-3 py-2 font-medium">Marks</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importRows.map((r, idx) => {
                            const status = rowStatus(r);
                            const toneClass =
                              status.tone === 'amber'
                                ? 'text-amber-600'
                                : status.tone === 'red'
                                ? 'text-red-600'
                                : 'text-emerald-600';
                            return (
                              <tr key={idx} className={status.tone !== 'emerald' ? 'bg-red-50/40' : ''}>
                                <td className="px-3 py-2 text-black">{r.admissionNumber || '—'}</td>
                                <td className="px-3 py-2 text-black">{r.studentNameRaw || '—'}</td>
                                <td className="px-3 py-2 text-black">{r.marksRaw || '—'}</td>
                                <td className="px-3 py-2">
                                  <span className={`text-xs font-medium ${toneClass}`}>{status.label}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={saveImportedResults}
                        disabled={importing || matchedRows.length === 0}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                      >
                        {importing ? 'Saving...' : `Save ${matchedRows.length} Result(s)`}
                      </button>
                      {importSummary && (
                        <span className="text-sm text-black">
                          Saved {importSummary.ok} of {importSummary.total}
                          {importSummary.failed > 0 ? ` — ${importSummary.failed} failed` : ''}.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* --- Single Student Entry --- */}
        {showSingleSection && (
          <div className="px-6 py-5">
            <div className="flex items-center gap-2">
              <UploadCloud size={18} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-black">Enter results for one student</h3>
            </div>
            <p className="mt-1 text-xs text-black">
              Pick a student from <span className="font-medium">{selectedClass?.name}</span>
              {streamId ? ` · Stream ${streamsForSelectedClass.find((s) => String(s.id) === String(streamId))?.name}` : ''}
              {examId
                ? <> , then enter marks per subject for <span className="font-medium">{selectedExam?.name || 'this exam'}</span>. Only subjects this student is registered (enrolled) for are shown. Grade, remarks and division are filled in automatically.</>
                : '. Select an Exam above to load and record their subjects/marks.'}
            </p>

            {lastSingleSummary && (
              <p className="mt-3 text-sm font-medium text-emerald-700">{lastSingleSummary}</p>
            )}

            {loadingStudents && <p className="mt-3 text-sm text-black">Loading students...</p>}

            {!loadingStudents && (
              <>
                <div className="mt-4 max-w-md">
                  <label className="mb-1 block text-sm font-medium text-black">Search Student</label>
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by admission number or name..."
                      className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-3 max-h-80 overflow-y-auto overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
                      <tr>
                        <th className="px-3 py-2 font-medium">Admission No.</th>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Stream</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((s) => {
                        const selected = String(studentId) === String(s.id);
                        const streamName =
                          (s.Enrollments || []).find((e) => (streamId ? e.stream_id === Number(streamId) : true))?.Stream?.name ||
                          (s.Enrollments || [])[0]?.Stream?.name ||
                          '—';
                        return (
                          <tr key={s.id} className={selected ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                            <td className="px-3 py-2 text-black">{s.admission_number}</td>
                            <td className="px-3 py-2 font-medium text-black">{studentFullName(s)}</td>
                            <td className="px-3 py-2 text-black">{streamName}</td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => setStudentId(String(s.id))}
                                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                                  selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                                }`}
                              >
                                {selected ? 'Selected' : 'Fill Marks'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredStudents.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-3 py-6 text-center text-black">
                            {studentSearch ? `No student matches "${studentSearch}".` : 'No students in this class/stream.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {studentId && !examId && (
                  <p className="mt-4 text-sm text-black">
                    Select an Exam above to load this student's subjects and enter their marks.
                  </p>
                )}

                {studentId && examId && (
                  <div className="mt-5">
                    {loadingSingle && <p className="text-sm text-black">Loading subjects...</p>}
                    {singleError && <p className="text-sm text-red-600">{singleError}</p>}

                    {!loadingSingle && singleRows.length === 0 && !singleError && (
                      <p className="text-sm text-black">
                        {isTeacher
                          ? 'You are not allocated to teach any of the subjects this student is registered for in this class/stream.'
                          : 'This student is not registered for any subject that is allocated to this class/stream.'}
                      </p>
                    )}

                    {!loadingSingle && singleRows.length > 0 && (
                      <>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold text-black">
                            Marks for {studentFullName(students.find((s) => String(s.id) === String(studentId)) || {})}
                          </p>
                          <button type="button" onClick={() => setStudentId('')} className="text-xs text-blue-600 hover:underline">
                            ← Choose a different student
                          </button>
                        </div>
                        <div
                          className={`mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-2 text-xs ${
                            singleSummaryStats.isComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          <span className="font-medium">
                            {singleSummaryStats.gradedCount} of {singleSummaryStats.total} subjects recorded
                            {singleSummaryStats.missing > 0 ? ` — ${singleSummaryStats.missing} subject(s) not yet examined` : ''}
                          </span>
                          <span className="font-semibold">
                            Division: {singleSummaryStats.isComplete ? singleSummaryStats.division ?? '—' : 'Incomplete'}
                          </span>
                        </div>

                        <div className="overflow-hidden rounded-md border border-slate-200">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
                              <tr>
                                <th className="px-3 py-2 font-medium">Subject</th>
                                <th className="px-3 py-2 font-medium" style={{ width: '140px' }}>
                                  Marks {selectedExam?.max_marks ? `(/${selectedExam.max_marks})` : ''}
                                </th>
                                <th className="px-3 py-2 font-medium">Grade</th>
                                <th className="px-3 py-2 font-medium">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {singleRows.map((row) => (
                                <tr key={row.subjectId} className={!row.resultId ? 'bg-amber-50/40' : ''}>
                                  <td className="px-3 py-2 font-medium text-black">{row.subjectName}</td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      max={selectedExam?.max_marks || undefined}
                                      value={row.marks}
                                      onChange={(e) => updateSingleRow(row.subjectId, 'marks', e.target.value)}
                                      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm text-black outline-none focus:border-blue-500"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-black">{row.grade || '—'}</td>
                                  <td className="px-3 py-2 text-black">{autoRemark(row.grade)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                          <button
                            onClick={saveSingleStudentResults}
                            disabled={savingSingle}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                          >
                            {savingSingle ? 'Saving...' : 'Save Results'}
                          </button>
                          {singleSummary && <span className="text-sm text-black">{singleSummary}</span>}
                          <button
                            type="button"
                            onClick={() => navigate('/dashboard/results/o-level')}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Done — go to O-Level Results
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
