import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { subjectsApi } from './Subjectsapi';
import { classesApi } from '../classes/classesApi';
import { classSubjectsApi } from '../classSubjects/classSubjectsApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { useAuth } from '../../context/AuthContext';

export default function SubjectList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // admin/headteacher may add & assign subjects; only admin may remove one
  // from a class (this mirrors authorize('admin','headteacher') vs
  // authorize('admin') on the backend routes).
  const canEdit = ['admin', 'headteacher'].includes(user?.role);
  const canRemove = user?.role === 'admin';

  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState('');

  // Keep the selected class in the URL (?classId=) so a redirect back from
  // "Add Subject" or "Edit" lands on the same class instead of resetting.
  const classId = searchParams.get('classId') || '';
  const [yearId, setYearId] = useState('');
  const [search, setSearch] = useState('');

  const [assignments, setAssignments] = useState([]); // ClassSubject rows for the selected class/year
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [classesRes, yearsRes] = await Promise.all([classesApi.getAll(), academicYearsApi.getAll()]);
        setClasses(classesRes.data);
        setYears(yearsRes.data);

        // Default to the year marked "current". If none is marked current
        // (a common setup gap), fall back to the most recent year instead
        // of leaving nothing selected — that was the reason "+ Add Subject"
        // used to look broken: it was silently disabled with no explanation.
        const current = yearsRes.data.find((y) => y.is_current);
        setYearId(String((current || yearsRes.data[0])?.id || ''));
      } catch (err) {
        setError('Failed to load classes.');
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, []);

  const selectedClass = classes.find((c) => String(c.id) === String(classId));
  const selectedYear = years.find((y) => String(y.id) === String(yearId));

  useEffect(() => {
    if (!classId || !yearId) {
      setAssignments([]);
      return;
    }
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, yearId]);

  async function fetchAssignments() {
    setLoadingAssignments(true);
    setError('');
    try {
      const res = await classSubjectsApi.getAll({
        school_class_id: classId,
        academic_year_id: yearId,
      });
      setAssignments(res.data);
    } catch (err) {
      setError('Failed to load subjects for this class.');
    } finally {
      setLoadingAssignments(false);
    }
  }

  // Unique subjects for this class (a subject can have multiple rows, one per stream)
  const subjectsForClass = useMemo(() => {
    const bySubject = new Map();
    assignments.forEach((a) => {
      if (!a.Subject) return;
      if (!bySubject.has(a.subject_id)) {
        bySubject.set(a.subject_id, { subject: a.Subject, rowIds: [a.id] });
      } else {
        bySubject.get(a.subject_id).rowIds.push(a.id);
      }
    });
    return Array.from(bySubject.values());
  }, [assignments]);

  const filteredSubjects = useMemo(() => {
    if (!search.trim()) return subjectsForClass;
    const q = search.trim().toLowerCase();
    return subjectsForClass.filter(
      ({ subject }) =>
        subject.name.toLowerCase().includes(q) || (subject.code || '').toLowerCase().includes(q)
    );
  }, [subjectsForClass, search]);

  function selectClass(id) {
    setSearchParams(id ? { classId: id } : {});
    setSearch('');
  }

  function goToAdd() {
    navigate('/dashboard/subjects/add', {
      state: {
        classId,
        className: selectedClass?.name,
        academicYearId: yearId,
        educationLevel: selectedClass?.education_level,
      },
    });
  }

  async function handleRemove(entry) {
    if (!window.confirm(`Remove "${entry.subject.name}" from ${selectedClass?.name}?`)) return;
    try {
      await Promise.all(entry.rowIds.map((id) => classSubjectsApi.remove(id)));
      fetchAssignments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove subject from this class.');
    }
  }

  const levelLabels = { primary: 'Primary', secondary: 'Secondary', both: 'Both' };

  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black">Subjects by Class</h2>
            <p className="mt-1 text-sm text-black">
              Select a class below to register subjects for it and see its subject list.
            </p>
          </div>

          {/* Academic year picker — always visible and always has a value as
              long as at least one year exists, so the "Add Subject" button
              is never stuck disabled just because nobody flagged a year as
              "current" yet. */}
          {years.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-black">Academic Year</label>
              <select
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.year_name}
                    {y.is_current ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loadingClasses && <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">Loading classes...</p>}
        {error && <p className="border-b border-slate-100 px-6 py-4 text-sm text-red-600">{error}</p>}
        {!loadingClasses && years.length === 0 && (
          <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">
            No academic year is set up yet —{' '}
            <Link to="/dashboard/academic-years" className="text-blue-600 hover:underline">
              add one first
            </Link>{' '}
            before registering subjects.
          </p>
        )}

        {/* Class picker */}
        {!loadingClasses && classes.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-5">
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => selectClass(c.id)}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  String(classId) === String(c.id)
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 bg-white text-black hover:bg-slate-50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {!loadingClasses && classes.length === 0 && (
          <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">No classes have been registered yet.</p>
        )}

        {classId && (
          <>
            {/* Selected class toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-black">Subjects of {selectedClass?.name}</h3>
              <div className="flex flex-wrap gap-3">
                <input
                  placeholder="Search subject name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {canEdit && (
                  <button
                    onClick={goToAdd}
                    disabled={!yearId}
                    title={!yearId ? 'Add an academic year first' : undefined}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                  >
                    + Add Subject to {selectedClass?.name}
                  </button>
                )}
              </div>
            </div>

            {loadingAssignments && (
              <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">Loading subjects...</p>
            )}

            {/* Table */}
            {!loadingAssignments && (
              <>
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-2 text-xs text-black">
                  {filteredSubjects.length} subjects
                  {selectedYear ? ` · ${selectedYear.year_name}` : ''}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
                      <tr>
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">Code</th>
                        <th className="px-6 py-3 font-medium">Education Level</th>
                        {(canEdit || canRemove) && <th className="px-6 py-3 font-medium">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSubjects.map((entry) => (
                        <tr key={entry.subject.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3 font-medium text-black">{entry.subject.name}</td>
                          <td className="px-6 py-3 text-black">{entry.subject.code || '—'}</td>
                          <td className="px-6 py-3 text-black">
                            {levelLabels[entry.subject.education_level] || entry.subject.education_level}
                          </td>
                          {(canEdit || canRemove) && (
                            <td className="whitespace-nowrap px-6 py-3">
                              {canEdit && (
                                <Link
                                  to={`/dashboard/subjects/${entry.subject.id}/edit?classId=${classId}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  Edit
                                </Link>
                              )}
                              {canEdit && canRemove && <span className="mx-2 text-slate-300">|</span>}
                              {canRemove && (
                                <button onClick={() => handleRemove(entry)} className="text-red-600 hover:underline">
                                  Remove
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                      {filteredSubjects.length === 0 && (
                        <tr>
                          <td colSpan={(canEdit || canRemove) ? 4 : 3} className="px-6 py-10 text-center text-black">
                            No subjects registered for this class yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
