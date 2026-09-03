import { useEffect, useState } from 'react';
import { examsApi } from './examsApi';
import { termsApi } from '../terms/termsApi';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { name: '', term_id: '', exam_date: '', max_marks: 100, weight_percent: 100 };

export default function ExamList() {
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher', 'teacher'].includes(user?.role);
  const canDelete = ['admin'].includes(user?.role);

  const [exams, setExams] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterTerm, setFilterTerm] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTermsList();
  }, []);

  useEffect(() => {
    fetchExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTerm]);

  async function fetchTermsList() {
    try {
      const res = await termsApi.getAll();
      setTerms(res.data);
    } catch (err) {
      // no special handling, will just show up empty in the form
    }
  }

  async function fetchExams() {
    setLoading(true);
    setError('');
    try {
      const res = await examsApi.getAll(filterTerm ? { term_id: filterTerm } : undefined);
      setExams(res.data);
    } catch (err) {
      setError('Failed to load exams.');
    } finally {
      setLoading(false);
    }
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(exam) {
    setEditingId(exam.id);
    setForm({
      name: exam.name || '',
      term_id: exam.term_id ? String(exam.term_id) : (exam.Term?.id ? String(exam.Term.id) : ''),
      exam_date: exam.exam_date || '',
      max_marks: exam.max_marks ?? 100,
      weight_percent: exam.weight_percent ?? 100,
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
        const res = await examsApi.update(editingId, form);
        setExams((prev) => prev.map((ex) => (ex.id === editingId ? res.data : ex)));
      } else {
        await examsApi.create(form);
        fetchExams();
      }
      closeForm();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save the exam.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete the exam "${name}"?`)) return;
    try {
      await examsApi.remove(id);
      setExams((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete the exam.');
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Exams</h2>
          <p className="mt-1 text-sm text-slate-500">{exams.length} registered</p>
        </div>
        {canEdit && (
          <button
            onClick={showForm ? closeForm : openAddForm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            {showForm ? 'Close' : '+ Add Exam'}
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700">Filter by Term:</label>
        <select
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Terms</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.AcademicYear ? `(${t.AcademicYear.year_name})` : ''}
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
            {editingId ? 'Edit Exam' : 'Add Exam'}
          </h3>
          {formError && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Exam Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleFormChange}
                placeholder="e.g. Mid-Term Exam"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Term *</label>
              <select
                name="term_id"
                value={form.term_id}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select Term --</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.AcademicYear ? `(${t.AcademicYear.year_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Exam Date</label>
              <input
                type="date"
                name="exam_date"
                value={form.exam_date}
                onChange={handleFormChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Max Marks</label>
              <input
                type="number"
                name="max_marks"
                value={form.max_marks}
                onChange={handleFormChange}
                min="1"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Weight (%)</label>
              <input
                type="number"
                name="weight_percent"
                value={form.weight_percent}
                onChange={handleFormChange}
                min="0"
                max="100"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Update Exam' : 'Save Exam'}
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
                <th className="px-4 py-3 font-medium">Exam</th>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Max Marks</th>
                <th className="px-4 py-3 font-medium">Weight (%)</th>
                {canEdit && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exams.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{ex.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {ex.Term?.name || '—'}
                    {ex.Term?.AcademicYear ? ` (${ex.Term.AcademicYear.year_name})` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{ex.exam_date || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{ex.max_marks}</td>
                  <td className="px-4 py-3 text-slate-600">{ex.weight_percent}%</td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button onClick={() => openEditForm(ex)} className="text-blue-600 hover:underline">
                        Edit
                      </button>
                      {canDelete && (
                        <>
                          <span className="mx-2 text-slate-300">|</span>
                          <button onClick={() => handleDelete(ex.id, ex.name)} className="text-red-600 hover:underline">
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {exams.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-slate-400">
                    No exams yet.
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
