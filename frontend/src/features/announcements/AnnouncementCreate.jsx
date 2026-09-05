import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { announcementsApi } from './announcementsApi';

const emptyForm = { title: '', body: '', audience: 'all' };

export default function AnnouncementCreate() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required.');
      return;
    }

    setLoading(true);
    try {
      await announcementsApi.create({
        title: form.title.trim(),
        body: form.body.trim(),
        audience: form.audience,
      });
      setSuccess('Announcement posted successfully!');
      setForm(emptyForm);
      setTimeout(() => navigate('/dashboard/announcements'), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post the announcement.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <Link to="/dashboard/announcements" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      {/* Everything for this page — header, status messages and the form —
          lives inside one card/div with a single background. */}
      <div className="mt-3 max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-black">New Announcement</h2>
          <p className="mt-1 text-sm text-black">
            Post a notice for the whole school, or target a specific audience.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-black">Title *</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Mid-Term Break Dates"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-black">Audience *</label>
            <select
              name="audience"
              value={form.audience}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Everyone</option>
              <option value="teachers">Teachers</option>
              <option value="students">Students</option>
              <option value="parents">Parents</option>
            </select>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-black">Message *</label>
            <textarea
              name="body"
              value={form.body}
              onChange={handleChange}
              placeholder="Write the announcement here..."
              required
              rows={6}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? 'Posting...' : 'Post Announcement'}
            </button>
            <Link to="/dashboard/announcements" className="text-sm text-black hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
