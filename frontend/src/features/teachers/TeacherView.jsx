import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { teachersApi } from './teachersApi';
import { useAuth } from '../../context/AuthContext';

export default function TeacherView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher'].includes(user?.role);
  const canDelete = user?.role === 'admin';
  const canManageLogin = ['admin', 'headteacher'].includes(user?.role);

  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Creates a login account for an already-registered teacher, linking it
  // to their Teacher record (mirrors the "Student Portal Login" flow).
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [creatingLogin, setCreatingLogin] = useState(false);

  useEffect(() => {
    fetchTeacher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function fetchTeacher() {
    setLoading(true);
    teachersApi
      .getById(id)
      .then((res) => setTeacher(res.data))
      .catch(() => setError('Failed to load the teacher’s details.'))
      .finally(() => setLoading(false));
  }

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete teacher "${teacher.full_name}"?`)) return;
    try {
      await teachersApi.remove(id);
      navigate('/dashboard/teachers');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete the teacher.');
    }
  }

  async function handleCreateLogin(e) {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');
    setCreatingLogin(true);
    try {
      const res = await teachersApi.createLogin(id, loginForm);
      setLoginSuccess(`Login account created (${res.data.email}). Share these credentials with the teacher.`);
      setTeacher((prev) => ({ ...prev, user_id: true }));
      setLoginForm({ email: '', password: '' });
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Failed to create the login account.');
    } finally {
      setCreatingLogin(false);
    }
  }

  function subjectNames(t) {
    const list = t.subjectsExpertise || [];
    if (list.length === 0) return null;
    return list.map((s) => s.name).join(', ');
  }

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading...</div>;
  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!teacher) return null;

  return (
    <div className="p-4">
      <Link to="/dashboard/teachers" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-3 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{teacher.full_name}</h2>
          {teacher.user_id ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Has Login
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              No Login
            </span>
          )}
        </div>

        <Section>
          <SubHeading>Teacher Information</SubHeading>
          <Row label="Staff Number" value={teacher.staff_number} />
          <Row label="Phone Number" value={teacher.phone} />
          <Row label="Email" value={teacher.email} />
          <Row label="Qualification" value={teacher.qualification} />
          <Row label="Subjects of Expertise" value={subjectNames(teacher)} />
        </Section>

        <div className="mt-6 flex gap-3">
          {canEdit && (
            <Link
              to={`/dashboard/teachers/${id}/edit`}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Edit
            </Link>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>

        {canManageLogin && (
          <div className="mt-6">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Teacher Portal Login
            </h4>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              {teacher.user_id ? (
                <p className="text-sm text-slate-600">
                  This teacher already has a login account and can access the teacher portal.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    This teacher doesn&apos;t have a login account yet. Create one so they can log in.
                  </p>
                  {loginError && (
                    <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loginError}</div>
                  )}
                  {loginSuccess && (
                    <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {loginSuccess}
                    </div>
                  )}
                  {!loginSuccess && (
                    <form onSubmit={handleCreateLogin} className="mt-3 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Login Email *</label>
                        <input
                          type="email"
                          required
                          value={loginForm.email}
                          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Password *</label>
                        <input
                          type="password"
                          required
                          minLength={8}
                          placeholder="At least 8 characters"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={creatingLogin}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                      >
                        {creatingLogin ? 'Creating...' : 'Create Login'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ children }) {
  return (
    <div className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-4 shadow-sm">
      {children}
    </div>
  );
}

function SubHeading({ children }) {
  return (
    <h4 className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 first:pt-3.5">
      {children}
    </h4>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value || '—'}</span>
    </div>
  );
}
