import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { subjectsApi } from './Subjectsapi';
import { classSubjectsApi } from '../classSubjects/classSubjectsApi';

const emptyForm = { name: '', code: '', education_level: 'both' };

export default function SubjectCreate() {
  const navigate = useNavigate();
  const location = useLocation();

  // When opened from "+ Add Subject to <class>" on the Subjects page, this
  // carries the class/year context so the new subject is registered to
  // that class right away instead of just sitting in the master list.
  const { classId, className, academicYearId, educationLevel } = location.state || {};

  const [form, setForm] = useState({
    ...emptyForm,
    education_level: educationLevel || 'both',
  });
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
      // Reuse an existing subject with the same name if one exists (e.g. the
      // same "Mathematics" being added to a second class), instead of
      // creating duplicate subject records.
      const existingRes = await subjectsApi.getAll({ search: form.name.trim() });
      const existing = (existingRes.data || []).find(
        (s) => s.name.trim().toLowerCase() === form.name.trim().toLowerCase()
      );

      let subjectId = existing?.id;
      if (!subjectId) {
        const created = await subjectsApi.create({
          name: form.name.trim(),
          code: form.code.trim() || null,
          education_level: form.education_level,
        });
        subjectId = created.data.id;
      }

      if (classId && academicYearId) {
        await classSubjectsApi.create({
          school_class_id: classId,
          subject_id: subjectId,
          academic_year_id: academicYearId,
        });
      }

      setSuccess('Subject saved successfully!');
      setTimeout(() => {
        navigate(classId ? `/dashboard/subjects?classId=${classId}` : '/dashboard/subjects');
      }, 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save the subject.');
    } finally {
      setSaving(false);
    }
  }

  const backTo = classId ? `/dashboard/subjects?classId=${classId}` : '/dashboard/subjects';

  return (
    <div className="p-4">
      <Link to={backTo} className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-3 max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-black">
            {className ? `New Subject — ${className}` : 'New Subject'}
          </h2>
          {className && (
            <p className="mt-1 text-sm text-black">This subject will be registered to {className}.</p>
          )}
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
              {saving ? 'Saving...' : className ? `Save Subject to ${className}` : 'Save Subject'}
            </button>
            <Link to={backTo} className="text-sm text-black hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
