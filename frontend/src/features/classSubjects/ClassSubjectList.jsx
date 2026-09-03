import { useEffect, useState } from 'react';
import { classSubjectsApi } from './classSubjectsApi';
import { classesApi } from '../classes/classesApi';
import { subjectsApi } from '../subjects/Subjectsapi';
import { teachersApi } from '../teachers/teachersApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';

const emptyForm = { school_class_id: '', subject_id: '', teacher_id: '', academic_year_id: '', stream_ids: [] };

export default function ClassSubjectList() {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [years, setYears] = useState([]);

  const [filterClassId, setFilterClassId] = useState('');
  const [filterStreamId, setFilterStreamId] = useState('');
  const [filterYearId, setFilterYearId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [teacherDraft, setTeacherDraft] = useState('');

  // Load dropdown data once
  useEffect(() => {
    (async () => {
      try {
        const [classesRes, subjectsRes, teachersRes, yearsRes] = await Promise.all([
          classesApi.getAll(),
          subjectsApi.getAll(),
          teachersApi.getAll(),
          academicYearsApi.getAll(),
        ]);
        setClasses(classesRes.data);
        setSubjects(subjectsRes.data);
        setTeachers(teachersRes.data);
        setYears(yearsRes.data);

        // Default filter/form to current academic year, if any
        const current = yearsRes.data.find((y) => y.is_current);
        if (current) {
          setFilterYearId(String(current.id));
          setForm((f) => ({ ...f, academic_year_id: String(current.id) }));
        }
      } catch (err) {
        setError('Failed to load base data (classes/subjects/teachers/years).');
      }
    })();
  }, []);

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClassId, filterStreamId, filterYearId]);

  async function fetchAssignments() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterClassId) params.school_class_id = filterClassId;
      if (filterStreamId) params.stream_id = filterStreamId;
      if (filterYearId) params.academic_year_id = filterYearId;
      const res = await classSubjectsApi.getAll(params);
      setAssignments(res.data);
    } catch (err) {
      setError('Failed to load subject allocations.');
    } finally {
      setLoading(false);
    }
  }

  function streamsForClass(classId) {
    const cls = classes.find((c) => String(c.id) === String(classId));
    return cls?.Streams || [];
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    if (name === 'school_class_id') {
      // when the class changes, previously selected streams no longer apply
      setForm((f) => ({ ...f, school_class_id: value, stream_ids: [] }));
      return;
    }
    setForm((f) => ({ ...f, [name]: value }));
  }

  function toggleFormStream(streamId) {
    setForm((f) => {
      const idStr = String(streamId);
      const already = f.stream_ids.map(String).includes(idStr);
      return {
        ...f,
        stream_ids: already
          ? f.stream_ids.filter((id) => String(id) !== idStr)
          : [...f.stream_ids, streamId],
      };
    });
  }

  function openAddForm() {
    setForm({ ...emptyForm, academic_year_id: filterYearId || '', school_class_id: filterClassId || '' });
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
    setSaving(true);
    try {
      await classSubjectsApi.create({
        ...form,
        teacher_id: form.teacher_id || null,
      });
      closeForm();
      fetchAssignments();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save the subject allocation.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to remove this subject allocation?')) return;
    try {
      await classSubjectsApi.remove(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove the subject allocation.');
    }
  }

  function startEditTeacher(assignment) {
    setEditingTeacherId(assignment.id);
    setTeacherDraft(assignment.teacher_id ? String(assignment.teacher_id) : '');
  }

  function cancelEditTeacher() {
    setEditingTeacherId(null);
    setTeacherDraft('');
  }

  async function saveTeacher(id) {
    try {
      const res = await classSubjectsApi.update(id, { teacher_id: teacherDraft || null });
      setAssignments((prev) => prev.map((a) => (a.id === id ? res.data : a)));
      cancelEditTeacher();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change the teacher.');
    }
  }

  // Group assignments by class so each class shows its own list of
  // teacher + subject rows (a teacher can legitimately repeat across
  // several subjects/streams within the same class).
  function groupByClass(list) {
    const groups = new Map();
    for (const a of list) {
      const classId = a.SchoolClass?.id ?? a.school_class_id ?? 'unknown';
      const className = a.SchoolClass?.name || 'Unassigned class';
      if (!groups.has(classId)) {
        groups.set(classId, { className, items: [] });
      }
      groups.get(classId).items.push(a);
    }
    // Sort classes by name for a stable, predictable order
    return Array.from(groups.values()).sort((a, b) => a.className.localeCompare(b.className));
  }

  const groupedAssignments = groupByClass(assignments);

  return (
    <div className="p-4">
      {/* Everything for this page — header, filters, add-allocation form,
          and the grouped tables — lives inside one card instead of separate boxes. */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black">Subject Allocation</h2>
            <p className="mt-1 text-sm text-black">
              Link a Teacher, Subject, Class and Stream for an academic year · {assignments.length} found
            </p>
          </div>
          <button
            onClick={showForm ? closeForm : openAddForm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            {showForm ? 'Close' : '+ Add Allocation'}
          </button>
        </div>

        {/* Add allocation form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="border-b border-slate-100 px-6 py-5">
            <h3 className="mb-4 text-sm font-semibold text-black">New Subject Allocation</h3>
            {formError && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-black">{formError}</div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-black">Teacher</label>
                <select
                  name="teacher_id"
                  value={form.teacher_id}
                  onChange={handleFormChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Not assigned yet --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-black">Subject *</label>
                <select
                  name="subject_id"
                  value={form.subject_id}
                  onChange={handleFormChange}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Select Subject --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-black">Class *</label>
                <select
                  name="school_class_id"
                  value={form.school_class_id}
                  onChange={handleFormChange}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Select Class --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-black">Academic Year *</label>
                <select
                  name="academic_year_id"
                  value={form.academic_year_id}
                  onChange={handleFormChange}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Select Year --</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>{y.year_name}{y.is_current ? ' (Current)' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="mb-1 block text-sm font-medium text-black">Stream</label>
                {!form.school_class_id && (
                  <p className="text-xs text-black">Select a class first to see its streams.</p>
                )}
                {form.school_class_id && (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-slate-300 px-3 py-2">
                    {streamsForClass(form.school_class_id).length === 0 && (
                      <span className="text-sm text-black">
                        This class has no streams — the allocation will apply to the whole class.
                      </span>
                    )}
                    {streamsForClass(form.school_class_id).map((s) => (
                      <label key={s.id} className="flex items-center gap-1.5 text-sm text-black">
                        <input
                          type="checkbox"
                          checked={form.stream_ids.map(String).includes(String(s.id))}
                          onChange={() => toggleFormStream(s.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-black">
                  Select one or more streams. If you select none, the allocation will apply to ALL streams of this class.
                </p>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="mt-5 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Allocation'}
            </button>
          </form>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 border-b border-slate-100 px-6 py-4">
          <select
            value={filterClassId}
            onChange={(e) => {
              setFilterClassId(e.target.value);
              setFilterStreamId('');
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterStreamId}
            onChange={(e) => setFilterStreamId(e.target.value)}
            disabled={!filterClassId}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-black"
          >
            <option value="">All Streams</option>
            {streamsForClass(filterClassId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterYearId}
            onChange={(e) => setFilterYearId(e.target.value)}
            className="ml-auto rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.year_name}{y.is_current ? ' (Current)' : ''}</option>
            ))}
          </select>
        </div>

        {loading && <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">Loading...</p>}
        {error && <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">{error}</p>}

        {/* Grouped tables, one per class, all within the same outer card */}
        {!loading && !error && (
          <div className="divide-y divide-slate-100">
            {groupedAssignments.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-black">No subject allocations yet.</div>
            )}

            {groupedAssignments.map((group) => (
              <div key={group.className}>
                <div className="flex items-center justify-between bg-slate-50 px-6 py-3">
                  <h3 className="text-sm font-semibold text-black">{group.className}</h3>
                  <span className="text-xs font-medium text-black">
                    {group.items.length} {group.items.length === 1 ? 'allocation' : 'allocations'}
                  </span>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-black">
                    <tr>
                      <th className="px-6 py-2 font-medium">Teacher</th>
                      <th className="px-6 py-2 font-medium">Subject</th>
                      <th className="px-6 py-2 font-medium">Stream</th>
                      <th className="px-6 py-2 font-medium">Year</th>
                      <th className="px-6 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-black">
                          {editingTeacherId === a.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={teacherDraft}
                                onChange={(e) => setTeacherDraft(e.target.value)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">-- Not assigned yet --</option>
                                {teachers.map((t) => (
                                  <option key={t.id} value={t.id}>{t.full_name}</option>
                                ))}
                              </select>
                              <button onClick={() => saveTeacher(a.id)} className="text-blue-600 hover:underline">
                                Save
                              </button>
                              <button onClick={cancelEditTeacher} className="text-black hover:underline">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            a.Teacher?.full_name || <span className="text-black">Not assigned yet</span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-medium text-black">{a.Subject?.name || '—'}</td>
                        <td className="px-6 py-3 text-black">
                          {a.Stream?.name || <span className="text-black">All Streams</span>}
                        </td>
                        <td className="px-6 py-3 text-black">{a.AcademicYear?.year_name || '—'}</td>
                        <td className="px-6 py-3">
                          {editingTeacherId !== a.id && (
                            <button onClick={() => startEditTeacher(a)} className="text-blue-600 hover:underline">
                              Change Teacher
                            </button>
                          )}
                          <span className="mx-2 text-slate-300">|</span>
                          <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:underline">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
