import { Fragment, useEffect, useState } from 'react';
import { classesApi } from './classesApi';
import { useAuth } from '../../context/AuthContext';

const emptyClassForm = { name: '', level: '', education_level: 'secondary' };

export default function ClassList() {
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher'].includes(user?.role);

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyClassForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [expandedId, setExpandedId] = useState(null);
  const [newStreamName, setNewStreamName] = useState('');
  const [streamSaving, setStreamSaving] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    setLoading(true);
    setError('');
    try {
      const res = await classesApi.getAll();
      setClasses(res.data);
    } catch (err) {
      setError('Failed to load classes.');
    } finally {
      setLoading(false);
    }
  }

  function handleClassFormChange(e) {
    setClassForm({ ...classForm, [e.target.name]: e.target.value });
  }

  async function handleAddClass(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await classesApi.create({
        ...classForm,
        level: classForm.level ? parseInt(classForm.level, 10) : null,
      });
      setClassForm(emptyClassForm);
      setShowAddForm(false);
      fetchClasses();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to add class.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClass(id, name) {
    if (!window.confirm(`Are you sure you want to delete class "${name}"?`)) return;
    try {
      await classesApi.remove(id);
      setClasses((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete class.');
    }
  }

  function startEditClass(c) {
    setEditingId(c.id);
    setEditForm({
      name: c.name || '',
      level: c.level ?? '',
      education_level: c.education_level || 'secondary',
    });
    setEditError('');
    setExpandedId(null);
  }

  function cancelEditClass() {
    setEditingId(null);
    setEditForm(emptyClassForm);
    setEditError('');
  }

  function handleEditFormChange(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  async function handleSaveEditClass(id) {
    setEditError('');
    setEditSaving(true);
    try {
      await classesApi.update(id, {
        ...editForm,
        level: editForm.level ? parseInt(editForm.level, 10) : null,
      });
      cancelEditClass();
      fetchClasses();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update class.');
    } finally {
      setEditSaving(false);
    }
  }

  function toggleExpand(id) {
    setExpandedId(expandedId === id ? null : id);
    setNewStreamName('');
  }

  async function handleAddStream(e, classId) {
    e.preventDefault();
    if (!newStreamName.trim()) return;
    setStreamSaving(true);
    try {
      await classesApi.addStream(classId, { name: newStreamName.trim() });
      setNewStreamName('');
      fetchClasses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add stream.');
    } finally {
      setStreamSaving(false);
    }
  }

  async function handleDeleteStream(streamId, name) {
    if (!window.confirm(`Are you sure you want to delete stream "${name}"?`)) return;
    try {
      await classesApi.removeStream(streamId);
      fetchClasses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete stream.');
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-black">Classes</h2>
          <p className="mt-1 text-sm text-black">{classes.length} registered</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            {showAddForm ? 'Close' : '+ Add Class'}
          </button>
        )}
      </div>

      {canEdit && showAddForm && (
        <form
          onSubmit={handleAddClass}
          className="mt-5 max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          {formError && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Class Name *</label>
              <input
                name="name"
                value={classForm.name}
                onChange={handleClassFormChange}
                placeholder="e.g. Form 1, Std 4"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Level (number)</label>
              <input
                type="number"
                name="level"
                value={classForm.level}
                onChange={handleClassFormChange}
                placeholder="e.g. 1"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Education Level *</label>
              <select
                name="education_level"
                value={classForm.education_level}
                onChange={handleClassFormChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Class'}
          </button>
        </form>
      )}

      {loading && <p className="mt-6 text-sm text-black">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Education Level</th>
                <th className="px-4 py-3 font-medium">Streams</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classes.map((c) => (
                <Fragment key={c.id}>
                  {editingId === c.id ? (
                    <tr className="bg-blue-50/40">
                      <td className="px-4 py-3">
                        <input
                          name="name"
                          value={editForm.name}
                          onChange={handleEditFormChange}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          name="level"
                          value={editForm.level}
                          onChange={handleEditFormChange}
                          className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          name="education_level"
                          value={editForm.education_level}
                          onChange={handleEditFormChange}
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="primary">Primary</option>
                          <option value="secondary">Secondary</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-black">—</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleSaveEditClass(c.id)}
                            disabled={editSaving}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                          >
                            {editSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={cancelEditClass} className="text-xs text-black hover:underline">
                            Cancel
                          </button>
                        </div>
                        {editError && <p className="mt-1 text-xs text-red-600">{editError}</p>}
                      </td>
                    </tr>
                  ) : (
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-black">{c.name}</td>
                      <td className="px-4 py-3 text-black">{c.level ?? '—'}</td>
                      <td className="px-4 py-3 text-black">
                        {c.education_level === 'primary' ? 'Primary' : 'Secondary'}
                      </td>
                      <td className="px-4 py-3 text-black">
                        {c.Streams?.length ? c.Streams.map((s) => s.name).join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit && (
                          <>
                            <button onClick={() => startEditClass(c)} className="text-blue-600 hover:underline">
                              Edit
                            </button>
                            <span className="mx-2 text-slate-300">|</span>
                          </>
                        )}
                        <button
                          onClick={() => toggleExpand(c.id)}
                          className="text-blue-600 hover:underline"
                        >
                          {expandedId === c.id ? 'Close Streams' : 'Manage Streams'}
                        </button>
                        {canEdit && (
                          <>
                            <span className="mx-2 text-slate-300">|</span>
                            <button
                              onClick={() => handleDeleteClass(c.id, c.name)}
                              className="text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  {expandedId === c.id && (
                    <tr key={`${c.id}-streams`} className="bg-slate-50">
                      <td colSpan="5" className="px-4 py-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black">
                          Streams of {c.name}
                        </p>
                        <ul className="mb-3 flex flex-wrap gap-2">
                          {c.Streams?.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs text-black shadow-sm ring-1 ring-slate-200"
                            >
                              {s.name}
                              {canEdit && (
                                <button
                                  onClick={() => handleDeleteStream(s.id, s.name)}
                                  className="text-red-500 hover:text-red-700"
                                  title="Delete stream"
                                >
                                  ×
                                </button>
                              )}
                            </li>
                          ))}
                          {!c.Streams?.length && (
                            <li className="text-xs text-black">No streams yet.</li>
                          )}
                        </ul>
                        {canEdit && (
                          <form onSubmit={(e) => handleAddStream(e, c.id)} className="flex max-w-xs gap-2">
                            <input
                              value={newStreamName}
                              onChange={(e) => setNewStreamName(e.target.value)}
                              placeholder="e.g. A, B, North"
                              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="submit"
                              disabled={streamSaving}
                              className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                            >
                              Add
                            </button>
                          </form>
                        )}                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {classes.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-black">
                    No classes yet.
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
