import { useEffect, useState } from 'react';
import { teachersApi } from './teachersApi';
import { subjectsApi } from '../subjects/Subjectsapi';
import { useAuth } from '../../context/AuthContext';

const emptyForm = {
  staff_number: '',
  full_name: '',
  phone: '',
  email: '',
  qualification: '',
  subject_ids: [],
};

export default function TeacherList() {
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher'].includes(user?.role);

  const [teachers, setTeachers] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Creates a login account for an already-registered teacher, linking it
  // to their Teacher record (mirrors the "Student Portal Login" flow).
  const [loginTarget, setLoginTarget] = useState(null); // the teacher object
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [creatingLogin, setCreatingLogin] = useState(false);

  useEffect(() => {
    fetchTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    fetchSubjectOptions();
  }, []);

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

  async function fetchSubjectOptions() {
    try {
      const res = await subjectsApi.getAll();
      setSubjectOptions(res.data);
    } catch (err) {
      // not critical - the checklist will just be empty
    }
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function toggleSubject(subjectId) {
    setForm((f) => {
      const idStr = String(subjectId);
      const already = f.subject_ids.map(String).includes(idStr);
      return {
        ...f,
        subject_ids: already
          ? f.subject_ids.filter((id) => String(id) !== idStr)
          : [...f.subject_ids, subjectId],
      };
    });
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(teacher) {
    setEditingId(teacher.id);
    setForm({
      staff_number: teacher.staff_number || '',
      full_name: teacher.full_name || '',
      phone: teacher.phone || '',
      email: teacher.email || '',
      qualification: teacher.qualification || '',
      subject_ids: (teacher.subjectsExpertise || []).map((s) => s.id),
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }

  function findDuplicatePhone(phone) {
    const trimmed = phone.trim();
    if (!trimmed) return null;
    return teachers.find(
      (t) => t.phone && t.phone.trim() === trimmed && t.id !== editingId
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const duplicate = findDuplicatePhone(form.phone);
    if (duplicate) {
      setFormError(`This phone number is already used by ${duplicate.full_name}.`);
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId) {
        await teachersApi.update(editingId, payload);
      } else {
        await teachersApi.create(payload);
      }
      closeForm();
      fetchTeachers();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save teacher.');
    } finally {
      setSaving(false);
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

  function openCreateLogin(teacher) {
    setLoginTarget(teacher);
    setLoginForm({ email: teacher.email || '', password: '' });
    setLoginError('');
    setLoginSuccess('');
  }

  function closeCreateLogin() {
    setLoginTarget(null);
    setLoginForm({ email: '', password: '' });
    setLoginError('');
    setLoginSuccess('');
  }

  async function handleCreateLogin(e) {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');
    setCreatingLogin(true);
    try {
      const res = await teachersApi.createLogin(loginTarget.id, loginForm);
      setLoginSuccess(`Login account created (${res.data.email}). Share these credentials with the teacher.`);
      setTeachers((prev) => prev.map((t) => (t.id === loginTarget.id ? { ...t, user_id: true } : t)));
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Failed to create the login account.');
    } finally {
      setCreatingLogin(false);
    }
  }

  function subjectNames(teacher) {
    const list = teacher.subjectsExpertise || [];
    if (list.length === 0) return null;
    return list.map((s) => s.name).join(', ');
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Teachers</h2>
          <p className="mt-1 text-sm text-slate-500">{teachers.length} registered</p>
        </div>
        {canEdit && (
          <button
            onClick={showForm ? closeForm : openAddForm}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
          >
            {showForm ? 'Close' : '+ Add Teacher'}
          </button>
        )}
      </div>

      {canEdit && showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            {editingId ? 'Edit Teacher' : 'Add New Teacher'}
          </h3>
          {formError && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Staff Number *</label>
              <input
                name="staff_number"
                value={form.staff_number}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full Name *</label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleFormChange}
                placeholder="Must be unique per teacher"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleFormChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Qualification</label>
              <input
                name="qualification"
                value={form.qualification}
                onChange={handleFormChange}
                placeholder="e.g. Diploma in Education"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Subjects of Expertise
              </label>
              <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-slate-300 px-3 py-2">
                {subjectOptions.length === 0 && (
                  <span className="text-sm text-slate-400">No subjects registered yet.</span>
                )}
                {subjectOptions.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.subject_ids.map(String).includes(String(s.id))}
                      onChange={() => toggleSubject(s.id)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    {s.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Select the subjects this teacher is skilled in or has studied.
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-md bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-60"
          >
            {saving ? 'Saving...' : editingId ? 'Update Teacher' : 'Save Teacher'}
          </button>
        </form>
      )}

      {canEdit && loginTarget && (
        <form
          onSubmit={handleCreateLogin}
          className="mt-5 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm"
        >
          <h3 className="mb-1 text-sm font-semibold text-slate-900">
            Create Login for {loginTarget.full_name}
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            This links a login account to this teacher's existing record, so it isn't a separate,
            disconnected account.
          </p>
          {loginError && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loginError}</div>
          )}
          {loginSuccess && (
            <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{loginSuccess}</div>
          )}
          {!loginSuccess && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Login Email *</label>
                <input
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <button
                type="submit"
                disabled={creatingLogin}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-60"
              >
                {creatingLogin ? 'Creating...' : 'Create Login'}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={closeCreateLogin}
            className="mt-3 text-sm font-medium text-slate-500 hover:underline"
          >
            Close
          </button>
        </form>
      )}

      <input
        placeholder="Search name or staff number..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-6 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
      />

      {loading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Staff Number</th>
                <th className="px-4 py-3 font-medium">Full Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Qualification</th>
                <th className="px-4 py-3 font-medium">Subjects of Expertise</th>
                {canEdit && <th className="px-4 py-3 font-medium">Login</th>}
                {canEdit && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{t.staff_number}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{t.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{t.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{t.qualification || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {subjectNames(t) || <span className="text-slate-400">Not set yet</span>}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      {t.user_id ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Has Login
                        </span>
                      ) : (
                        <button
                          onClick={() => openCreateLogin(t)}
                          className="rounded-md border border-teal-200 px-2.5 py-1 text-xs font-semibold text-teal-600 transition hover:bg-teal-50"
                        >
                          Create Login
                        </button>
                      )}
                    </td>
                  )}
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button onClick={() => openEditForm(t)} className="text-teal-600 hover:underline">
                        Edit
                      </button>
                      <span className="mx-2 text-slate-300">|</span>
                      <button onClick={() => handleDelete(t.id, t.full_name)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 8 : 6} className="px-4 py-8 text-center text-slate-400">
                    No teachers yet.
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
