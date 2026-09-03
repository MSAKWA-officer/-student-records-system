import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { resultsApi } from './resultsApi';
import { studentsApi } from '../students/studentsApi';
import { examsApi } from '../exams/examsApi';
import { subjectsApi } from '../subjects/Subjectsapi';
import { classesApi } from '../classes/classesApi';
import { useAuth } from '../../context/AuthContext';

export default function ResultList() {
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher', 'teacher'].includes(user?.role);

  // Lookup data
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);

  // Filters: Class -> Stream -> Subject -> Exam
  // Class and Stream are optional: leaving Class as "All Classes" loads every
  // student and groups the results table by class (Form 1, Form 2, etc.).
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examId, setExamId] = useState('');

  // Data to populate the grid
  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]); // Result records for the selected subject+exam
  const [rows, setRows] = useState({}); // studentId -> { marks_obtained, remarks, resultId, grade, saving, error }

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [error, setError] = useState('');

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

  const streamsForSelectedClass = useMemo(() => {
    const cls = classes.find((c) => String(c.id) === String(classId));
    return cls?.Streams || [];
  }, [classes, classId]);

  const selectedExam = useMemo(
    () => exams.find((ex) => String(ex.id) === String(examId)),
    [exams, examId]
  );

  // Only Subject and Exam are required. Class/Stream are optional filters -
  // leaving Class unset loads all students, grouped by class in the table below.
  const readyToLoad = subjectId && examId;

  useEffect(() => {
    if (!readyToLoad) {
      setStudents([]);
      setResults([]);
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
      const studentParams = { limit: 1000 };
      if (classId) studentParams.class_id = classId;
      if (streamId) studentParams.stream_id = streamId;

      const [studentsRes, resultsRes] = await Promise.all([
        studentsApi.getAll(studentParams),
        resultsApi.getAll({ exam_id: examId, subject_id: subjectId }),
      ]);

      const studentList = studentsRes.data.data || [];
      const resultList = resultsRes.data || [];

      setStudents(studentList);
      setResults(resultList);

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
      setError('Failed to load students/results for this selection.');
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

  async function saveRow(studentId) {
    const row = rows[studentId];
    if (!row || row.marks_obtained === '') {
      updateRow(studentId, 'error', 'Enter marks before saving.');
      return;
    }
    updateRow(studentId, 'saving', true);
    updateRow(studentId, 'error', '');
    try {
      const payload = {
        student_id: studentId,
        exam_id: examId,
        subject_id: subjectId,
        marks_obtained: Number(row.marks_obtained),
        remarks: row.remarks || null,
      };
      let res;
      if (row.resultId) {
        res = await resultsApi.update(row.resultId, payload);
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

  function relevantEnrollment(s) {
    const enrollments = s.Enrollments || [];
    if (streamId) {
      return enrollments.find((e) => e.stream_id === Number(streamId)) || enrollments[0];
    }
    if (classId) {
      return enrollments.find((e) => e.school_class_id === Number(classId)) || enrollments[0];
    }
    return enrollments[0];
  }

  function studentStream(s) {
    return relevantEnrollment(s)?.Stream?.name || '—';
  }

  function studentClassName(s) {
    return relevantEnrollment(s)?.SchoolClass?.name || 'Unassigned class';
  }

  function studentClassId(s) {
    return relevantEnrollment(s)?.SchoolClass?.id ?? relevantEnrollment(s)?.school_class_id ?? null;
  }

  // Group students into their class (Form 1, Form 2, etc.) so the results
  // grid reads class by class, even when "All Classes" is selected. Each
  // group keeps the real class id so we can link to its dedicated page.
  function groupByClass(list) {
    const groups = new Map();
    for (const s of list) {
      const className = studentClassName(s);
      const classIdForStudent = studentClassId(s);
      if (!groups.has(className)) {
        groups.set(className, { classId: classIdForStudent, items: [] });
      }
      groups.get(className).items.push(s);
    }
    return Array.from(groups.entries())
      .map(([className, group]) => ({ className, classId: group.classId, items: group.items }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }

  const groupedStudents = useMemo(() => groupByClass(students), [students, classId, streamId]);

  const filledCount = Object.values(rows).filter((r) => r.resultId).length;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Results</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select a Subject and an Exam to record or view results — grouped by class (Form 1, Form 2, etc.).
            Optionally narrow down by Class and Stream.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Class</label>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setStreamId('');
            }}
            disabled={loadingLookups}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Classes</option>
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
            disabled={!classId}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">All Streams</option>
            {streamsForSelectedClass.map((s) => (
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
          Select a Subject and an Exam above to see the student list, grouped by class, and record their results.
        </p>
      )}

      {readyToLoad && loadingGrid && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      {readyToLoad && !loadingGrid && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            <span>
              {students.length} students · {filledCount} results recorded
              {selectedExam ? ` · Max marks: ${selectedExam.max_marks}` : ''}
            </span>
          </div>

          {groupedStudents.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400 shadow-sm">
              No students found for this selection.
            </div>
          )}

          {groupedStudents.map((group) => (
            <div
              key={group.className}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">{group.className}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500">
                    {group.items.length} {group.items.length === 1 ? 'student' : 'students'}
                  </span>
                  {group.classId && (
                    <Link
                      to={`/dashboard/results/class/${group.classId}?subject=${subjectId}&exam=${examId}${streamId ? `&stream=${streamId}` : ''}`}
                      className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                    >
                      Open {group.className} only
                    </Link>
                  )}
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Admission No.</th>
                    <th className="px-4 py-2 font-medium">Student</th>
                    <th className="px-4 py-2 font-medium">Stream</th>
                    <th className="px-4 py-2 font-medium">Marks</th>
                    <th className="px-4 py-2 font-medium">Grade</th>
                    <th className="px-4 py-2 font-medium">Remarks</th>
                    <th className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.items.map((s) => {
                    const row = rows[s.id] || {};
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">{s.admission_number}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{studentName(s)}</td>
                        <td className="px-4 py-3 text-slate-600">{studentStream(s)}</td>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <input
                              type="number"
                              min="0"
                              max={selectedExam?.max_marks || 100}
                              value={row.marks_obtained}
                              onChange={(e) => updateRow(s.id, 'marks_obtained', e.target.value)}
                              className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-slate-700">{row.marks_obtained || '—'}</span>
                          )}
                          {row.error && <p className="mt-1 text-xs text-red-600">{row.error}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                            {row.grade || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <input
                              value={row.remarks}
                              onChange={(e) => updateRow(s.id, 'remarks', e.target.value)}
                              placeholder="e.g. Making good progress"
                              className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-slate-600">{row.remarks || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {canEdit && (
                              <button
                                onClick={() => saveRow(s.id)}
                                disabled={row.saving}
                                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                              >
                                {row.saving ? 'Saving...' : 'Save'}
                              </button>
                            )}
                            {canEdit && row.resultId && (
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
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
