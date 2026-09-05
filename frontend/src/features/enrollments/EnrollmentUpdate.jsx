import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { enrollmentsApi } from './enrollmentsApi';
import { classesApi } from '../classes/classesApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { classSubjectsApi } from '../classSubjects/classSubjectsApi';

const emptyForm = { school_class_id: '', stream_id: '', academic_year_id: '', subject_ids: [] };

export default function EnrollmentUpdate() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [studentLabel, setStudentLabel] = useState('');
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [fetching, setFetching] = useState(true);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Subjects available for the class/stream/year currently picked in the
  // form — the checkboxes the admin picks this student's actual subjects
  // from (not every student takes every subject their class offers).
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  useEffect(() => {
    loadEnrollmentAndLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (form.school_class_id && form.academic_year_id) {
      setLoadingSubjects(true);
      classSubjectsApi
        .getAll({ school_class_id: form.school_class_id, academic_year_id: form.academic_year_id })
        .then((res) => {
          // A subject allocation can be for a specific stream or for ALL
          // streams (stream_id = null) — include both, but if the student's
          // stream has its own allocation for a subject, prefer that one.
          const relevant = res.data.filter(
            (cs) => cs.stream_id === null || String(cs.stream_id) === String(form.stream_id)
          );
          const bySubjectId = new Map();
          relevant.forEach((cs) => {
            const existing = bySubjectId.get(cs.subject_id);
            if (!existing || (cs.stream_id !== null && existing.stream_id === null)) {
              bySubjectId.set(cs.subject_id, cs);
            }
          });
          setAvailableSubjects(Array.from(bySubjectId.values()));
        })
        .catch(() => setAvailableSubjects([]))
        .finally(() => setLoadingSubjects(false));
    } else {
      setAvailableSubjects([]);
    }
  }, [form.school_class_id, form.stream_id, form.academic_year_id]);

  async function loadEnrollmentAndLookups() {
    setFetching(true);
    setError('');
    try {
      const [enrollmentRes, classesRes, yearsRes] = await Promise.all([
        enrollmentsApi.getById(id),
        classesApi.getAll(),
        academicYearsApi.getAll(),
      ]);
      const en = enrollmentRes.data;
      setClasses(classesRes.data);
      setAcademicYears(yearsRes.data);

      const name = en.Student
        ? [en.Student.first_name, en.Student.middle_name, en.Student.last_name].filter(Boolean).join(' ')
        : `Student #${en.student_id}`;
      setStudentLabel(en.Student?.admission_number ? `${name} (${en.Student.admission_number})` : name);

      setForm({
        school_class_id: en.school_class_id ? String(en.school_class_id) : '',
        stream_id: en.stream_id ? String(en.stream_id) : '',
        academic_year_id: en.academic_year_id ? String(en.academic_year_id) : '',
        subject_ids: (en.EnrollmentSubjects || []).map((es) => String(es.subject_id)),
      });
    } catch (err) {
      setError('Failed to load this enrollment.');
    } finally {
      setFetching(false);
    }
  }

  const streamsForSelectedClass = useMemo(() => {
    const cls = classes.find((c) => String(c.id) === String(form.school_class_id));
    return cls?.Streams || [];
  }, [classes, form.school_class_id]);

  function handleFormChange(e) {
    const { name, value } = e.target;
    if (name === 'school_class_id') {
      setForm({ ...form, school_class_id: value, stream_id: '', subject_ids: [] });
    } else if (name === 'academic_year_id') {
      setForm({ ...form, academic_year_id: value, subject_ids: [] });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  function toggleSubject(subjectId) {
    setForm((prev) => {
      const sid = String(subjectId);
      const already = prev.subject_ids.includes(sid);
      return {
        ...prev,
        subject_ids: already
          ? prev.subject_ids.filter((s) => s !== sid)
          : [...prev.subject_ids, sid],
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.subject_ids.length === 0) {
      setError('Select at least one subject for this student.');
      return;
    }

    setSaving(true);
    try {
      await enrollmentsApi.update(id, {
        school_class_id: form.school_class_id,
        stream_id: form.stream_id || null,
        academic_year_id: form.academic_year_id,
        subject_ids: form.subject_ids,
      });
      setSuccess('Enrollment updated successfully!');
      setTimeout(() => navigate(`/dashboard/enrollments/${id}`), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update this enrollment.');
    } finally {
      setSaving(false);
    }
  }

  if (fetching) return <div className="p-8 text-sm text-black">Loading...</div>;

  return (
    <div className="p-4">
      <Link to="/dashboard/enrollments" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      {/* Everything for this page — header, status messages and the form —
          lives inside one card/div with a single background. */}
      <div className="mt-3 max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-black">Edit Enrollment</h2>
          <p className="mt-1 text-sm text-black">
            Update the class, stream, academic year or subjects for {studentLabel || 'this student'}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-black">Student</label>
            <input
              value={studentLabel}
              disabled
              className="w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-black outline-none"
            />
            <p className="mt-1 text-xs text-black">
              To move this enrollment to a different student, delete it and create a new one.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Academic Year *</label>
              <select
                name="academic_year_id"
                value={form.academic_year_id}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              <label className="mb-1 block text-sm font-medium text-black">Class *</label>
              <select
                name="school_class_id"
                value={form.school_class_id}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              <label className="mb-1 block text-sm font-medium text-black">Stream</label>
              <select
                name="stream_id"
                value={form.stream_id}
                onChange={handleFormChange}
                disabled={!form.school_class_id}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
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

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-black">
              Subjects This Student Takes *
            </label>
            {!form.school_class_id || !form.academic_year_id ? (
              <p className="text-xs text-black">Select a class and academic year first.</p>
            ) : loadingSubjects ? (
              <p className="text-xs text-black">Loading subjects...</p>
            ) : availableSubjects.length === 0 ? (
              <p className="text-xs text-black">
                No subjects have been allocated to this class/stream for this year yet — set that up under
                Class Subjects first.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-3">
                {availableSubjects.map((cs) => (
                  <label key={cs.subject_id} className="flex items-center gap-2 text-sm text-black">
                    <input
                      type="checkbox"
                      checked={form.subject_ids.includes(String(cs.subject_id))}
                      onChange={() => toggleSubject(cs.subject_id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {cs.Subject?.name || `Subject #${cs.subject_id}`}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link to={`/dashboard/enrollments/${id}`} className="text-sm text-black hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
