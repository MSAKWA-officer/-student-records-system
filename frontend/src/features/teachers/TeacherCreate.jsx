import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { teachersApi } from './teachersApi';
import { subjectsApi } from '../subjects/Subjectsapi';

// Fixed set of education levels for the "Qualification" field, shown as a
// dropdown instead of free text so records stay consistent.
const QUALIFICATION_OPTIONS = ['Certificate', 'Diploma', 'Bachelor', 'Masters', 'PhD'];

const emptyForm = {
  staff_number: '',
  full_name: '',
  phone: '',
  email: '',
  qualification: '',
  subject_ids: [],
};

export default function TeacherCreate() {
  const navigate = useNavigate();

  const [subjectOptions, setSubjectOptions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    subjectsApi
      .getAll()
      .then((res) => setSubjectOptions(res.data))
      .catch(() => {
        // not critical - the checklist will just be empty
      });
  }, []);

  function handleChange(e) {
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.staff_number.trim() || !form.full_name.trim()) {
      setError('Staff number and full name are required.');
      return;
    }

    setLoading(true);
    try {
      await teachersApi.create({
        staff_number: form.staff_number.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        qualification: form.qualification || null,
        subject_ids: form.subject_ids,
      });
      setSuccess('Teacher added successfully!');
      setForm(emptyForm);
      setTimeout(() => navigate('/dashboard/teachers'), 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add teacher.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <Link to="/dashboard/teachers" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-3 max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-black">Add New Teacher</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Staff Number *</label>
              <input
                name="staff_number"
                value={form.staff_number}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Full Name *</label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Phone Number</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Must be unique per teacher"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Education Level (Qualification)</label>
              <select
                name="qualification"
                value={form.qualification}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select education level...</option>
                {QUALIFICATION_OPTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-black">Subjects of Expertise</label>
              <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-slate-300 px-3 py-2">
                {subjectOptions.length === 0 && (
                  <span className="text-sm text-black">No subjects registered yet.</span>
                )}
                {subjectOptions.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-sm text-black">
                    <input
                      type="checkbox"
                      checked={form.subject_ids.map(String).includes(String(s.id))}
                      onChange={() => toggleSubject(s.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {s.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-black">
                Select the subjects this teacher is skilled in or has studied.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save Teacher'}
            </button>
            <Link to="/dashboard/teachers" className="text-sm text-black hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
