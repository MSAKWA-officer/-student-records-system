import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { enrollmentsApi } from './enrollmentsApi';
import { studentsApi } from '../students/studentsApi';
import { classesApi } from '../classes/classesApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';

const emptyForm = { student_id: '', school_class_id: '', stream_id: '', academic_year_id: '' };

export default function EnrollmentList() {
  const { classId: routeClassId } = useParams();

  const [enrollments, setEnrollments] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // When reached via a class-specific sidebar link (Class Enrollments >
  // Form 1, Form 2, ...) the class filter is pre-set and locked.
  const [filterYear, setFilterYear] = useState('');
  const [filterClass, setFilterClass] = useState(routeClassId || '');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Shown right after a successful enrollment, with a button to jump
  // straight into that class's enrolled student list.
  const [lastEnrolled, setLastEnrolled] = useState(null); // { classId, className }

  useEffect(() => {
    fetchLookups();
  }, []);

  // Keep the class filter in sync with the route (e.g. navigating between
  // Class Enrollments > Form 1 and Form 2 via the sidebar).
  useEffect(() => {
    setFilterClass(routeClassId || '');
  }, [routeClassId]);

  useEffect(() => {
    fetchEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear, filterClass]);

  const selectedClass = classes.find((c) => String(c.id) === String(routeClassId));

  async function fetchLookups() {
    try {
      const [studentsRes, classesRes, yearsRes] = await Promise.all([
        studentsApi.getAll({ limit: 1000 }),
        classesApi.getAll(),
        academicYearsApi.getAll(),
      ]);
      setStudents(studentsRes.data.data || []);
      setClasses(classesRes.data);
      setAcademicYears(yearsRes.data);
    } catch (err) {
      // no special handling, will just show up empty in the form
    }
  }

  async function fetchEnrollments() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterYear) params.academic_year_id = filterYear;
      if (filterClass) params.school_class_id = filterClass;
      const res = await enrollmentsApi.getAll(Object.keys(params).length ? params : undefined);
      setEnrollments(res.data);
    } catch (err) {
      setError('Failed to load class enrollments.');
    } finally {
      setLoading(false);
    }
  }

  const streamsForSelectedClass = useMemo(() => {
    const cls = classes.find((c) => String(c.id) === String(form.school_class_id));
    return cls?.Streams || [];
  }, [classes, form.school_class_id]);

  function handleFormChange(e) {
    const { name, value } = e.target;
    if (name === 'school_class_id') {
      setForm({ ...form, school_class_id: value, stream_id: '' });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  function openAddForm() {
    setForm(emptyForm);
    setFormError('');
    setLastEnrolled(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = { ...form, stream_id: form.stream_id || null };
      await enrollmentsApi.create(payload);

      const enrolledClass = classes.find((c) => String(c.id) === String(form.school_class_id));
      setLastEnrolled(enrolledClass ? { classId: enrolledClass.id, className: enrolledClass.name } : null);

      closeForm();
      fetchEnrollments();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save the enrollment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, studentName) {
    if (!window.confirm(`Are you sure you want to delete the enrollment for "${studentName}"?`)) return;
    try {
      await enrollmentsApi.remove(id);
      setEnrollments((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete the enrollment.');
    }
  }

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  return (
    <div className="p-4">
      {routeClassId && (
        <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
          <Link to="/dashboard/enrollments" className="hover:underline">Class Enrollments</Link>
          <span>/</span>
          <span className="text-slate-700">{selectedClass?.name || '...'}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {routeClassId ? `${selectedClass?.name || 'Class'} Enrollments` : 'Class Enrollments'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{enrollments.length} registered</p>
        </div>
        <button
          onClick={showForm ? closeForm : openAddForm}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          {showForm ? 'Close' : '+ Enroll Student'}
        </button>
      </div>

      {/* After a successful enrollment, offer a direct button into that class's student list. */}
      {lastEnrolled && !showForm && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-800">
            Student enrolled successfully in <span className="font-semibold">{lastEnrolled.className}</span>.
          </p>
          <Link
            to={`/dashboard/students?class_id=${lastEnrolled.classId}`}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
          >
            View {lastEnrolled.className} Students
          </Link>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Year:</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Years</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.year_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Class:</label>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            disabled={Boolean(routeClassId)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {filterClass && (
          <Link
            to={`/dashboard/students?class_id=${filterClass}`}
            className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            View this class's students
          </Link>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Enroll Student in a Class</h3>
          {formError && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Student *</label>
              <select
                name="student_id"
                value={form.student_id}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select Student --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {studentName(s)} ({s.admission_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Academic Year *</label>
              <select
                name="academic_year_id"
                value={form.academic_year_id}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select Year --</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.year_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Class *</label>
              <select
                name="school_class_id"
                value={form.school_class_id}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select Class --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Stream</label>
              <select
                name="stream_id"
                value={form.stream_id}
                onChange={handleFormChange}
                disabled={!form.school_class_id}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
              >
                <option value="">-- None --</option>
                {streamsForSelectedClass.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Enrollment'}
          </button>
        </form>
      )}

      {loading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Stream</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments.map((en) => (
                <tr key={en.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {en.Student ? studentName(en.Student) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {en.SchoolClass ? (
                      <Link
                        to={`/dashboard/students?class_id=${en.SchoolClass.id}`}
                        className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                        title={`View students enrolled in ${en.SchoolClass.name}`}
                      >
                        {en.SchoolClass.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{en.Stream?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{en.AcademicYear?.year_name || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(en.id, en.Student ? studentName(en.Student) : '')}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {enrollments.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                    No enrollments yet.
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
