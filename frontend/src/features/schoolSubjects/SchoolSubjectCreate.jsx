import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { schoolSubjectsApi } from './schoolSubjectsApi';

const emptyForm = { name: '', code: '', education_level: 'both' };

// Adds a subject to the whole-school catalogue only — this never links to a
// class. To register an existing subject to a class, use "Class Subjects".
export default function SchoolSubjectCreate() {
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('Subject name is required.');
      return;
    }

    setSaving(true);
    try {
      await schoolSubjectsApi.create({
        name: form.name.trim(),
        code: form.code.trim() || null,
        education_level: form.education_level,
      });
      setSuccess('Subject saved successfully!');
      setTimeout(() => navigate('/dashboard/school-subjects'), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save the subject.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      <Link to="/dashboard/school-subjects" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-3 max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-black">New School Subject</h2>
          <p className="mt-1 text-sm text-black">
            This adds the subject to the school-wide catalogue. Register it to a class from Class Subjects.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && (
            <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Subject Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Mathematics"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Code</label>
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="e.g. MATH"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Education Level *</label>
              <select
                name="education_level"
                value={form.education_level}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Subject'}
            </button>
            <Link to="/dashboard/school-subjects" className="text-sm text-black hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
