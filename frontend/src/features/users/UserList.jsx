import { useEffect, useState } from 'react';
import { usersApi } from './usersApi';
import { useAuth } from '../../context/AuthContext';

const ROLES = ['admin', 'headteacher', 'teacher', 'staff', 'student'];

const emptyForm = {
  full_name: '',
  email: '',
  password: '',
  role: 'teacher',
  phone: '',
};

export default function UserList() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [resetTargetId, setResetTargetId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  async function fetchUsers() {
    setLoading(true);
    setError('');
    try {
      const res = await usersApi.getAll({ search, role: roleFilter || undefined });
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(u) {
    setEditingId(u.id);
    setForm({
      full_name: u.full_name || '',
      email: u.email || '',
      password: '',
      role: u.role,
      phone: u.phone || '',
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editingId) {
        const { full_name, email, role, phone } = form;
        await usersApi.update(editingId, { full_name, email, role, phone });
      } else {
        await usersApi.create(form);
      }
      closeForm();
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u) {
    try {
      await usersApi.update(u.id, { is_active: !u.is_active });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete user "${name}"?`)) return;
    try {
      await usersApi.remove(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user.');
    }
  }

  function openResetPassword(id) {
    setResetTargetId(id);
    setNewPassword('');
    setResetError('');
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetError('');
    setResetting(true);
    try {
      await usersApi.resetPassword(resetTargetId, newPassword);
      setResetTargetId(null);
      setNewPassword('');
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">User Management</h2>
          <p className="mt-1 text-sm text-slate-500">{users.length} accounts</p>
        </div>
        <button
          onClick={showForm ? closeForm : openAddForm}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          {showForm ? 'Close' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            {editingId ? 'Edit User' : 'Add New User'}
          </h3>
          {formError && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full Name *</label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {!editingId && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleFormChange}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Role *</label>
              <select
                name="role"
                value={form.role}
                onChange={handleFormChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="capitalize">
                    {r}
                  </option>
                ))}
              </select>
              {form.role === 'student' && (
                <p className="mt-1 text-xs text-amber-600">
                  This creates a login only. To link it to a specific student and let them view their own
                  results, use the &quot;Student Portal Login&quot; section on that student&apos;s profile page
                  instead.
                </p>
              )}
              {form.role === 'teacher' && (
                <p className="mt-1 text-xs text-amber-600">
                  This creates a login only, not linked to a teacher record. To give an already-registered
                  teacher a login, go to Teachers and use &quot;Create Login&quot; next to their name instead.
                </p>
              )}
              {form.role === 'staff' && (
                <p className="mt-1 text-xs text-amber-600">
                  Staff accounts aren&apos;t linked to a registered profile in this system yet — this creates a
                  plain login for general school staff (e.g. office/admin).
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleFormChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? 'Saving...' : editingId ? 'Update User' : 'Save User'}
          </button>
        </form>
      )}

      {resetTargetId && (
        <form
          onSubmit={handleResetPassword}
          className="mt-5 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm"
        >
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Reset Password</h3>
          {resetError && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{resetError}</div>
          )}
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (at least 8 characters)"
            required
            minLength={8}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={resetting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {resetting ? 'Saving...' : 'Set Password'}
            </button>
            <button
              type="button"
              onClick={() => setResetTargetId(null)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Full Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.full_name}
                    {u.id === currentUser?.id && (
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                        You
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{u.role}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={u.id === currentUser?.id}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        u.is_active
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => openEditForm(u)} className="text-blue-600 hover:underline">
                      Edit
                    </button>
                    <span className="mx-2 text-slate-300">|</span>
                    <button
                      onClick={() => openResetPassword(u.id)}
                      className="text-amber-600 hover:underline"
                    >
                      Reset Password
                    </button>
                    <span className="mx-2 text-slate-300">|</span>
                    <button
                      onClick={() => handleDelete(u.id, u.full_name)}
                      disabled={u.id === currentUser?.id}
                      className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
