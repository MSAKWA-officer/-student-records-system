import { useMemo, useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud } from 'lucide-react';
import { resultsApi } from './resultsApi';
import { studentsApi } from '../students/studentsApi';
import { examsApi } from '../exams/examsApi';
import { subjectsApi } from '../subjects/Subjectsapi';
import { classesApi } from '../classes/classesApi';
import { classSubjectsApi } from '../classSubjects/classSubjectsApi';

// Recognised column header variants in an uploaded spreadsheet, normalised to
// lowercase letters/digits only (spaces, underscores, punctuation stripped).
const ADMISSION_HEADERS = ['admissionnumber', 'admissionno', 'admno', 'regno', 'registrationnumber'];
const MARKS_HEADERS = ['marks', 'marksobtained', 'score', 'mark'];
const REMARKS_HEADERS = ['remarks', 'remark', 'comment', 'comments'];

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

  const [studentId, setStudentId] = useState('');
  const [singleRows, setSingleRows] = useState([]); // [{ subjectId, subjectName, resultId, marks, remarks }]
  const [loadingSingle, setLoadingSingle] = useState(false);
  const [singleError, setSingleError] = useState('');
  const [savingSingle, setSavingSingle] = useState(false);
  const [singleSummary, setSingleSummary] = useState('');

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
  const singleReady = mode === 'single' && classId && examId;

  useEffect(() => {
    setStreamId('');
    setStudentId('');
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
            remarks: existing?.remarks || '',
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
        remarks: row.remarks || null,
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
    setSingleSummary(`Saved ${ok} of ${rowsToSave.length}${failed ? ` — ${failed} failed` : ''}.`);
    loadSingleStudentResults(); // onyesha upya (resultId mpya kwa rows zilizotengenezwa)
  }

  function resetImport() {
    setImportRows([]);
    setImportFileName('');
    setImportError('');
    setImportSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
          const marksRaw = pickField(raw, MARKS_HEADERS);
          const remarksRaw = pickField(raw, REMARKS_HEADERS);
          const student = students.find(
            (s) => String(s.admission_number).trim().toLowerCase() === admissionNumber.toLowerCase()
          );
          const marksNumber = marksRaw === '' || marksRaw === undefined ? NaN : Number(marksRaw);
          const maxMarks = selectedExam?.max_marks;
          const marksValid = !Number.isNaN(marksNumber) && marksNumber >= 0 && (!maxMarks || marksNumber <= maxMarks);

          return {
            admissionNumber,
            marksRaw: marksRaw === undefined ? '' : String(marksRaw),
            remarksRaw: remarksRaw === undefined ? '' : String(remarksRaw),
            studentId: student?.id || null,
            studentName: student ? studentName(student) : null,
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

  const matchedRows = importRows.filter((r) => r.studentId && r.marksValid);
  const unmatchedRows = importRows.filter((r) => !r.studentId);
  const invalidMarksRows = importRows.filter((r) => r.studentId && !r.marksValid);

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
          remarks: row.remarksRaw || null,
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
    setImportSummary({ ok, failed, total: matchedRows.length });
  }

  return (
    <div className="p-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Upload Results</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload student results from an Excel/CSV file — choose the Class, Stream, Subject and Exam the
          file applies to first.
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === 'bulk' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Bulk Upload (Excel)
        </button>
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === 'single' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Single Student Entry
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Class *</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={loadingLookups}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          >
            <option value="">-- Select Class --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Stream</label>
          <select
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            disabled={!classId || streamsForSelectedClass.length === 0}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">All Streams</option>
            {streamsForSelectedClass.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        {mode === 'bulk' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Subject *</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={loadingLookups}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            >
              <option value="">-- Select Subject --</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Exam *</label>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            disabled={loadingLookups}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
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

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {mode === 'bulk' && !readyToUpload && !error && (
        <p className="mt-6 text-sm text-slate-500">
          Select a Class, Subject and Exam above to enable the upload (Stream is optional).
        </p>
      )}

      {mode === 'single' && !singleReady && !error && (
        <p className="mt-6 text-sm text-slate-500">
          Select a Class and Exam above, then pick a student below (Stream is optional).
        </p>
      )}

      {readyToUpload && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UploadCloud size={18} className="text-teal-600" />
            <h3 className="text-sm font-semibold text-slate-900">Upload results from Excel</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Upload an .xlsx, .xls or .csv file with columns for <span className="font-medium">Admission Number</span>{' '}
            and <span className="font-medium">Marks</span> (a <span className="font-medium">Remarks</span> column is
            optional). Results apply to <span className="font-medium">{selectedClass?.name}</span>
            {streamId ? ` · Stream ${streamsForSelectedClass.find((s) => String(s.id) === String(streamId))?.name}` : ''} ·{' '}
            {subjects.find((s) => String(s.id) === String(subjectId))?.name || 'this subject'} ·{' '}
            {selectedExam?.name || 'this exam'}.
          </p>

          {loadingStudents && <p className="mt-3 text-sm text-slate-500">Loading students...</p>}

          {!loadingStudents && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelected}
                  className="block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-500"
                />
                {importFileName && (
                  <button onClick={resetImport} className="text-sm text-slate-500 hover:underline">
                    Clear
                  </button>
                )}
                <span className="text-xs text-slate-400">{students.length} students in this selection</span>
              </div>

              {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}

              {importRows.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span>{importRows.length} rows read from "{importFileName}"</span>
                    <span className="font-medium text-emerald-600">{matchedRows.length} ready to save</span>
                    {unmatchedRows.length > 0 && (
                      <span className="font-medium text-amber-600">{unmatchedRows.length} admission number(s) not found</span>
                    )}
                    {invalidMarksRows.length > 0 && (
                      <span className="font-medium text-red-600">{invalidMarksRows.length} row(s) with invalid marks</span>
                    )}
                  </div>

                  <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Admission No.</th>
                          <th className="px-3 py-2 font-medium">Student</th>
                          <th className="px-3 py-2 font-medium">Marks</th>
                          <th className="px-3 py-2 font-medium">Remarks</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importRows.map((r, idx) => (
                          <tr key={idx} className={!r.studentId || !r.marksValid ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2 text-slate-600">{r.admissionNumber || '—'}</td>
                            <td className="px-3 py-2 text-slate-800">{r.studentName || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{r.marksRaw || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{r.remarksRaw || '—'}</td>
                            <td className="px-3 py-2">
                              {!r.studentId ? (
                                <span className="text-xs font-medium text-amber-600">Admission number not found</span>
                              ) : !r.marksValid ? (
                                <span className="text-xs font-medium text-red-600">Invalid marks</span>
                              ) : (
                                <span className="text-xs font-medium text-emerald-600">Ready</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={saveImportedResults}
                      disabled={importing || matchedRows.length === 0}
                      className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-60"
                    >
                      {importing ? 'Saving...' : `Save ${matchedRows.length} Result(s)`}
                    </button>
                    {importSummary && (
                      <span className="text-sm text-slate-600">
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

      {singleReady && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UploadCloud size={18} className="text-teal-600" />
            <h3 className="text-sm font-semibold text-slate-900">Enter results for one student</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Pick a student from <span className="font-medium">{selectedClass?.name}</span>
            {streamId ? ` · Stream ${streamsForSelectedClass.find((s) => String(s.id) === String(streamId))?.name}` : ''}
            , then enter marks per subject for <span className="font-medium">{selectedExam?.name || 'this exam'}</span>.
          </p>

          {loadingStudents && <p className="mt-3 text-sm text-slate-500">Loading students...</p>}

          {!loadingStudents && (
            <>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Student *</label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">-- Select Student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {studentName(s)} ({s.admission_number})
                    </option>
                  ))}
                </select>
              </div>

              {studentId && (
                <div className="mt-5">
                  {loadingSingle && <p className="text-sm text-slate-500">Loading subjects...</p>}
                  {singleError && <p className="text-sm text-red-600">{singleError}</p>}

                  {!loadingSingle && singleRows.length === 0 && !singleError && (
                    <p className="text-sm text-slate-400">No subjects assigned to this class/stream.</p>
                  )}

                  {!loadingSingle && singleRows.length > 0 && (
                    <>
                      <div className="overflow-hidden rounded-md border border-slate-200">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2 font-medium">Subject</th>
                              <th className="px-3 py-2 font-medium" style={{ width: '140px' }}>
                                Marks {selectedExam?.max_marks ? `(/${selectedExam.max_marks})` : ''}
                              </th>
                              <th className="px-3 py-2 font-medium">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {singleRows.map((row) => (
                              <tr key={row.subjectId}>
                                <td className="px-3 py-2 font-medium text-slate-900">{row.subjectName}</td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max={selectedExam?.max_marks || undefined}
                                    value={row.marks}
                                    onChange={(e) => updateSingleRow(row.subjectId, 'marks', e.target.value)}
                                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal-500"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={row.remarks}
                                    onChange={(e) => updateSingleRow(row.subjectId, 'remarks', e.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal-500"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={saveSingleStudentResults}
                          disabled={savingSingle}
                          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-60"
                        >
                          {savingSingle ? 'Saving...' : 'Save Results'}
                        </button>
                        {singleSummary && <span className="text-sm text-slate-600">{singleSummary}</span>}
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
  );
}
