import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { announcementsApi } from './announcementsApi';
import { useAuth } from '../../context/AuthContext';

const AUDIENCE_LABELS = {
  all: 'Everyone',
  teachers: 'Teachers',
  students: 'Students',
  parents: 'Parents',
};

export default function AnnouncementView() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = ['admin', 'headteacher'].includes(user?.role);
  const navigate = useNavigate();

  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    announcementsApi
      .getById(id)
      .then((res) => setAnnouncement(res.data))
      .catch(() => setError('Failed to load this announcement.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete "${announcement.title}"? This cannot be undone.`)) return;
    try {
      await announcementsApi.remove(id);
      navigate('/dashboard/announcements');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete this announcement.');
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) return <div className="p-8 text-sm text-black">Loading...</div>;

  return (
    <div className="p-4">
      <Link to="/dashboard/announcements" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      {error && (
        <div className="mt-3 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Everything for this page — header, meta info and the full message —
          lives inside one card/div with a single background. */}
      {announcement && (
        <div className="mt-3 max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <Megaphone size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-black">{announcement.title}</h2>
                  <p className="mt-1 text-xs text-black">
                    Posted by {announcement.User?.full_name || 'Unknown'} · {formatDate(announcement.createdAt)}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  announcement.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {announcement.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className="border-b border-slate-100 px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-black">Audience</p>
            <p className="mt-1 text-sm text-black">{AUDIENCE_LABELS[announcement.audience] || announcement.audience}</p>
          </div>

          <div className="px-6 py-5">
            <p className="whitespace-pre-line text-sm leading-relaxed text-black">{announcement.body}</p>
          </div>

          {canManage && (
            <div className="flex items-center gap-4 border-t border-slate-100 px-6 py-4">
              <Link
                to={`/dashboard/announcements/${announcement.id}/edit`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Edit
              </Link>
              <button onClick={handleDelete} className="text-sm font-medium text-red-600 hover:underline">
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
