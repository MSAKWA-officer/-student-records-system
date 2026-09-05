import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.svg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
        {/* Heading banner — spans the full width of the card */}
        <div className="sims-header flex items-center gap-4 px-8 py-6 text-white">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
            <img src={logo} alt="System logo" className="h-11 w-11" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide sm:text-xl">Student Records Management System</h1>
            <p className="text-xs text-white/80 sm:text-sm">Sign in to manage your school</p>
          </div>
        </div>

        {/* Body — description on the left, login form on the right */}
        <div className="grid grid-cols-1 gap-8 px-8 py-10 md:grid-cols-2 md:divide-x md:divide-slate-200">
          <div className="md:pr-8">
            <h2 className="mb-2 text-base font-bold text-slate-900">About this system</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Student Records System helps schools manage the full student lifecycle in one place —
              enrollment, class and stream assignment, exam results, attendance, and report cards.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
              <li>• Manage students, classes and subjects</li>
              <li>• Record and publish exam results</li>
              <li>• Generate result slips and report cards</li>
              <li>• Track daily attendance</li>
            </ul>
          </div>

          <div className="md:pl-8">
            <h2 className="mb-4 text-base font-bold text-slate-900">Login</h2>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <div className="mb-4 flex items-center rounded-md border border-slate-300 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600">
                <span className="pl-3 text-slate-400">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md px-2.5 py-2 text-sm outline-none"
                  placeholder="you@school.ac.tz"
                />
              </div>

              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <div className="mb-6 flex items-center rounded-md border border-slate-300 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600">
                <span className="pl-3 text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-md px-2.5 py-2 text-sm outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="pr-3 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="mb-2 flex items-center justify-end">
                <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="sims-btn sims-btn-primary w-full py-2.5">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
