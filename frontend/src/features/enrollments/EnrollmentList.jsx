import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { UsersRound, Plus, Eye } from 'lucide-react';
import { enrollmentsApi } from './enrollmentsApi';
import { classesApi } from '../classes/classesApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';

export default function EnrollmentList() {
  const { classId: routeClassId } = useParams();

  const [enrollments, setEnrollments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // When reached via a class-specific link (Class Enrollments > Form 1,
  // Form 2, ...) the class filter is pre-set and locked.
  const [filterYear, setFilterYear] = useState('');
  const [filterClass, setFilterClass] = useState(routeClassId || '');

  useEffect(() => {
    fetchLookups();
  }, []);

  // Keep the class filter in sync with the route (e.g. navigating between
  // Class Enrollments > Form 1 and Form 2 via the sidebar).
  useEffect(() => {
    setFilterClass(routeClassId || '');
  }, [routeClassId]);

  useEffect(() => {
    fetchEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear, filterClass]);

  const selectedClass = classes.find((c) => String(c.id) === String(routeClassId));

  async function fetchLookups() {
    try {
      const [classesRes, yearsRes] = await Promise.all([classesApi.getAll(), academicYearsApi.getAll()]);
      setClasses(classesRes.data);
      setAcademicYears(yearsRes.data);
    } catch (err) {
      // no special handling, filters will just show up empty
    }
  }

  async function fetchEnrollments() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterYear) params.academic_year_id = filterYear;
      if (filterClass) params.school_class_id = filterClass;
      const res = await enrollmentsApi.getAll(Object.keys(params).length ? params : undefined);
      setEnrollments(res.data);
    } catch (err) {
      setError('Failed to load class enrollments.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, studentName) {
    if (!window.confirm(`Are you sure you want to delete the enrollment for "${studentName}"?`)) return;
    try {
      await enrollmentsApi.remove(id);
      setEnrollments((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete the enrollment.');
    }
  }

  function studentName(s) {
    if (!s) return '';
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  return (
    <div className="p-4">
      {/* Everything for this page — breadcrumb, header, filters, and the
          table — lives inside one card instead of separate boxes. */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Breadcrumb (only when reached via a class-specific link) */}
        {routeClassId && (
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 pt-4 text-sm text-black">
            <Link to="/dashboard/enrollments" className="hover:underline">Class Enrollments</Link>
            <span>/</span>
            <span className="pb-4 text-black">{selectedClass?.name || '...'}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black">
              {routeClassId ? `${selectedClass?.name || 'Class'} Enrollments` : 'Class Enrollments'}
            </h2>
            <p className="mt-1 text-sm text-black">{enrollments.length} registered</p>
          </div>
          <Link
            to="/dashboard/enrollments/create"
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <Plus size={16} /> Enroll Student
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-black">Year:</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.year_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-black">Class:</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              disabled={Boolean(routeClassId)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-black"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {filterClass && (
            <Link
              to={`/dashboard/enrollments/class/${filterClass}`}
              className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
            >
              View this class's students
            </Link>
          )}
        </div>

        {loading && <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">Loading...</p>}
        {error && <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">{error}</p>}

        {/* Table */}
        {!loading && !error && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
              <tr>
                <th className="px-6 py-3 font-medium">Student</th>
                <th className="px-6 py-3 font-medium">Class</th>
                <th className="px-6 py-3 font-medium">Stream</th>
                <th className="px-6 py-3 font-medium">Year</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments.map((en) => (
                <tr key={en.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-black">
                    {en.Student ? studentName(en.Student) : '—'}
                  </td>
                  <td className="px-6 py-3 text-black">
                    {en.SchoolClass ? (
                      <Link
                        to={`/dashboard/enrollments/class/${en.SchoolClass.id}`}
                        className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                        title={`View students enrolled in ${en.SchoolClass.name}`}
                      >
                        {en.SchoolClass.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-3 text-black">{en.Stream?.name || '—'}</td>
                  <td className="px-6 py-3 text-black">{en.AcademicYear?.year_name || '—'}</td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/dashboard/enrollments/${en.id}`}
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                        title="View enrollment"
                      >
                        <Eye size={14} /> View
                      </Link>
                      <span className="text-slate-300">|</span>
                      <Link to={`/dashboard/enrollments/${en.id}/edit`} className="text-blue-600 hover:underline">
                        Edit
                      </Link>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => handleDelete(en.id, en.Student ? studentName(en.Student) : '')}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {enrollments.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-black">
                    <div className="flex flex-col items-center gap-2">
                      <UsersRound size={22} className="text-slate-300" />
                      No enrollments yet.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
