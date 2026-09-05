import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Plus, Eye } from 'lucide-react';
import { announcementsApi } from './announcementsApi';
import { useAuth } from '../../context/AuthContext';

const AUDIENCE_LABELS = {
  all: 'Everyone',
  teachers: 'Teachers',
  students: 'Students',
  parents: 'Parents',
};

export default function AnnouncementList() {
  const { user } = useAuth();
  const canManage = ['admin', 'headteacher'].includes(user?.role);

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [audience, setAudience] = useState('');
  const [active, setActive] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    fetchAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, active]);

  async function fetchAnnouncements() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (audience) params.audience = audience;
      if (active) params.active = active;
      const res = await announcementsApi.getAll(params);
      setAnnouncements(res.data);
    } catch (err) {
      setError('Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, title) {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;
    try {
      await announcementsApi.remove(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete this announcement.');
    }
  }

  async function toggleActive(a) {
    setTogglingId(a.id);
    try {
      const res = await announcementsApi.update(a.id, { is_active: !a.is_active });
      setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? res.data : x)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update this announcement.');
    } finally {
      setTogglingId(null);
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function excerpt(text, max = 90) {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max).trim()}…` : text;
  }

  return (
    <div className="p-4">
      {/* Everything for this page — header, filters and the table — lives
          inside one card/div with a single background. */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black">Announcements</h2>
            <p className="mt-1 text-sm text-black">{announcements.length} posted</p>
          </div>
          {canManage && (
            <Link
              to="/dashboard/announcements/create"
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              <Plus size={16} /> New Announcement
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Audiences</option>
            <option value="all">Everyone</option>
            <option value="teachers">Teachers</option>
            <option value="students">Students</option>
            <option value="parents">Parents</option>
          </select>
          <select
            value={active}
            onChange={(e) => setActive(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {error && <p className="px-6 pt-4 text-sm text-red-600">{error}</p>}
        {loading && <p className="px-6 py-6 text-sm text-black">Loading...</p>}

        {/* Table */}
        {!loading && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
              <tr>
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Audience</th>
                <th className="px-6 py-3 font-medium">Posted By</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {announcements.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <p className="font-medium text-black">{a.title}</p>
                    <p className="mt-0.5 text-xs text-black">{excerpt(a.body)}</p>
                  </td>
                  <td className="px-6 py-3 text-black">{AUDIENCE_LABELS[a.audience] || a.audience}</td>
                  <td className="px-6 py-3 text-black">{a.posted_by_name || a.User?.full_name || '—'}</td>
                  <td className="px-6 py-3 text-black">{formatDate(a.createdAt)}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        a.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/dashboard/announcements/${a.id}`}
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                        title="View announcement"
                      >
                        <Eye size={14} /> View
                      </Link>
                      {canManage && (
                        <>
                          <span className="text-slate-300">|</span>
                          <Link to={`/dashboard/announcements/${a.id}/edit`} className="text-blue-600 hover:underline">
                            Edit
                          </Link>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => toggleActive(a)}
                            disabled={togglingId === a.id}
                            className="text-blue-600 hover:underline disabled:opacity-60"
                          >
                            {togglingId === a.id ? 'Updating...' : a.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <span className="text-slate-300">|</span>
                          <button onClick={() => handleDelete(a.id, a.title)} className="text-red-600 hover:underline">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {announcements.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-black">
                    <div className="flex flex-col items-center gap-2">
                      <Megaphone size={22} className="text-slate-300" />
                      No announcements found{audience || active ? ' for this filter.' : ' yet.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
