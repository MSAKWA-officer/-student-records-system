import { useMemo, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { UploadCloud, Download, Search } from 'lucide-react';
import { resultsApi } from './resultsApi';
import { studentsApi } from '../students/studentsApi';
import { examsApi } from '../exams/examsApi';
import { subjectsApi } from '../subjects/Subjectsapi';
import { classesApi } from '../classes/classesApi';
import { classSubjectsApi } from '../classSubjects/classSubjectsApi';

// Recognised column header variants in an uploaded spreadsheet, normalised to
// lowercase letters/digits only (spaces, underscores, punctuation stripped).
// Only three columns are required from the user — Admission No., Student and
// Marks. Everything else (grade, remarks, division/completeness) is worked
// out by the system after the file is uploaded.
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

// Loose name comparison — trims punctuation/extra spaces and accepts either
// name being a subset of the other, so "John Doe" still matches a record
// stored as "John A. Doe" while still catching a genuine mismatch.
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

// Grade + Division logic mirrors the backend (resultController.js) so the
// "Incomplete" / Division indicator shown here matches what a student's
// report card will eventually show.
const GRADE_POINTS = { A: 1, B: 2, C: 3, D: 4, F: 5 };

function computeDivision(totalPoints, subjectCount) {
  if (!subjectCount) return null;
  if (totalPoints <= 17) return 'I';
  if (totalPoints <= 21) return 'II';
  if (totalPoints <= 25) return 'III';
  if (totalPoints <= 33) return 'IV';
  return '0';
}

// Remarks are never typed manually anymore — they're derived automatically
// from the grade once a result is saved.
function autoRemark(grade) {
  switch ((grade || '').toString().toUpperCase()) {
    case 'A':
      return 'Excellent';
    case 'B':
      return 'Very Good';
    case 'C':
      return 'Good';
    case 'D':
      return 'Satisfactory';
    case 'F':
      return 'Fail';
    default:
      return '—';
  }
}

export default function UploadResultsPage() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);

  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examId, setExamId] = useState('');

  const [students, setStudents] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
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
  const [studentId, setStudentId] = useState('');
  const [singleRows, setSingleRows] = useState([]); // [{ subjectId, subjectName, resultId, marks, grade }]
  const [loadingSingle, setLoadingSingle] = useState(false);
  const [singleError, setSingleError] = useState('');
  const [savingSingle, setSavingSingle] = useState(false);
  const [singleSummary, setSingleSummary] = useState('');
  // Persists after the form above resets on save, so the outcome stays
  // visible instead of disappearing along with the cleared form.
  const [lastSingleSummary, setLastSingleSummary] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [classesRes, subjectsRes, examsRes] = await Promise.all([
          classesApi.getAll(),
          subjectsApi.getAll(),
          examsApi.getAll(),
        ]);
        setClasses(classesRes.data);
        setSubjects(subjectsRes.data);
        setExams(examsRes.data);
      } catch (err) {
        setError('Failed to load base data (classes/subjects/exams).');
      } finally {
        setLoadingLookups(false);
      }
    })();
  }, []);

  const selectedClass = useMemo(() => classes.find((c) => String(c.id) === String(classId)), [classes, classId]);
  const streamsForSelectedClass = selectedClass?.Streams || [];
  const selectedExam = useMemo(() => exams.find((ex) => String(ex.id) === String(examId)), [exams, examId]);

  const readyToUpload = mode === 'bulk' && classId && subjectId && examId;
  // The student picker only needs a Class selected — Exam is only required
  // once a student is picked, to load their subjects/marks for that exam.
  const showSingleSection = mode === 'single' && !!classId;
  const singleReady = mode === 'single' && classId && examId;

  useEffect(() => {
    setStreamId('');
    setStudentId('');
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
      const res = await studentsApi.getAll(params);
      setStudents(res.data.data || []);
    } catch (err) {
      setError('Failed to load students for this class/stream.');
    } finally {
      setLoadingStudents(false);
    }
  }

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  // Students matching the admission-number/name search, for the Single
  // Student Entry picker below.
  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) =>
        String(s.admission_number).toLowerCase().includes(term) ||
        studentName(s).toLowerCase().includes(term)
    );
  }, [students, studentSearch]);

  // --- Single Student Entry: load class subjects + existing results ---
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
      const academicYearId = selectedExam?.Term?.academic_year_id;
      const [csRes, resultsRes] = await Promise.all([
        classSubjectsApi.getAll({
          school_class_id: classId,
          ...(streamId ? { stream_id: streamId } : {}),
          ...(academicYearId ? { academic_year_id: academicYearId } : {}),
        }),
        resultsApi.getAll({ student_id: studentId, exam_id: examId }),
      ]);

      // A subject can have both an "All Streams" allocation (stream_id=null)
      // and one specific to the student's stream; prefer the more specific one.
      const bySubject = new Map();
      csRes.data.forEach((cs) => {
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

  function updateSingleRow(subjectId, field, value) {
    setSingleRows((rows) => rows.map((r) => (r.subjectId === subjectId ? { ...r, [field]: value } : r)));
  }

  // Completeness + Division summary for the student currently open in
  // Single Student Entry. A student is "Incomplete" if any subject they are
  // registered for has no saved result yet for this exam — in that case the
  // Division also reads "Incomplete" instead of a Roman numeral.
  const singleSummaryStats = useMemo(() => {
    const total = singleRows.length;
    const graded = singleRows.filter((r) => r.resultId && r.grade);
    const missing = total - graded.length;
    const isComplete = total > 0 && missing === 0;
    // Division points come from only the best 7 subjects (lowest points =
    // strongest grades) among those sat — not every subject recorded. If
    // fewer than 7 were sat, all of them count. Mirrors StudentReportCard.
    const best7 = [...graded]
      .sort((a, b) => (GRADE_POINTS[a.grade] || 0) - (GRADE_POINTS[b.grade] || 0))
      .slice(0, 7);
    const totalPoints = best7.reduce((sum, r) => sum + (GRADE_POINTS[r.grade] || 0), 0);
    const division = isComplete ? computeDivision(totalPoints, best7.length) : null;
    return { total, gradedCount: graded.length, missing, isComplete, division };
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
    const summaryMsg = `Saved ${ok} of ${rowsToSave.length}${failed ? ` — ${failed} failed` : ''} for ${studentName(
      students.find((s) => String(s.id) === String(studentId)) || {}
    ) || 'the student'}.`;

    // Clear the entry form (student + subject rows) instead of leaving the
    // just-saved data sitting on screen — keep the outcome message so the
    // user still sees what happened, then they can pick the next student.
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

  // Lets the user download a ready-made template for the currently selected
  // class/stream — Admission No. and Student already filled in from the real
  // roster, Marks left blank — so there's no guesswork about column names.
  function downloadBulkTemplate() {
    const rows =
      students.length > 0
        ? students.map((s) => ({ 'Admission No.': s.admission_number, Student: studentName(s), Marks: '' }))
        : [{ 'Admission No.': '', Student: '', Marks: '' }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    const suffix = selectedClass ? `-${selectedClass.name.replace(/\s+/g, '-')}` : '';
    XLSX.writeFile(workbook, `results-upload-template${suffix}.xlsx`);
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
          const nameMatches = student ? namesMatch(studentNameRaw, studentName(student)) : false;
          const marksNumber = marksRaw === '' || marksRaw === undefined ? NaN : Number(marksRaw);
          const maxMarks = selectedExam?.max_marks;
          const marksValid = !Number.isNaN(marksNumber) && marksNumber >= 0 && (!maxMarks || marksNumber <= maxMarks);

          return {
            admissionNumber,
            studentNameRaw,
            marksRaw: marksRaw === undefined ? '' : String(marksRaw),
            studentId: student?.id || null,
            studentName: student ? studentName(student) : null,
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

  // A row is only saved once its admission number AND student name both
  // match the same real student, and its marks are valid.
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
        // Try create first; if a result already exists, fall back to update.
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
    // Clear the uploaded file and preview table so the form doesn't sit
    // there showing already-saved rows — keep only the outcome message.
    setImportRows([]);
    setImportFileName('');
    setImportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImportSummary({ ok, failed, total: matchedRows.length });
  }

  return (
    <div className="p-4">
      {/* Everything on this page — header, mode switch, filters, and both
          the bulk-upload and single-student sections — lives inside this
          one card/div with a single background. */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5">
          <Link to="/dashboard/results/view" className="text-sm text-blue-600 hover:underline">
            ← Back
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-black">Upload Results</h2>
          <p className="mt-1 text-sm text-black">
            Upload student results from an Excel/CSV file — choose the Class, Stream, Subject and Exam the
            file applies to first.
          </p>
        </div>

        {/* Mode switch — kept in its original colours */}
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
              onChange={(e) => setClassId(e.target.value)}
              disabled={loadingLookups}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
                disabled={loadingLookups}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select Subject --</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
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
              <span className="font-medium">Marks</span>. Everything else (grade, remarks, division/completeness)
              is filled in automatically once the file is uploaded. Results apply to{' '}
              <span className="font-medium">{selectedClass?.name}</span>
              {streamId ? ` · Stream ${streamsForSelectedClass.find((s) => String(s.id) === String(streamId))?.name}` : ''} ·{' '}
              {subjects.find((s) => String(s.id) === String(subjectId))?.name || 'this subject'} ·{' '}
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
                  <span className="text-xs text-black">{students.length} students in this selection</span>
                </div>

                {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}

                {/* Persists after the form/preview below is cleared on save,
                    so the outcome stays visible instead of vanishing. */}
                {importSummary && importRows.length === 0 && (
                  <p className="mt-3 text-sm font-medium text-emerald-700">
                    Saved {importSummary.ok} of {importSummary.total}
                    {importSummary.failed > 0 ? ` — ${importSummary.failed} failed` : ''}. Upload another file to
                    continue.
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
                ? <> , then enter marks per subject for <span className="font-medium">{selectedExam?.name || 'this exam'}</span>. Grade, remarks and division are filled in automatically.</>
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

                {/* Full class list, right on the page — click a row (or
                    "Fill Marks") to select that student below, instead of
                    hunting through a small dropdown. */}
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
                          (s.Enrollments || []).find((e) =>
                            streamId ? e.stream_id === Number(streamId) : true
                          )?.Stream?.name ||
                          (s.Enrollments || [])[0]?.Stream?.name ||
                          '—';
                        return (
                          <tr key={s.id} className={selected ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                            <td className="px-3 py-2 text-black">{s.admission_number}</td>
                            <td className="px-3 py-2 font-medium text-black">{studentName(s)}</td>
                            <td className="px-3 py-2 text-black">{streamName}</td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => setStudentId(String(s.id))}
                                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                                  selected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-blue-200 text-blue-600 hover:bg-blue-50'
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
                      <p className="text-sm text-black">No subjects assigned to this class/stream.</p>
                    )}

                    {!loadingSingle && singleRows.length > 0 && (
                      <>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold text-black">
                            Marks for {studentName(students.find((s) => String(s.id) === String(studentId)) || {})}
                          </p>
                          <button
                            type="button"
                            onClick={() => setStudentId('')}
                            className="text-xs text-blue-600 hover:underline"
                          >
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
                            {singleSummaryStats.missing > 0
                              ? ` — ${singleSummaryStats.missing} subject(s) not yet examined`
                              : ''}
                          </span>
                          <span className="font-semibold">
                            Division:{' '}
                            {singleSummaryStats.isComplete
                              ? singleSummaryStats.division != null
                                ? singleSummaryStats.division
                                : '—'
                              : 'Incomplete'}
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
