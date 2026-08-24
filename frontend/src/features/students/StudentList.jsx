import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { studentsApi } from './studentsApi';
import { useAuth } from '../../context/AuthContext';

const PAGE_SIZE = 20;

export default function StudentList() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce the search box so we don't fire a request on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      fetchStudents(1);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  useEffect(() => {
    fetchStudents(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function fetchStudents(targetPage) {
    setLoading(true);
    setError('');
    try {
      const params = { page: targetPage, limit: PAGE_SIZE };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      const res = await studentsApi.getAll(params);
      setStudents(res.data.data || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      setError('Failed to load students.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;
    try {
      await studentsApi.remove(id);
      fetchStudents(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete student.');
    }
  }

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  function studentClassLabel(s) {
    const enrollment = (s.Enrollments || [])[0];
    if (!enrollment) return '—';
    const className = enrollment.SchoolClass?.name;
    const streamName = enrollment.Stream?.name;
    if (!className) return '—';
    return streamName ? `${className} (${streamName})` : className;
  }

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Students</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage every student in the school — add, view, edit, or remove records.
          </p>
        </div>

        {!isTeacher && (
          <Link
            to="/dashboard/students/add"
            className="flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
          >
            <UserPlus size={16} /> Add Student
          </Link>
        )}
      </div>

      {/* Whole-school total, always visible regardless of filters */}
      <div className="mt-5 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Users size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none text-slate-900">{total}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Total Students — Whole School
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or admission number..."
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="graduated">Graduated</option>
          <option value="transferred">Transferred</option>
        </select>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          {loading ? 'Loading...' : `Showing ${students.length} of ${total} students`}
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Admission Number</th>
              <th className="px-4 py-3 font-medium">Full Name</th>
              <th className="px-4 py-3 font-medium">Gender</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading &&
              students.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{s.admission_number}</td>
                  <td className="px-4 py-3">
                    <Link to={`/dashboard/students/${s.id}`} className="font-medium text-slate-900 hover:text-teal-600">
                      {studentName(s)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.gender === 'male' ? 'Male' : 'Female'}</td>
                  <td className="px-4 py-3 text-slate-600">{studentClassLabel(s)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isTeacher ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <>
                        <Link to={`/dashboard/students/${s.id}/edit`} className="text-teal-600 hover:underline">
                          Edit
                        </Link>
                        <span className="mx-2 text-slate-300">|</span>
                        <button onClick={() => handleDelete(s.id, studentName(s))} className="text-red-600 hover:underline">
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            {!loading && students.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-10 text-center text-slate-400">
                  No students found{search || status ? ' for this search/filter.' : ' yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-xs text-slate-500">
              Page {page} of {pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
