import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import api from '../api/client';
import logo from '../assets/logo.svg';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { token, new_password: newPassword });
      setSuccess(res.data.message);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          This reset link is missing its token. Please request a new one from the{' '}
          <Link to="/forgot-password" className="underline">
            Forgot Password
          </Link>{' '}
          page.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="sims-header flex items-center gap-4 px-8 py-6 text-white">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
            <img src={logo} alt="System logo" className="h-11 w-11" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">Reset Password</h1>
            <p className="text-xs text-white/80">Choose a new password</p>
          </div>
        </div>

        <div className="px-8 py-8">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
              <div className="mb-6 flex items-center rounded-md border border-slate-300 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600">
                <span className="pl-3 text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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

              <button type="submit" disabled={loading} className="sims-btn sims-btn-primary w-full py-2.5">
                {loading ? 'Saving…' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
