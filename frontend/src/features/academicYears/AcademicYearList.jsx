import { useEffect, useState } from 'react';
import { academicYearsApi } from './academicYearsApi';

const emptyForm = { year_name: '', start_date: '', end_date: '', is_current: false };

export default function AcademicYearList() {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchYears();
  }, []);

  async function fetchYears() {
    setLoading(true);
    setError('');
    try {
      const res = await academicYearsApi.getAll();
      setYears(res.data);
    } catch (err) {
      setError('Failed to load academic years.');
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

  function openEditForm(year) {
    setEditingId(year.id);
    setForm({
      year_name: year.year_name || '',
      start_date: year.start_date || '',
      end_date: year.end_date || '',
      is_current: !!year.is_current,
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
        const res = await academicYearsApi.update(editingId, form);
        setYears((prev) => prev.map((y) => (y.id === editingId ? res.data : y)));
      } else {
        await academicYearsApi.create(form);
        fetchYears();
      }
      closeForm();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save the academic year.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete the year "${name}"?`)) return;
    try {
      await academicYearsApi.remove(id);
      setYears((prev) => prev.filter((y) => y.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete the academic year.');
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Academic Years</h2>
          <p className="mt-1 text-sm text-slate-500">{years.length} registered</p>
        </div>
        <button
          onClick={showForm ? closeForm : openAddForm}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
        >
          {showForm ? 'Close' : '+ Add Year'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            {editingId ? 'Edit Academic Year' : 'Add Academic Year'}
          </h3>
          {formError && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Year *</label>
              <input
                name="year_name"
                value={form.year_name}
                onChange={handleFormChange}
                placeholder="e.g. 2026"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={handleFormChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End Date</label>
              <input
                type="date"
                name="end_date"
                value={form.end_date}
                onChange={handleFormChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="is_current" checked={form.is_current} onChange={handleFormChange} />
            This is the current academic year
          </label>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Update Year' : 'Save Year'}
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
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Start Date</th>
                <th className="px-4 py-3 font-medium">End Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {years.map((y) => (
                <tr key={y.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{y.year_name}</td>
                  <td className="px-4 py-3 text-slate-600">{y.start_date || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{y.end_date || '—'}</td>
                  <td className="px-4 py-3">
                    {y.is_current ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        Current
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEditForm(y)} className="text-teal-600 hover:underline">
                      Edit
                    </button>
                    <span className="mx-2 text-slate-300">|</span>
                    <button onClick={() => handleDelete(y.id, y.year_name)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {years.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                    No academic years yet.
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
