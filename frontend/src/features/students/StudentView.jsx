import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { studentsApi } from './studentsApi';
import { useAuth } from '../../context/AuthContext';

export default function StudentView() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const canManageLogin = ['admin', 'headteacher'].includes(user?.role);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [creatingLogin, setCreatingLogin] = useState(false);

  // If we arrived here from a specific listing (e.g. a class's student
  // list), send the user back there instead of always to the main
  // Students page.
  const backTo = location.state?.from || '/dashboard/students';

  useEffect(() => {
    studentsApi.getById(id)
      .then((res) => setStudent(res.data))
      .catch(() => setError('Failed to load the student\u2019s details.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete ${student.first_name} ${student.last_name}?`)) return;
    try {
      await studentsApi.remove(id);
      navigate(backTo);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete the student.');
    }
  }

  async function handleCreateLogin(e) {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');
    setCreatingLogin(true);
    try {
      const res = await studentsApi.createLogin(id, loginForm);
      setLoginSuccess(`Login account created (${res.data.email}). Share these credentials with the student.`);
      setStudent((prev) => ({ ...prev, user_id: true }));
      setLoginForm({ email: '', password: '' });
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Failed to create the login account.');
    } finally {
      setCreatingLogin(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading...</div>;
  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!student) return null;

  return (
    <div className="p-4">
      <Link to={backTo} className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-3 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {student.first_name} {student.middle_name} {student.last_name}
          </h2>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {student.status}
          </span>
        </div>

        <Section>
          <SubHeading>Student Information</SubHeading>
          <Row label="Admission Number" value={student.admission_number} />
          <Row label="Gender" value={student.gender === 'male' ? 'Male' : 'Female'} />
          <Row label="Date of Birth" value={student.date_of_birth} />
          <Row label="Admission Date" value={student.admission_date} />
          <Row label="Address" value={student.address} />

          <SubHeading>Parent/Guardian Information</SubHeading>
          <Row label="Parent/Guardian Name" value={student.guardian_name} />
          <Row label="Phone Number" value={student.guardian_phone} />
          <Row label="Relationship" value={student.guardian_relationship} />
        </Section>

        <div className="mt-6 flex gap-3">
          {/* These deliberately don't pass a `from` location: reached this
              way, the "relevant page" to return to is this student's own
              page, so the target pages fall back to their default. */}
          <Link
            to={`/dashboard/students/${id}/report-card`}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Results Report
          </Link>
          <Link
            to={`/dashboard/students/${id}/result-slip`}
            className="sims-btn sims-btn-outline"
          >
            Result Slip (Single Exam)
          </Link>
          <Link
            to={`/dashboard/students/${id}/attendance`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Attendance
          </Link>
          <Link
            to={`/dashboard/students/${id}/edit`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            Delete
          </button>
        </div>

        {canManageLogin && (
          <div className="mt-6">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Student Portal Login
            </h4>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              {student.user_id ? (
                <p className="text-sm text-slate-600">
                  This student already has a login account and can access their own results and attendance.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    This student doesn&apos;t have a login account yet. Create one so they can log in and view
                    their own report card, result slips and attendance.
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
