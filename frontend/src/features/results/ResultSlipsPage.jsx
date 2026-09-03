import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import { studentsApi } from '../students/studentsApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { termsApi } from '../terms/termsApi';
import { examsApi } from '../exams/examsApi';
import { resultsApi } from './resultsApi';

export default function ResultSlipsPage() {
  const location = useLocation();
  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [exams, setExams] = useState([]);

  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [examId, setExamId] = useState('');

  const [students, setStudents] = useState([]);
  const [resultsByStudent, setResultsByStudent] = useState({}); // studentId -> count of recorded subjects
  const [openClasses, setOpenClasses] = useState({});

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [error, setError] = useState('');

  // Academic years, defaulting to the current one
  useEffect(() => {
    academicYearsApi
      .getAll()
      .then((res) => {
        setYears(res.data);
        const current = res.data.find((y) => y.is_current) || res.data[0];
        if (current) setAcademicYearId(String(current.id));
      })
      .catch(() => setError('Failed to load academic years.'))
      .finally(() => setLoadingLookups(false));
  }, []);

  // Terms for the selected year
  useEffect(() => {
    if (!academicYearId) return;
    termsApi.getAll({ academic_year_id: academicYearId }).then((res) => {
      setTerms(res.data);
      const current = res.data.find((t) => t.is_current) || res.data[0];
      setTermId(current ? String(current.id) : '');
    });
  }, [academicYearId]);

  // Exams for the selected term
  useEffect(() => {
    if (!termId) {
      setExams([]);
      setExamId('');
      return;
    }
    examsApi.getAll({ term_id: termId }).then((res) => {
      setExams(res.data);
      setExamId(res.data[0] ? String(res.data[0].id) : '');
    });
  }, [termId]);

  const readyToLoad = Boolean(examId);

  useEffect(() => {
    if (!readyToLoad) {
      setStudents([]);
      setResultsByStudent({});
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function loadData() {
    setLoadingGrid(true);
    setError('');
    try {
      const [studentsRes, resultsRes] = await Promise.all([
        studentsApi.getAll({ limit: 2000 }),
        resultsApi.getAll({ exam_id: examId }),
      ]);
      setStudents(studentsRes.data.data || []);

      const counts = {};
      (resultsRes.data || []).forEach((r) => {
        counts[r.student_id] = (counts[r.student_id] || 0) + 1;
      });
      setResultsByStudent(counts);
    } catch (err) {
      setError('Failed to load students/results for this exam.');
    } finally {
      setLoadingGrid(false);
    }
  }

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  function studentClass(s) {
    const enrollment = (s.Enrollments || [])[0];
    return {
      name: enrollment?.SchoolClass?.name || 'Unassigned Class',
      stream: enrollment?.Stream?.name || null,
    };
  }

  // Group students by their class (Form 1, Form 2, etc.) so the slips are
  // organised exactly the way they'd be handed out — class by class.
  const groupedByClass = useMemo(() => {
    const groups = new Map();
    for (const s of students) {
      const { name } = studentClass(s);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(s);
    }
    return Array.from(groups.entries())
      .map(([className, items]) => ({
        className,
        items: items.sort((a, b) => studentName(a).localeCompare(studentName(b))),
      }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }, [students]);

  function toggleClass(className) {
    setOpenClasses((prev) => ({ ...prev, [className]: !prev[className] }));
  }

  function slipLink(studentId) {
    const params = new URLSearchParams();
    if (academicYearId) params.set('year', academicYearId);
    if (termId) params.set('term', termId);
    if (examId) params.set('exam', examId);
    return `/dashboard/students/${studentId}/result-slip?${params.toString()}`;
  }

  const totalWithResults = Object.keys(resultsByStudent).length;

  return (
    <div className="p-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Result Slips</h2>
        <p className="mt-1 text-sm text-slate-500">
          Browse every student's official exam result slip, organized class by class. Choose an Academic
          Year, Term and Exam below, then open or print any student's slip.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Academic Year</label>
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            disabled={loadingLookups}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.year_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Term</label>
          <select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            disabled={!academicYearId}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {terms.length === 0 && <option value="">No terms</option>}
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Exam *</label>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            disabled={!termId}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {exams.length === 0 && <option value="">No exams</option>}
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!readyToLoad && !error && (
        <p className="mt-6 text-sm text-slate-500">
          Select an Exam above to see every student's result slip, grouped by class.
        </p>
      )}

      {readyToLoad && loadingGrid && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      {readyToLoad && !loadingGrid && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            <span>
              {students.length} students · {totalWithResults} with recorded results for this exam
            </span>
          </div>

          {groupedByClass.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400 shadow-sm">
              No students found.
            </div>
          )}

          {groupedByClass.map((group) => {
            const open = openClasses[group.className] !== false; // default open
            return (
              <div key={group.className} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <button
                  onClick={() => toggleClass(group.className)}
                  className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    {group.className}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {group.items.length} {group.items.length === 1 ? 'student' : 'students'}
                  </span>
                </button>

                {open && (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Admission No.</th>
                        <th className="px-4 py-2 font-medium">Student</th>
                        <th className="px-4 py-2 font-medium">Stream</th>
                        <th className="px-4 py-2 font-medium">Results Recorded</th>
                        <th className="px-4 py-2 font-medium">Slip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((s) => {
                        const { stream } = studentClass(s);
                        const count = resultsByStudent[s.id] || 0;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600">{s.admission_number}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{studentName(s)}</td>
                            <td className="px-4 py-3 text-slate-600">{stream || '—'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-medium ${
                                  count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {count} subject{count === 1 ? '' : 's'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Link
                                  to={slipLink(s.id)}
                                  state={{ from: `${location.pathname}${location.search}` }}
                                  className="flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                                >
                                  <FileText size={13} /> View Slip
                                </Link>
                                <Link
                                  to={slipLink(s.id)}
                                  state={{ from: `${location.pathname}${location.search}` }}
                                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
                                  title="Open then print from the slip page"
                                >
                                  <Printer size={13} /> Print
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
