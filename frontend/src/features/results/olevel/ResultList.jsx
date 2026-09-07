import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2, GraduationCap } from 'lucide-react';
import { resultsApi } from '../resultsApi';
import { studentsApi } from '../../students/studentsApi';
import { examsApi } from '../../exams/examsApi';
import { classSubjectsApi } from '../../classSubjects/classSubjectsApi';
import { classesApi } from '../../classes/classesApi';
import { subjectsApi } from '../../subjects/Subjectsapi';
import { useAuth } from '../../../context/AuthContext';
import { filterOLevelClasses, autoRemark, studentFullName } from './oLevelResultHelpers';

// O-Level Results — browse/view page for Form 1-4 results only.
// Creating/uploading new results now lives on its own page (ResultCreate),
// reached via the "Upload Result" button at the top-right of this page.
export default function ResultList() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const canEdit = ['admin', 'headteacher', 'teacher'].includes(user?.role);
  const canDelete = user?.role === 'admin';

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);

  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examId, setExamId] = useState('');

  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [error, setError] = useState('');

  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Load Classes (O-Level only) and Exams once.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subjects shown in the dropdown always reflect what's actually allocated
  // in the system for the current selection:
  //  - No class chosen yet -> every subject a teacher teaches (or, for
  //    admin/headteacher, the full subject catalogue) so browsing can start
  //    from any subject.
  //  - A class is chosen -> only the subjects allocated to THAT class.
  //  - A stream is also chosen -> only subjects allocated to that stream,
  //    plus any allocation that covers the whole class (stream_id = null).
  // If the previously selected subject no longer belongs to the new list,
  // it's cleared so the results grid never shows a stale subject.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSubjects(true);
      try {
        let list;
        if (classId) {
          const params = { school_class_id: classId };
          if (isTeacher) params.teacher_id = user.teacher_id;
          const csRes = await classSubjectsApi.getAll(params);
          const relevant = streamId
            ? csRes.data.filter((cs) => cs.stream_id === null || String(cs.stream_id) === String(streamId))
            : csRes.data;
          list = Array.from(new Map(relevant.map((cs) => [cs.subject_id, cs.Subject])).values()).filter(Boolean);
        } else if (isTeacher) {
          const csRes = await classSubjectsApi.getAll({ teacher_id: user.teacher_id });
          list = Array.from(new Map(csRes.data.map((cs) => [cs.subject_id, cs.Subject])).values()).filter(Boolean);
        } else {
          const subjectsRes = await subjectsApi.getAll();
          list = subjectsRes.data;
        }
        if (cancelled) return;
        list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
        setSubjects(list);
        if (subjectId && !list.some((s) => String(s.id) === String(subjectId))) {
          setSubjectId('');
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load subjects for this selection.');
      } finally {
        if (!cancelled) setLoadingSubjects(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, streamId, isTeacher]);

  const streamsForSelectedClass = useMemo(() => {
    const cls = classes.find((c) => String(c.id) === String(classId));
    return cls?.Streams || [];
  }, [classes, classId]);

  const selectedExam = useMemo(() => exams.find((ex) => String(ex.id) === String(examId)), [exams, examId]);

  const readyToLoad = subjectId && examId;

  useEffect(() => {
    if (!readyToLoad) {
      setStudents([]);
      setResults([]);
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
      // Only students actually registered (enrolled) for this subject are
      // shown — not every student in a class takes every subject.
      if (subjectId) studentParams.subject_id = subjectId;
      if (selectedExam?.Term?.academic_year_id) studentParams.academic_year_id = selectedExam.Term.academic_year_id;

      const resultParams = { exam_id: examId, subject_id: subjectId };
      if (classId) resultParams.school_class_id = classId;
      if (streamId) resultParams.stream_id = streamId;

      const [studentsRes, resultsRes] = await Promise.all([
        studentsApi.getAll(studentParams),
        resultsApi.getAll(resultParams),
      ]);

      setStudents(studentsRes.data.data || []);
      setResults(resultsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load results for this selection.');
      setResults([]);
    } finally {
      setLoadingGrid(false);
    }
  }

  async function handleDelete(resultId, name) {
    if (!window.confirm(`Are you sure you want to delete the result for "${name}"? This cannot be undone.`)) return;
    try {
      await resultsApi.remove(resultId);
      setResults((prev) => prev.filter((r) => r.id !== resultId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete this result.');
    }
  }

  function relevantEnrollment(s) {
    const enrollments = s.Enrollments || [];
    if (streamId) return enrollments.find((e) => e.stream_id === Number(streamId)) || enrollments[0];
    if (classId) return enrollments.find((e) => e.school_class_id === Number(classId)) || enrollments[0];
    return enrollments[0];
  }

  function studentClassName(s) {
    return relevantEnrollment(s)?.SchoolClass?.name || 'Unassigned class';
  }

  function studentStream(s) {
    return relevantEnrollment(s)?.Stream?.name || '—';
  }

  // Combine the O-Level class roster with whatever result (if any) each
  // student has for the chosen subject/exam, grouped by class.
  const rowsByClass = useMemo(() => {
    const resultByStudent = new Map(results.map((r) => [r.student_id, r]));
    const groups = new Map();
    for (const s of students) {
      const className = studentClassName(s);
      if (!groups.has(className)) groups.set(className, []);
      groups.get(className).push({ student: s, result: resultByStudent.get(s.id) || null });
    }
    return Array.from(groups.entries())
      .map(([className, items]) => ({ className, items }))
      .sort((a, b) => a.className.localeCompare(b.className));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, results, classId, streamId]);

  const recordedCount = results.length;

  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <GraduationCap size={18} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-black">O-Level Results</h2>
              <p className="mt-1 text-sm text-black">
                Form 1 - Form 4 results only. Select a Subject and an Exam to view results, grouped by class.
              </p>
            </div>
          </div>
          {canEdit && (
            <Link
              to="/dashboard/results/o-level/create"
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              <Plus size={16} /> Upload Result
            </Link>
          )}
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
              <option value="">All O-Level Classes</option>
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
              disabled={loadingLookups || loadingSubjects}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select Subject --</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
            {loadingSubjects ? (
              <p className="mt-1 text-xs text-black">Loading subjects...</p>
            ) : classId ? (
              <p className="mt-1 text-xs text-black">
                Only subjects allocated to {classes.find((c) => String(c.id) === String(classId))?.name || 'this class'}
                {streamId ? ' and this stream' : ''} are shown.
              </p>
            ) : (
              <p className="mt-1 text-xs text-black">Select a class to narrow this list to its own subjects.</p>
            )}
            {isTeacher && (
              <p className="mt-1 text-xs text-black">Only subjects allocated to you are shown.</p>
            )}
            {subjectId && (
              <p className="mt-1 text-xs text-black">Only students registered for this subject are listed below.</p>
            )}
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
            Select a Subject and an Exam above to see O-Level results, grouped by class.
          </p>
        )}

        {readyToLoad && loadingGrid && <p className="px-6 py-6 text-sm text-black">Loading...</p>}

        {readyToLoad && !loadingGrid && (
          <>
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-2 text-xs text-black">
              {students.length} students · {recordedCount} results recorded
              {selectedExam ? ` · Max marks: ${selectedExam.max_marks}` : ''}
            </div>

            {rowsByClass.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-black">No students found for this selection.</div>
            )}

            {rowsByClass.map((group, idx) => (
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
                    {group.items.map(({ student: s, result: r }) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-black">{s.admission_number}</td>
                        <td className="px-6 py-3 font-medium text-black">{studentFullName(s)}</td>
                        <td className="px-6 py-3 text-black">{studentStream(s)}</td>
                        <td className="px-6 py-3 text-black">{r ? r.marks_obtained : '—'}</td>
                        <td className="px-6 py-3">
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                            {r?.grade || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-black">{autoRemark(r?.grade)}</td>
                        <td className="px-6 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            {r ? (
                              <>
                                <Link
                                  to={`/dashboard/results/o-level/${r.id}`}
                                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                                >
                                  <Eye size={14} /> View
                                </Link>
                                {canEdit && (
                                  <Link
                                    to={`/dashboard/results/o-level/${r.id}/edit`}
                                    className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:underline"
                                  >
                                    <Pencil size={14} /> Edit
                                  </Link>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => handleDelete(r.id, studentFullName(s))}
                                    className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                )}
                              </>
                            ) : (
                              canEdit && (
                                <Link
                                  to={`/dashboard/results/o-level/create?class_id=${classId}&stream_id=${streamId}&subject_id=${subjectId}&exam_id=${examId}&student_id=${s.id}`}
                                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                                >
                                  <Plus size={14} /> Add
                                </Link>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
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
