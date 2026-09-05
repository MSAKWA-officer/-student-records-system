import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import api from '../api/client';
import logo from '../assets/logo.svg';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="sims-header flex items-center gap-4 px-8 py-6 text-white">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
            <img src={logo} alt="System logo" className="h-11 w-11" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">Forgot Password</h1>
            <p className="text-xs text-white/80">We'll email you a reset link</p>
          </div>
        </div>

        <div className="px-8 py-8">
          {message && (
            <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
          )}
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {!message && (
            <form onSubmit={handleSubmit}>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <div className="mb-6 flex items-center rounded-md border border-slate-300 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600">
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

              <button type="submit" disabled={loading} className="sims-btn sims-btn-primary w-full py-2.5">
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <Link to="/login" className="mt-4 block text-center text-sm text-blue-600 hover:underline">
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
