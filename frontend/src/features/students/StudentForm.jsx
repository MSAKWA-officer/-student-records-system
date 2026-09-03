import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { studentsApi } from './studentsApi';

const emptyForm = {
  admission_number: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  gender: 'male',
  date_of_birth: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_relationship: '',
  address: '',
  admission_date: '',
};

export default function StudentForm() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const location = useLocation();

  // If we got here from a specific listing (e.g. a class's student list),
  // send the user back there instead of always to the main Students page.
  const backTo = location.state?.from || '/dashboard/students';

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditMode);
  const navigate = useNavigate();

  useEffect(() => {
    if (isEditMode) {
      studentsApi.getById(id).then((res) => {
        const s = res.data;
        setForm({
          admission_number: s.admission_number || '',
          first_name: s.first_name || '',
          middle_name: s.middle_name || '',
          last_name: s.last_name || '',
          gender: s.gender || 'male',
          date_of_birth: s.date_of_birth || '',
          guardian_name: s.guardian_name || '',
          guardian_phone: s.guardian_phone || '',
          guardian_relationship: s.guardian_relationship || '',
          address: s.address || '',
          admission_date: s.admission_date || '',
        });
      }).catch(() => {
        setError('Failed to load the student\u2019s details.');
      }).finally(() => setFetching(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (isEditMode) {
        await studentsApi.update(id, form);
        setSuccess('Student details updated!');
      } else {
        await studentsApi.create(form);
        setSuccess('Student added successfully!');
        setForm(emptyForm);
      }
      setTimeout(() => navigate(backTo), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save the student\u2019s details.');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <div className="p-8 text-sm text-slate-500">Loading...</div>;

  return (
    <div className="p-4">
      <Link to={backTo} className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-3 max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {isEditMode ? 'Edit Student' : 'Add Student'}
        </h2>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Admission Number *" name="admission_number" value={form.admission_number} onChange={handleChange} required />
            <Field
              label="Gender *"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              type="select"
              options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
            />
            <Field label="First Name *" name="first_name" value={form.first_name} onChange={handleChange} required />
            <Field label="Middle Name" name="middle_name" value={form.middle_name} onChange={handleChange} />
            <Field label="Last Name *" name="last_name" value={form.last_name} onChange={handleChange} required />
            <Field label="Date of Birth" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} type="date" />
          </div>

          <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Parent/Guardian Information
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Parent/Guardian Name" name="guardian_name" value={form.guardian_name} onChange={handleChange} />
            <Field label="Phone Number" name="guardian_phone" value={form.guardian_phone} onChange={handleChange} />
            <Field label="Relationship (Father/Mother/Guardian)" name="guardian_relationship" value={form.guardian_relationship} onChange={handleChange} />
            <Field label="Admission Date" name="admission_date" value={form.admission_date} onChange={handleChange} type="date" />
          </div>

          <div className="mt-4">
            <Field label="Address" name="address" value={form.address} onChange={handleChange} full />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? 'Saving...' : isEditMode ? 'Update Details' : 'Save Student'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = 'text', required = false, options, full = false }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {type === 'select' ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      )}
    </div>
  );
}
