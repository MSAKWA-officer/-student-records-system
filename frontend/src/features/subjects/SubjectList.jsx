import { useEffect, useMemo, useState } from 'react';
import { subjectsApi } from './Subjectsapi';
import { classesApi } from '../classes/classesApi';
import { classSubjectsApi } from '../classSubjects/classSubjectsApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { useAuth } from '../../context/AuthContext';

const emptySubjectForm = { name: '', code: '', education_level: 'both' };

export default function SubjectList() {
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher'].includes(user?.role);

  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState('');

  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');

  const [assignments, setAssignments] = useState([]); // ClassSubject rows for the selected class/year
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptySubjectForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [classesRes, yearsRes] = await Promise.all([classesApi.getAll(), academicYearsApi.getAll()]);
        setClasses(classesRes.data);
        setYears(yearsRes.data);
      } catch (err) {
        setError('Failed to load classes.');
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, []);

  const currentYear = useMemo(() => years.find((y) => y.is_current), [years]);
  const selectedClass = classes.find((c) => String(c.id) === String(classId));

  useEffect(() => {
    if (!classId || !currentYear) {
      setAssignments([]);
      return;
    }
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, currentYear]);

  async function fetchAssignments() {
    setLoadingAssignments(true);
    setError('');
    try {
      const res = await classSubjectsApi.getAll({
        school_class_id: classId,
        academic_year_id: currentYear.id,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setClassId(String(id));
    setSearch('');
    setShowForm(false);
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function openAddForm() {
    setForm({
      ...emptySubjectForm,
      education_level: selectedClass?.education_level || 'both',
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!currentYear) {
      setFormError('No current academic year is set up yet.');
      return;
    }

    setSaving(true);
    try {
      // Reuse an existing subject with the same name if one exists, otherwise create it.
      const existingRes = await subjectsApi.getAll({ search: form.name.trim() });
      const existing = (existingRes.data || []).find(
        (s) => s.name.trim().toLowerCase() === form.name.trim().toLowerCase()
      );

      let subjectId;
      if (existing) {
        subjectId = existing.id;
      } else {
        const created = await subjectsApi.create(form);
        subjectId = created.data.id;
      }

      await classSubjectsApi.create({
        school_class_id: classId,
        subject_id: subjectId,
        academic_year_id: currentYear.id,
      });

      closeForm();
      fetchAssignments();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to register subject for this class.');
    } finally {
      setSaving(false);
    }
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
      <div>
        <h2 className="text-xl font-semibold text-black">Subjects by Class</h2>
        <p className="mt-1 text-sm text-black">
          Select a class below to register subjects for it and see its subject list.
        </p>
      </div>

      {loadingClasses && <p className="mt-6 text-sm text-black">Loading classes...</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!loadingClasses && !currentYear && (
        <p className="mt-4 text-sm text-amber-600">
          No current academic year is set up yet — please add one before registering subjects.
        </p>
      )}

      {!loadingClasses && classes.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
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
        <p className="mt-6 text-sm text-black">No classes have been registered yet.</p>
      )}

      {classId && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-black">Subjects of {selectedClass?.name}</h3>
            <div className="flex flex-wrap gap-3">
              <input
                placeholder="Search subject name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {canEdit && (
                <button
                  onClick={showForm ? closeForm : openAddForm}
                  disabled={!currentYear}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {showForm ? 'Close' : `+ Add Subject to ${selectedClass?.name}`}
                </button>
              )}
            </div>
          </div>

          {canEdit && showForm && (
            <form
              onSubmit={handleSubmit}
              className="mt-4 max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h4 className="mb-4 text-sm font-semibold text-black">
                New Subject — {selectedClass?.name}
              </h4>
              {formError && (
                <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-black">Subject Name *</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Mathematics"
                    required
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-black">Code</label>
                  <input
                    name="code"
                    value={form.code}
                    onChange={handleFormChange}
                    placeholder="e.g. MATH"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-black">Education Level *</label>
                  <select
                    name="education_level"
                    value={form.education_level}
                    onChange={handleFormChange}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-5 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                {saving ? 'Saving...' : `Save Subject to ${selectedClass?.name}`}
              </button>
            </form>
          )}

          {loadingAssignments && <p className="mt-4 text-sm text-black">Loading subjects...</p>}

          {!loadingAssignments && (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-black">
                {filteredSubjects.length} subjects
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Education Level</th>
                    {canEdit && <th className="px-4 py-3 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubjects.map((entry) => (
                    <tr key={entry.subject.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-black">{entry.subject.name}</td>
                      <td className="px-4 py-3 text-black">{entry.subject.code || '—'}</td>
                      <td className="px-4 py-3 text-black">
                        {levelLabels[entry.subject.education_level] || entry.subject.education_level}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <button onClick={() => handleRemove(entry)} className="text-red-600 hover:underline">
                            Remove from {selectedClass?.name}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredSubjects.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 4 : 3} className="px-4 py-8 text-center text-black">
                        No subjects registered for this class yet.
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
