import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  // Transfer-specific details
  previous_school_name: '',
  previous_class_level: '',
  transfer_date: '',
  transfer_certificate_no: '',
};

// Register a student who is joining from another school (not a brand-new
// first-time student). This is a separate page from the normal "Add
// Student" flow so the transfer-specific details (previous school, previous
// class, transfer date/certificate) are captured up front — the record it
// creates is still a normal Student, just flagged `is_transfer_student`.
export default function StudentTransferForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedStudentId, setSavedStudentId] = useState(null);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.previous_school_name.trim()) {
      setError('Please enter the name of the school this student transferred from.');
      return;
    }

    setLoading(true);
    try {
      const res = await studentsApi.create({ ...form, is_transfer_student: true });
      setSuccess('Transferred student registered successfully!');
      setSavedStudentId(res.data.id);
      setForm(emptyForm);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register this student.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <Link to="/dashboard/students" className="text-sm text-blue-600 hover:underline">
        ← Back to Students
      </Link>

      <div className="mt-3 max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Register Transferred Student</h2>
        <p className="mt-1 text-sm text-slate-500">
          For a student joining from another school — not a brand-new first-time student.
        </p>

        {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {success && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <span>{success}</span>
            {savedStudentId && (
              <Link
                to="/dashboard/enrollments/transferred"
                className="whitespace-nowrap rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                Enroll this student now
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Transfer Details
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Previous School Name *"
              name="previous_school_name"
              value={form.previous_school_name}
              onChange={handleChange}
              required
            />
            <Field
              label="Previous Class (at old school)"
              name="previous_class_level"
              value={form.previous_class_level}
              onChange={handleChange}
              placeholder="e.g. Form 2"
            />
            <Field
              label="Transfer Date"
              name="transfer_date"
              value={form.transfer_date}
              onChange={handleChange}
              type="date"
            />
            <Field
              label="Transfer Certificate No."
              name="transfer_certificate_no"
              value={form.transfer_certificate_no}
              onChange={handleChange}
            />
          </div>

          <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Student Details
          </p>
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
            <Field label="Admission Date (at this school)" name="admission_date" value={form.admission_date} onChange={handleChange} type="date" />
          </div>

          <div className="mt-4">
            <Field label="Address" name="address" value={form.address} onChange={handleChange} full />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Register Transferred Student'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = 'text', required = false, options, full = false, placeholder }) {
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
          placeholder={placeholder}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      )}
    </div>
  );
}
