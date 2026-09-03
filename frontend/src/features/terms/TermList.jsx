import { useEffect, useState } from 'react';
import { termsApi } from './termsApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { name: '', academic_year_id: '', start_date: '', end_date: '', is_current: false };

export default function TermList() {
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher'].includes(user?.role);

  const [terms, setTerms] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterYear, setFilterYear] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    fetchTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear]);

  async function fetchYears() {
    try {
      const res = await academicYearsApi.getAll();
      setAcademicYears(res.data);
    } catch (err) {
      // no special handling, will just show up empty in the form
    }
  }

  async function fetchTerms() {
    setLoading(true);
    setError('');
    try {
      const res = await termsApi.getAll(filterYear ? { academic_year_id: filterYear } : undefined);
      setTerms(res.data);
    } catch (err) {
      setError('Failed to load terms.');
    } finally {
      setLoading(false);
    }
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(term) {
    setEditingId(term.id);
    setForm({
      name: term.name || '',
      academic_year_id: term.academic_year_id ? String(term.academic_year_id) : (term.AcademicYear?.id ? String(term.AcademicYear.id) : ''),
      start_date: term.start_date || '',
      end_date: term.end_date || '',
      is_current: !!term.is_current,
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

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editingId) {
        const res = await termsApi.update(editingId, form);
        setTerms((prev) => prev.map((t) => (t.id === editingId ? res.data : t)));
      } else {
        await termsApi.create(form);
        fetchTerms();
      }
      closeForm();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save the term.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete the term "${name}"?`)) return;
    try {
      await termsApi.remove(id);
      setTerms((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete the term.');
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Terms</h2>
          <p className="mt-1 text-sm text-slate-500">{terms.length} registered</p>
        </div>
        {canEdit && (
          <button
            onClick={showForm ? closeForm : openAddForm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            {showForm ? 'Close' : '+ Add Term'}
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700">Filter by Year:</label>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Years</option>
          {academicYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.year_name}
            </option>
          ))}
        </select>
      </div>

      {canEdit && showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            {editingId ? 'Edit Term' : 'Add Term'}
          </h3>
          {formError && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Term Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleFormChange}
                placeholder="e.g. First Term"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Academic Year *</label>
              <select
                name="academic_year_id"
                value={form.academic_year_id}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select Year --</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.year_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={handleFormChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End Date</label>
              <input
                type="date"
                name="end_date"
                value={form.end_date}
                onChange={handleFormChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="is_current" checked={form.is_current} onChange={handleFormChange} />
            This is the current term
          </label>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Update Term' : 'Save Term'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={closeForm}
                className="text-sm font-medium text-slate-500 hover:underline"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {loading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 font-medium">Academic Year</th>
                <th className="px-4 py-3 font-medium">Start Date</th>
                <th className="px-4 py-3 font-medium">End Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canEdit && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {terms.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3 text-slate-600">{t.AcademicYear?.year_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{t.start_date || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{t.end_date || '—'}</td>
                  <td className="px-4 py-3">
                    {t.is_current ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        Current
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button onClick={() => openEditForm(t)} className="text-blue-600 hover:underline">
                        Edit
                      </button>
                      <span className="mx-2 text-slate-300">|</span>
                      <button onClick={() => handleDelete(t.id, t.name)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {terms.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-slate-400">
                    No terms yet.
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
