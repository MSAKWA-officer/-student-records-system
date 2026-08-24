import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { classesApi } from '../classes/classesApi';
import { studentsApi } from '../students/studentsApi';
import { exportToExcel } from '../../utils/exportToExcel';

// Reports for a single class, e.g. Form 1, Form 2, etc. When no :classId is
// present in the URL this shows the class picker (the "All Classes" view
// reached from the Reports nav item); when a :classId is present (reached
// via Reports > Form 1, Form 2, ... in the sidebar) that class is
// pre-selected and locked, with a breadcrumb back to the class picker.
export default function ReportsList() {
  const { classId: routeClassId } = useParams();
  const location = useLocation();

  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState('');

  const [classId, setClassId] = useState(routeClassId || '');
  const [streamId, setStreamId] = useState('');
  const [search, setSearch] = useState('');

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await classesApi.getAll();
        setClasses(res.data);
      } catch (err) {
        setError('Failed to load classes.');
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, []);

  // Keep the selected class in sync with the route (e.g. navigating between
  // Reports > Form 1 and Reports > Form 2 via the sidebar).
  useEffect(() => {
    setClassId(routeClassId || '');
    setStreamId('');
    setSearch('');
  }, [routeClassId]);

  const streamsForSelectedClass = useMemo(() => {
    const cls = classes.find((c) => String(c.id) === String(classId));
    return cls?.Streams || [];
  }, [classes, classId]);

  useEffect(() => {
    if (!classId) {
      setStudents([]);
      return;
    }
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, streamId]);

  async function loadStudents() {
    setLoadingStudents(true);
    setError('');
    try {
      const params = { class_id: classId, limit: 1000 };
      if (streamId) params.stream_id = streamId;
      const res = await studentsApi.getAll(params);
      setStudents(res.data.data || []);
    } catch (err) {
      setError('Failed to load students for this class.');
    } finally {
      setLoadingStudents(false);
    }
  }

  function selectClass(id) {
    setClassId(String(id));
    setStreamId('');
    setSearch('');
  }

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  function studentStream(s) {
    const enrollment = (s.Enrollments || []).find((e) => (streamId ? e.stream_id === Number(streamId) : true));
    return enrollment?.Stream?.name || (s.Enrollments || [])[0]?.Stream?.name || '—';
  }

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        studentName(s).toLowerCase().includes(q) ||
        String(s.admission_number || '').toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, search]);

  const selectedClass = classes.find((c) => String(c.id) === String(classId));

  function handleExportExcel() {
  const data = filteredStudents.map((s) => ({
    'Admission Number': s.admission_number,
    'Student': studentName(s),
    'Stream': studentStream(s),
  }));
  const label = selectedClass?.name || 'Class';
  exportToExcel(data, `${label}-Reports`, 'Reports');
}

  return (
    <div className="p-8">
      {routeClassId && (
        <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
          <Link to="/dashboard/reports" className="hover:underline">Reports</Link>
          <span>/</span>
          <span className="text-slate-700">{selectedClass?.name || '...'}</span>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          {routeClassId ? `${selectedClass?.name || 'Class'} Reports` : 'Reports by Class'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {routeClassId
            ? `Every student in ${selectedClass?.name || 'this class'}, each with a link to their full results report.`
            : 'Choose a class below to see all its students, each with a link to their full results report.'}
        </p>
      </div>

      {loadingClasses && <p className="mt-6 text-sm text-slate-500">Loading classes...</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!routeClassId && !loadingClasses && classes.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => selectClass(c.id)}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                String(classId) === String(c.id)
                  ? 'bg-teal-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {!loadingClasses && classes.length === 0 && (
        <p className="mt-6 text-sm text-slate-400">No classes registered yet.</p>
      )}

      {classId && (
        <div className="mt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Students in {selectedClass?.name}
              {streamId && streamsForSelectedClass.find((s) => String(s.id) === String(streamId))
                ? ` — Stream ${streamsForSelectedClass.find((s) => String(s.id) === String(streamId)).name}`
                : ''}
            </h3>
            <div className="no-print flex flex-wrap gap-3">
              <button
                onClick={handleExportExcel}
                disabled={filteredStudents.length === 0}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Export to Excel
              </button>
              <button
                onClick={() => window.print()}
                disabled={filteredStudents.length === 0}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Print / PDF
              </button>
              <select
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
                disabled={streamsForSelectedClass.length === 0}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">All Streams</option>
                {streamsForSelectedClass.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                placeholder="Search by name or admission number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {loadingStudents && <p className="mt-4 text-sm text-slate-500">Loading students...</p>}

          {!loadingStudents && (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                {filteredStudents.length} students
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Admission Number</th>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Stream</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{s.admission_number}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{studentName(s)}</td>
                      <td className="px-4 py-3 text-slate-600">{studentStream(s)}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/dashboard/students/${s.id}/report-card`}
                          state={{ from: `${location.pathname}${location.search}` }}
                          className="rounded-md border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-600 transition hover:bg-teal-50"
                        >
                          View Full Results Report
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-slate-400">
                        No matching students.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
