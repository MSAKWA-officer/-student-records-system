import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Search, FileText, Printer } from 'lucide-react';
import { studentsApi } from '../students/studentsApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { termsApi } from '../terms/termsApi';
import { examsApi } from '../exams/examsApi';
import { resultsApi } from './resultsApi';
import { classesApi } from '../classes/classesApi';

export default function ClassResultSlipsPage() {
  const { classId } = useParams();
  const location = useLocation();

  const [schoolClass, setSchoolClass] = useState(null);
  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [exams, setExams] = useState([]);

  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [examId, setExamId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [search, setSearch] = useState('');

  const [students, setStudents] = useState([]);
  const [resultsByStudent, setResultsByStudent] = useState({});

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    classesApi.getById(classId).then((res) => setSchoolClass(res.data)).catch(() => {});
  }, [classId]);

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

  useEffect(() => {
    if (!academicYearId) return;
    termsApi.getAll({ academic_year_id: academicYearId }).then((res) => {
      setTerms(res.data);
      const current = res.data.find((t) => t.is_current) || res.data[0];
      setTermId(current ? String(current.id) : '');
    });
  }, [academicYearId]);

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

  const streams = schoolClass?.Streams || [];
  const readyToLoad = Boolean(examId);

  useEffect(() => {
    if (!readyToLoad) {
      setStudents([]);
      setResultsByStudent({});
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, streamId, classId]);

  async function loadData() {
    setLoadingGrid(true);
    setError('');
    try {
      const studentParams = { class_id: classId, limit: 1000 };
      if (streamId) studentParams.stream_id = streamId;

      const [studentsRes, resultsRes] = await Promise.all([
        studentsApi.getAll(studentParams),
        resultsApi.getAll({ exam_id: examId }),
      ]);
      setStudents(studentsRes.data.data || []);

      const counts = {};
      (resultsRes.data || []).forEach((r) => {
        counts[r.student_id] = (counts[r.student_id] || 0) + 1;
      });
      setResultsByStudent(counts);
    } catch (err) {
      setError('Failed to load students/results for this class.');
    } finally {
      setLoadingGrid(false);
    }
  }

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  function studentStreamName(s) {
    return (s.Enrollments || [])[0]?.Stream?.name || '—';
  }

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) => studentName(s).toLowerCase().includes(q) || String(s.admission_number || '').toLowerCase().includes(q)
    );
  }, [students, search]);

  function slipLink(studentId) {
    const params = new URLSearchParams();
    if (academicYearId) params.set('year', academicYearId);
    if (termId) params.set('term', termId);
    if (examId) params.set('exam', examId);
    return `/dashboard/students/${studentId}/result-slip?${params.toString()}`;
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/dashboard/results/slips" className="hover:underline">Result Slips</Link>
        <span>/</span>
        <span className="text-slate-700">{schoolClass?.name || '...'}</span>
      </div>
      <h2 className="mt-1 text-xl font-semibold text-slate-900">{schoolClass?.name || 'Class'} — Result Slips</h2>
      <p className="mt-1 text-sm text-slate-500">
        Browse and print result slips for every student in {schoolClass?.name || 'this class'}.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Academic Year</label>
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            disabled={loadingLookups}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.year_name}</option>
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
              <option key={t.id} value={t.id}>{t.name}</option>
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
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Stream</label>
          <select
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            disabled={streams.length === 0}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">All Streams</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative mt-4 max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or admission number..."
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!readyToLoad && !error && (
        <p className="mt-6 text-sm text-slate-500">Select an Exam above to see this class's result slips.</p>
      )}

      {readyToLoad && loadingGrid && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      {readyToLoad && !loadingGrid && (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            {filteredStudents.length} of {students.length} students
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Admission No.</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Stream</th>
                <th className="px-4 py-3 font-medium">Results Recorded</th>
                <th className="px-4 py-3 font-medium">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((s) => {
                const count = resultsByStudent[s.id] || 0;
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{s.admission_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{studentName(s)}</td>
                    <td className="px-4 py-3 text-slate-600">{studentStreamName(s)}</td>
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
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                    No students found{search ? ' for this search.' : ' in this class/stream.'}
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
