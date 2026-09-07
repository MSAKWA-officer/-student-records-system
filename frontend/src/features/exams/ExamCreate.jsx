import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { examsApi } from './examsApi';
import { termsApi } from '../terms/termsApi';

const emptyForm = { name: '', term_id: '', start_date: '', end_date: '', weight_percent: 100 };

export default function ExamCreate() {
  const navigate = useNavigate();

  const [terms, setTerms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    termsApi.getAll().then((res) => setTerms(res.data)).catch(() => {});
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      // Keep end_date from silently sitting before a newly-picked start_date.
      if (name === 'start_date' && next.end_date && next.end_date < value) {
        next.end_date = value;
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim() || !form.term_id) {
      setError('Exam name and term are required.');
      return;
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError('End date cannot be before the start date.');
      return;
    }

    setSaving(true);
    try {
      await examsApi.create({
        name: form.name.trim(),
        term_id: form.term_id,
        start_date: form.start_date || null,
        end_date: form.end_date || form.start_date || null,
        weight_percent: form.weight_percent,
      });
      setSuccess('Exam added successfully!');
      setTimeout(() => navigate('/dashboard/exams'), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add the exam.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      <Link to="/dashboard/exams" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-3 max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-black">Add Exam</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && (
            <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-black">Exam Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Mid-Term Exam"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-black">Term *</label>
              <select
                name="term_id"
                value={form.term_id}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              <label className="mb-1 block text-sm font-medium text-black">Start Date</label>
              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black">End Date</label>
              <input
                type="date"
                name="end_date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-black">Leave blank for a one-day exam.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Weight (%)</label>
              <input
                type="number"
                name="weight_percent"
                value={form.weight_percent}
                onChange={handleChange}
                min="0"
                max="100"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-black">
              Every subject sat in this exam is marked out of <strong>100</strong> — that's fixed
              per subject and isn't set per exam, so an exam with 5 subjects still has each one
              scored out of 100, not a combined 500.
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Exam'}
            </button>
            <Link to="/dashboard/exams" className="text-sm text-black hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
