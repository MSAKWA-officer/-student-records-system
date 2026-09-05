import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { teachersApi } from './teachersApi';
import { useAuth } from '../../context/AuthContext';

export default function TeacherList() {
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher'].includes(user?.role);

  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function fetchTeachers() {
    setLoading(true);
    setError('');
    try {
      const res = await teachersApi.getAll({ search });
      setTeachers(res.data);
    } catch (err) {
      setError('Failed to load teachers.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete teacher "${name}"?`)) return;
    try {
      await teachersApi.remove(id);
      setTeachers((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete teacher.');
    }
  }

  return (
    <div className="p-4">
      {/* Everything for the list view — header, search and table — lives in
          one card. The table sits in its own horizontally-scrollable strip
          so the Actions column is always fully reachable, never clipped. */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black">Teachers</h2>
            <p className="mt-1 text-sm text-black">{teachers.length} registered</p>
          </div>
          {canEdit && (
            <Link
              to="/dashboard/teachers/add"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              + Add Teacher
            </Link>
          )}
        </div>

        <div className="border-b border-slate-100 px-6 py-4">
          <input
            placeholder="Search name or staff number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {loading && <p className="px-6 py-4 text-sm text-black">Loading...</p>}
        {error && <p className="px-6 py-4 text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
                <tr>
                  <th className="px-4 py-3 font-medium">Staff Number</th>
                  <th className="px-4 py-3 font-medium">Full Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-black">{t.staff_number}</td>
                    <td className="px-4 py-3 font-medium text-black">{t.full_name}</td>
                    <td className="px-4 py-3 text-black">{t.phone || '—'}</td>
                    <td className="px-4 py-3 text-black">{t.email || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/dashboard/teachers/${t.id}`} className="text-blue-600 hover:underline">
                        View
                      </Link>
                      {canEdit && (
                        <>
                          <span className="mx-2 text-slate-300">|</span>
                          <Link to={`/dashboard/teachers/${t.id}/edit`} className="text-blue-600 hover:underline">
                            Edit
                          </Link>
                          <span className="mx-2 text-slate-300">|</span>
                          <button onClick={() => handleDelete(t.id, t.full_name)} className="text-red-600 hover:underline">
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {teachers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-black">
                      No teachers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
