import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { resultsApi } from './resultsApi';
import { studentsApi } from '../students/studentsApi';
import { examsApi } from '../exams/examsApi';
import { subjectsApi } from '../subjects/Subjectsapi';
import { classesApi } from '../classes/classesApi';

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

export default function ClassResultsPage() {
  const { classId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSubject = searchParams.get('subject') || '';
  const initialExam = searchParams.get('exam') || '';
  const initialStream = searchParams.get('stream') || '';

  const [schoolClass, setSchoolClass] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);

  const [streamId, setStreamId] = useState(initialStream);
  const [subjectId, setSubjectId] = useState(initialSubject);
  const [examId, setExamId] = useState(initialExam);

  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState({});

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [error, setError] = useState('');

  // Excel/CSV import state
  const fileInputRef = useRef(null);
  const [importRows, setImportRows] = useState([]); // parsed + matched preview rows
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [classRes, subjectsRes, examsRes] = await Promise.all([
          classesApi.getById(classId),
          subjectsApi.getAll(),
          examsApi.getAll(),
        ]);
        setSchoolClass(classRes.data);
        setSubjects(subjectsRes.data);
        setExams(examsRes.data);
      } catch (err) {
        setError('Failed to load base data (class/subjects/exams).');
      } finally {
        setLoadingLookups(false);
      }
    })();
  }, [classId]);

  const streams = schoolClass?.Streams || [];

  const selectedExam = useMemo(
    () => exams.find((ex) => String(ex.id) === String(examId)),
    [exams, examId]
  );

  const readyToLoad = subjectId && examId;

  useEffect(() => {
    // keep the URL query string in sync so the link can be shared/reloaded
    const params = {};
    if (subjectId) params.subject = subjectId;
    if (examId) params.exam = examId;
    if (streamId) params.stream = streamId;
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, examId, streamId]);

  useEffect(() => {
    if (!readyToLoad) {
      setStudents([]);
      setRows({});
      return;
    }
    loadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, streamId, subjectId, examId]);

  async function loadGrid() {
    setLoadingGrid(true);
    setError('');
    try {
      const studentParams = { class_id: classId, limit: 1000 };
      if (streamId) studentParams.stream_id = streamId;

      const [studentsRes, resultsRes] = await Promise.all([
        studentsApi.getAll(studentParams),
        resultsApi.getAll({ exam_id: examId, subject_id: subjectId }),
      ]);

      const studentList = studentsRes.data.data || [];
      const resultList = resultsRes.data || [];

      setStudents(studentList);

      const nextRows = {};
      studentList.forEach((s) => {
        const existing = resultList.find((r) => r.student_id === s.id);
        nextRows[s.id] = existing
          ? {
              marks_obtained: String(existing.marks_obtained),
              remarks: existing.remarks || '',
              resultId: existing.id,
              grade: existing.grade,
              saving: false,
              error: '',
            }
          : { marks_obtained: '', remarks: '', resultId: null, grade: null, saving: false, error: '' };
      });
      setRows(nextRows);
    } catch (err) {
      setError('Failed to load students/results for this class.');
    } finally {
      setLoadingGrid(false);
    }
  }

  function updateRow(studentId, field, value) {
    setRows((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  }

  // Saves one student's marks/remarks to the backend and updates local state.
  async function commitResult(studentId, marksValue, remarksValue) {
    const existingRow = rows[studentId] || {};
    const payload = {
      student_id: studentId,
      exam_id: examId,
      subject_id: subjectId,
      marks_obtained: Number(marksValue),
      remarks: remarksValue || null,
    };
    let res;
    if (existingRow.resultId) {
      res = await resultsApi.update(existingRow.resultId, payload);
    } else {
      res = await resultsApi.create(payload);
    }
    setRows((prev) => ({
      ...prev,
      [studentId]: {
        marks_obtained: String(res.data.marks_obtained),
        remarks: res.data.remarks || '',
        resultId: res.data.id,
        grade: res.data.grade,
        saving: false,
        error: '',
      },
    }));
    return res.data;
  }

  async function saveRow(studentId) {
    const row = rows[studentId];
    if (!row || row.marks_obtained === '') {
      updateRow(studentId, 'error', 'Enter marks before saving.');
      return;
    }
    updateRow(studentId, 'saving', true);
    updateRow(studentId, 'error', '');
    try {
      await commitResult(studentId, row.marks_obtained, row.remarks);
    } catch (err) {
      updateRow(studentId, 'saving', false);
      updateRow(studentId, 'error', err.response?.data?.message || 'Failed to save the result.');
    }
  }

  async function deleteRow(studentId, studentName) {
    const row = rows[studentId];
    if (!row?.resultId) return;
    if (!window.confirm(`Are you sure you want to delete the result for "${studentName}"?`)) return;
    try {
      await resultsApi.remove(row.resultId);
      setRows((prev) => ({
        ...prev,
        [studentId]: { marks_obtained: '', remarks: '', resultId: null, grade: null, saving: false, error: '' },
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete the result.');
    }
  }

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  function studentStreamName(s) {
    const enrollment = (s.Enrollments || []).find((e) => (streamId ? e.stream_id === Number(streamId) : true));
    return enrollment?.Stream?.name || (s.Enrollments || [])[0]?.Stream?.name || '—';
  }

  const filledCount = Object.values(rows).filter((r) => r.resultId).length;

  // --- Excel / CSV upload -------------------------------------------------

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

    if (!readyToLoad) {
      setImportError('Select a Subject and an Exam first, then upload the file.');
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
        await commitResult(row.studentId, row.marksRaw, row.remarksRaw);
        ok += 1;
      } catch (err) {
        failed += 1;
      }
    }
    setImporting(false);
    setImportSummary({ ok, failed, total: matchedRows.length });
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/dashboard/results/view" className="hover:underline">Results</Link>
            <span>/</span>
            <span className="text-slate-700">{schoolClass?.name || '...'}</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            {schoolClass?.name || 'Class'} Results
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Record results for this class only, one subject and exam at a time — or upload them from an Excel file.
          </p>
        </div>
        <Link
          to="/dashboard/results/view"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          ← Back to all classes
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Stream</label>
          <select
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            disabled={loadingLookups}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Streams</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Subject *</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={loadingLookups}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Select Subject --</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Exam *</label>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            disabled={loadingLookups}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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

      {!readyToLoad && !error && (
        <p className="mt-6 text-sm text-slate-500">
          Select a Subject and an Exam above to see this class's students and record their results.
        </p>
      )}

      {readyToLoad && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Upload results from Excel</h3>
          <p className="mt-1 text-xs text-slate-500">
            Upload an .xlsx, .xls or .csv file from your computer with columns for{' '}
            <span className="font-medium">Admission Number</span> and{' '}
            <span className="font-medium">Marks</span> (a <span className="font-medium">Remarks</span> column is
            optional). Results apply to <span className="font-medium">{schoolClass?.name}</span> ·{' '}
            {subjects.find((s) => String(s.id) === String(subjectId))?.name || 'this subject'} ·{' '}
            {selectedExam?.name || 'this exam'}.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelected}
              className="block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500"
            />
            {importFileName && (
              <button onClick={resetImport} className="text-sm text-slate-500 hover:underline">
                Clear
              </button>
            )}
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
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
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
        </div>
      )}

      {readyToLoad && loadingGrid && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      {readyToLoad && !loadingGrid && (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            <span>
              {students.length} students · {filledCount} results recorded
              {selectedExam ? ` · Max marks: ${selectedExam.max_marks}` : ''}
            </span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Admission No.</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Stream</th>
                <th className="px-4 py-3 font-medium">Marks</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium">Remarks</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => {
                const row = rows[s.id] || {};
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{s.admission_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{studentName(s)}</td>
                    <td className="px-4 py-3 text-slate-600">{studentStreamName(s)}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={selectedExam?.max_marks || 100}
                        value={row.marks_obtained}
                        onChange={(e) => updateRow(s.id, 'marks_obtained', e.target.value)}
                        className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      {row.error && <p className="mt-1 text-xs text-red-600">{row.error}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                        {row.grade || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={row.remarks}
                        onChange={(e) => updateRow(s.id, 'remarks', e.target.value)}
                        placeholder="e.g. Making good progress"
                        className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => saveRow(s.id)}
                          disabled={row.saving}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                        >
                          {row.saving ? 'Saving...' : 'Save'}
                        </button>
                        {row.resultId && (
                          <button
                            onClick={() => deleteRow(s.id, studentName(s))}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        )}
                        <Link
                          to={`/dashboard/students/${s.id}/report-card`}
                          className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                        >
                          Report
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                    No students in this class/stream.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
