import { useState, useEffect, useMemo } from 'react';
import api from '../../api/client';
import { teachersApi } from '../teachers/teachersApi';

export default function ClassGatewayManager() {
  const [gateways, setGateways] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [form, setForm] = useState({
    class_id: '',
    teacher_id: '',
    gateway_url: '',
    gateway_api_key: '',
  });
  const [editingId, setEditingId] = useState(null);

  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherList, setShowTeacherList] = useState(false);

  useEffect(() => {
    fetchGateways();
    fetchClasses();
    fetchTeachers();
  }, []);

  const fetchGateways = async () => {
    const res = await api.get('/class-gateways');
    setGateways(res.data);
  };

  const fetchClasses = async () => {
    const res = await api.get('/classes'); // adjust endpoint if your naming differs
    setClasses(res.data);
  };

  const fetchTeachers = async () => {
    const res = await teachersApi.getAll({ limit: 1000 });
    setTeachers(res.data.data || res.data || []);
  };

  const selectedTeacher = useMemo(
    () => teachers.find((t) => String(t.id) === String(form.teacher_id)),
    [teachers, form.teacher_id]
  );

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers;
    const q = teacherSearch.trim().toLowerCase();
    return teachers.filter(
      (t) =>
        (t.full_name || '').toLowerCase().includes(q) ||
        (t.phone || '').toLowerCase().includes(q)
    );
  }, [teachers, teacherSearch]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSelectTeacher = (teacher) => {
    setForm({ ...form, teacher_id: teacher.id });
    setTeacherSearch(teacher.full_name);
    setShowTeacherList(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.teacher_id) {
      alert('Please select a teacher from the list.');
      return;
    }
    const payload = {
      class_id: form.class_id,
      gateway_name: `${selectedTeacher?.full_name || ''}`,
      teacher_id: form.teacher_id,
      gateway_url: form.gateway_url,
      gateway_api_key: form.gateway_api_key,
    };
    try {
      if (editingId) {
        await api.put(`/class-gateways/${editingId}`, payload);
      } else {
        await api.post('/class-gateways', payload);
      }
      resetForm();
      fetchGateways();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const resetForm = () => {
    setForm({ class_id: '', teacher_id: '', gateway_url: '', gateway_api_key: '' });
    setTeacherSearch('');
    setEditingId(null);
  };

  const handleEdit = (gw) => {
    setForm({
      class_id: gw.class_id,
      teacher_id: gw.teacher_id || '',
      gateway_url: gw.gateway_url,
      gateway_api_key: gw.gateway_api_key || '',
    });
    setTeacherSearch(gw.gateway_name || '');
    setEditingId(gw.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this gateway?')) return;
    await api.delete(`/class-gateways/${id}`);
    fetchGateways();
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold text-black mb-4">Class SMS Gateway Management</h2>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <select
          name="class_id"
          value={form.class_id}
          onChange={handleChange}
          required
          className="border rounded p-2 text-black"
        >
          <option value="">-- Select Class --</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="relative">
          <input
            type="text"
            placeholder="Search teacher by name or phone number..."
            value={teacherSearch}
            onChange={(e) => {
              setTeacherSearch(e.target.value);
              setForm({ ...form, teacher_id: '' });
              setShowTeacherList(true);
            }}
            onFocus={() => setShowTeacherList(true)}
            className="border rounded p-2 text-black w-full"
          />
          {showTeacherList && filteredTeachers.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded border border-slate-300 bg-white shadow">
              {filteredTeachers.map((t) => (
                <li
                  key={t.id}
                  onClick={() => handleSelectTeacher(t)}
                  className="cursor-pointer px-3 py-2 text-sm text-black hover:bg-blue-50"
                >
                  {t.full_name} {t.phone ? `— ${t.phone}` : ''}
                </li>
              ))}
            </ul>
          )}
          {showTeacherList && filteredTeachers.length === 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-slate-300 bg-white shadow">
              <li className="px-3 py-2 text-sm text-black">No matching teacher found.</li>
            </ul>
          )}
        </div>

        <input
          name="gateway_url"
          value={form.gateway_url}
          onChange={handleChange}
          placeholder="Gateway URL (http://192.168.x.x:8080)"
          required
          className="border rounded p-2 text-black"
        />
        <input
          name="gateway_api_key"
          value={form.gateway_api_key}
          onChange={handleChange}
          placeholder="API Key (optional)"
          className="border rounded p-2 text-black"
        />

        <button type="submit" className="bg-blue-600 text-white rounded p-2 md:col-span-2">
          {editingId ? 'Save Changes' : 'Add Gateway'}
        </button>
      </form>

      <table className="w-full text-left">
        <thead>
          <tr className="text-black">
            <th className="p-2">Class</th>
            <th className="p-2">Teacher</th>
            <th className="p-2">URL</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {gateways.map((gw) => (
            <tr key={gw.id} className="border-t">
              <td className="p-2 text-black">{gw.SchoolClass?.name}</td>
              <td className="p-2 text-black">{gw.gateway_name}</td>
              <td className="p-2 text-black">{gw.gateway_url}</td>
              <td className="p-2">
                <button onClick={() => handleEdit(gw)} className="text-blue-600 mr-3">Edit</button>
                <button onClick={() => handleDelete(gw.id)} className="text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
