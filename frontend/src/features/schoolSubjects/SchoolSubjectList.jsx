import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { schoolSubjectsApi } from './schoolSubjectsApi';
import { useAuth } from '../../context/AuthContext';

// Whole-school subject catalogue — Mathematics, English, etc. registered
// once for the entire school, with no class attached. This is distinct from
// "Class Subjects" (Subject Allocation), which links a subject from this
// list to a specific class/teacher/stream/year.
export default function SchoolSubjectList() {
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher'].includes(user?.role);
  const canDelete = user?.role === 'admin';

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSubjects();
  }, []);

  async function fetchSubjects() {
    setLoading(true);
    setError('');
    try {
      const res = await schoolSubjectsApi.getAll();
      setSubjects(res.data);
    } catch (err) {
      setError('Failed to load subjects.');
    } finally {
      setLoading(false);
    }
  }

  const filteredSubjects = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.trim().toLowerCase();
    return subjects.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q)
    );
  }, [subjects, search]);

  async function handleDelete(subject) {
    if (!window.confirm(`Delete "${subject.name}" from the school subject list? This cannot be undone.`)) return;
    try {
      await schoolSubjectsApi.remove(subject.id);
      fetchSubjects();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          'Failed to delete this subject. It may still be registered to one or more classes.'
      );
    }
  }

  const levelLabels = { primary: 'Primary', secondary: 'Secondary', both: 'Both' };

  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black">School Subjects</h2>
            <p className="mt-1 text-sm text-black">
              Master list of every subject offered by the school, independent of class.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              placeholder="Search subject name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {canEdit && (
              <Link
                to="/dashboard/school-subjects/add"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                + Add Subject
              </Link>
            )}
          </div>
        </div>

        {loading && <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">Loading subjects...</p>}
        {error && <p className="border-b border-slate-100 px-6 py-4 text-sm text-red-600">{error}</p>}

        {!loading && (
          <>
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-2 text-xs text-black">
              {filteredSubjects.length} subject{filteredSubjects.length === 1 ? '' : 's'}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
                  <tr>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Code</th>
                    <th className="px-6 py-3 font-medium">Education Level</th>
                    {(canEdit || canDelete) && <th className="px-6 py-3 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-black">{subject.name}</td>
                      <td className="px-6 py-3 text-black">{subject.code || '—'}</td>
                      <td className="px-6 py-3 text-black">
                        {levelLabels[subject.education_level] || subject.education_level}
                      </td>
                      {(canEdit || canDelete) && (
                        <td className="whitespace-nowrap px-6 py-3">
                          {canEdit && (
                            <Link
                              to={`/dashboard/school-subjects/${subject.id}/edit`}
                              className="text-blue-600 hover:underline"
                            >
                              Edit
                            </Link>
                          )}
                          {canEdit && canDelete && <span className="mx-2 text-slate-300">|</span>}
                          {canDelete && (
                            <button onClick={() => handleDelete(subject)} className="text-red-600 hover:underline">
                              Delete
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredSubjects.length === 0 && (
                    <tr>
                      <td colSpan={(canEdit || canDelete) ? 4 : 3} className="px-6 py-10 text-center text-black">
                        {search
                          ? 'No subjects match your search.'
                          : 'No subjects have been registered for the school yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
