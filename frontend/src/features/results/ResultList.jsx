import { useEffect, useMemo, useState } from 'react';
import { resultsApi } from './resultsApi';
import { studentsApi } from '../students/studentsApi';
import { examsApi } from '../exams/examsApi';
import { subjectsApi } from '../subjects/Subjectsapi';
import { classesApi } from '../classes/classesApi';
import { useAuth } from '../../context/AuthContext';

// Remarks are no longer typed in manually — they're derived automatically
// from the grade returned by the server after a result is saved.
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
    case 'E':
      return 'Weak';
    case 'F':
      return 'Fail';
    default:
      return '—';
  }
}

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
  const [rows, setRows] = useState({}); // studentId -> { marks_obtained, resultId, grade, saving, error }

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

      const nextRows = {};
      studentList.forEach((s) => {
        const existing = resultList.find((r) => r.student_id === s.id);
        nextRows[s.id] = existing
          ? {
              marks_obtained: String(existing.marks_obtained),
              resultId: existing.id,
              grade: existing.grade,
              saving: false,
              error: '',
            }
          : { marks_obtained: '', resultId: null, grade: null, saving: false, error: '' };
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
        [studentId]: { marks_obtained: '', resultId: null, grade: null, saving: false, error: '' },
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

  // Group students into their class (Form 1, Form 2, etc.) so the results
  // grid reads class by class, even when "All Classes" is selected.
  function groupByClass(list) {
    const groups = new Map();
    for (const s of list) {
      const className = studentClassName(s);
      if (!groups.has(className)) {
        groups.set(className, { items: [] });
      }
      groups.get(className).items.push(s);
    }
    return Array.from(groups.entries())
      .map(([className, group]) => ({ className, items: group.items }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }

  const groupedStudents = useMemo(() => groupByClass(students), [students, classId, streamId]);

  const filledCount = Object.values(rows).filter((r) => r.resultId).length;

  return (
    <div className="p-4">
      {/* Everything — header, filters, status line, and every class group's
          table — lives inside this one card/div with a single background. */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-semibold text-black">Results</h2>
          <p className="mt-1 text-sm text-black">
            Select a Subject and an Exam to record or view results — grouped by class (Form 1, Form 2, etc.).
            Optionally narrow down by Class and Stream.
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-4 border-b border-slate-100 px-6 py-5 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-black">Class</label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setStreamId('');
              }}
              disabled={loadingLookups}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Classes</option>
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
              disabled={!classId}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">All Streams</option>
              {streamsForSelectedClass.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
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

        {!readyToLoad && !error && (
          <p className="px-6 py-6 text-sm text-black">
            Select a Subject and an Exam above to see the student list, grouped by class, and record their results.
          </p>
        )}

        {readyToLoad && loadingGrid && <p className="px-6 py-6 text-sm text-black">Loading...</p>}

        {readyToLoad && !loadingGrid && (
          <>
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-2 text-xs text-black">
              {students.length} students · {filledCount} results recorded
              {selectedExam ? ` · Max marks: ${selectedExam.max_marks}` : ''}
            </div>

            {groupedStudents.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-black">
                No students found for this selection.
              </div>
            )}

            {groupedStudents.map((group, idx) => (
              <div key={group.className} className={idx > 0 ? 'border-t border-slate-200' : ''}>
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
                  <h3 className="text-sm font-semibold text-black">{group.className}</h3>
                  <span className="text-xs font-medium text-black">
                    {group.items.length} {group.items.length === 1 ? 'student' : 'students'}
                  </span>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-black">
                    <tr>
                      <th className="px-6 py-2 font-medium">Admission No.</th>
                      <th className="px-6 py-2 font-medium">Student</th>
                      <th className="px-6 py-2 font-medium">Stream</th>
                      <th className="px-6 py-2 font-medium">Marks</th>
                      <th className="px-6 py-2 font-medium">Grade</th>
                      <th className="px-6 py-2 font-medium">Remarks</th>
                      <th className="px-6 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((s) => {
                      const row = rows[s.id] || {};
                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3 text-black">{s.admission_number}</td>
                          <td className="px-6 py-3 font-medium text-black">{studentName(s)}</td>
                          <td className="px-6 py-3 text-black">{studentStream(s)}</td>
                          <td className="px-6 py-3">
                            {canEdit ? (
                              <input
                                type="number"
                                min="0"
                                max={selectedExam?.max_marks || 100}
                                value={row.marks_obtained}
                                onChange={(e) => updateRow(s.id, 'marks_obtained', e.target.value)}
                                className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-black">{row.marks_obtained || '—'}</span>
                            )}
                            {row.error && <p className="mt-1 text-xs text-red-600">{row.error}</p>}
                          </td>
                          <td className="px-6 py-3">
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                              {row.grade || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-black">{autoRemark(row.grade)}</td>
                          <td className="px-6 py-3">
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
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
