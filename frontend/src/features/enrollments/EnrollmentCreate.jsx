import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { enrollmentsApi } from './enrollmentsApi';
import { studentsApi } from '../students/studentsApi';
import { classesApi } from '../classes/classesApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { classSubjectsApi } from '../classSubjects/classSubjectsApi';

const emptyForm = { student_id: '', school_class_id: '', stream_id: '', academic_year_id: '', subject_ids: [] };

export default function EnrollmentCreate() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [fetching, setFetching] = useState(true);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The pool of students allowed for the currently-selected class: brand
  // new students for an entry-level class (e.g. Form 1 / Standard 1), or
  // students promoted from the class one level below for any other class.
  // This list — and its search bar — only exists on this page.
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [eligibleMode, setEligibleMode] = useState(null); // 'new' | 'promotion'
  const [previousClass, setPreviousClass] = useState(null);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Subjects available for the class/stream/year currently picked in the
  // form — the checkboxes the admin picks this student's actual subjects
  // from (not every student takes every subject their class offers).
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Shown right after a successful enrollment, with a button to jump
  // straight into that class's enrolled student list.
  const [lastEnrolled, setLastEnrolled] = useState(null); // { classId, className }

  useEffect(() => {
    fetchLookups();
  }, []);

  // Reload the eligible-student pool whenever the target class or academic
  // year changes, and reset whichever student was already picked (it may
  // no longer be a valid choice for the new class/year).
  useEffect(() => {
    setForm((prev) => ({ ...prev, student_id: '' }));
    setStudentSearch('');
    if (form.school_class_id) {
      setLoadingEligible(true);
      studentsApi
        .getEligible({ school_class_id: form.school_class_id, academic_year_id: form.academic_year_id || undefined })
        .then((res) => {
          setEligibleStudents(res.data.data || []);
          setEligibleMode(res.data.mode || null);
          setPreviousClass(res.data.previous_class || null);
        })
        .catch(() => {
          setEligibleStudents([]);
          setEligibleMode(null);
          setPreviousClass(null);
        })
        .finally(() => setLoadingEligible(false));
    } else {
      setEligibleStudents([]);
      setEligibleMode(null);
      setPreviousClass(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.school_class_id, form.academic_year_id]);

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

  async function fetchLookups() {
    try {
      const [classesRes, yearsRes] = await Promise.all([
        classesApi.getAll(),
        academicYearsApi.getAll(),
      ]);
      setClasses(classesRes.data);
      setAcademicYears(yearsRes.data);
    } catch (err) {
      setError('Failed to load classes or academic years.');
    } finally {
      setFetching(false);
    }
  }

  const streamsForSelectedClass = useMemo(() => {
    const cls = classes.find((c) => String(c.id) === String(form.school_class_id));
    return cls?.Streams || [];
  }, [classes, form.school_class_id]);

  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === String(form.school_class_id)),
    [classes, form.school_class_id]
  );

  const selectedStudent = useMemo(
    () => eligibleStudents.find((s) => String(s.id) === String(form.student_id)),
    [eligibleStudents, form.student_id]
  );

  const visibleStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return eligibleStudents;
    return eligibleStudents.filter((s) => {
      const name = studentName(s).toLowerCase();
      return name.includes(term) || (s.admission_number || '').toLowerCase().includes(term);
    });
  }, [eligibleStudents, studentSearch]);

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    if (name === 'school_class_id') {
      setForm({ ...form, school_class_id: value, stream_id: '', subject_ids: [], student_id: '' });
    } else if (name === 'academic_year_id') {
      setForm({ ...form, academic_year_id: value, subject_ids: [], student_id: '' });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  function selectStudent(id) {
    setForm((prev) => ({ ...prev, student_id: String(id) }));
  }

  function toggleSubject(subjectId) {
    setForm((prev) => {
      const id = String(subjectId);
      const already = prev.subject_ids.includes(id);
      return {
        ...prev,
        subject_ids: already
          ? prev.subject_ids.filter((s) => s !== id)
          : [...prev.subject_ids, id],
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.student_id) {
      setError('Select a student to enroll.');
      return;
    }
    if (form.subject_ids.length === 0) {
      setError('Select at least one subject for this student.');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, stream_id: form.stream_id || null };
      await enrollmentsApi.create(payload);

      const enrolledClass = classes.find((c) => String(c.id) === String(form.school_class_id));
      setLastEnrolled(enrolledClass ? { classId: enrolledClass.id, className: enrolledClass.name } : null);
      setForm(emptyForm);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save the enrollment.');
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
          <h2 className="text-lg font-semibold text-black">Enroll Student in a Class</h2>
          <p className="mt-1 text-sm text-black">
            Pick a class/stream and academic year first — the student list below will narrow to only the
            students who can be enrolled there — then choose the subjects they actually take.
          </p>
        </div>

        {/* After a successful enrollment, offer a direct button into that class's enrolled list
            (kept inside Enrollments, not the general Students page). */}
        {lastEnrolled && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50 px-6 py-4">
            <p className="text-sm text-black">
              Student enrolled successfully in <span className="font-semibold">{lastEnrolled.className}</span>.
            </p>
            <div className="flex items-center gap-3">
              <Link
                to={`/dashboard/enrollments/class/${lastEnrolled.classId}`}
                className="whitespace-nowrap rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                View {lastEnrolled.className} Enrollments
              </Link>
              <Link to="/dashboard/enrollments" className="whitespace-nowrap text-xs font-semibold text-black hover:underline">
                Go to Enrollments List
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          {/* Student picker — only the students eligible for the class picked
              above show up here, with their own search bar. */}
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-black">Student *</label>

            {!form.school_class_id ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-black">
                Select a class first to see the students who can be enrolled into it.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-black">
                  {eligibleMode === 'new' && (
                    <span>Showing new students not yet enrolled in any class.</span>
                  )}
                  {eligibleMode === 'promotion' && (
                    <span>
                      Showing students currently in{' '}
                      <span className="font-semibold">{previousClass?.name || 'the previous class'}</span> who
                      can be promoted to {selectedClass?.name || 'this class'}.
                    </span>
                  )}
                  {!eligibleMode && !loadingEligible && (
                    <span>No eligible students found for this class.</span>
                  )}
                </div>

                <div className="relative border-b border-slate-100 px-3 py-2">
                  <Search size={14} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-black" />
                  <input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search name or admission no..."
                    className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {loadingEligible ? (
                    <p className="px-3 py-4 text-center text-xs text-black">Loading students...</p>
                  ) : visibleStudents.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-black">
                      {eligibleStudents.length === 0
                        ? 'No students are eligible for this class right now.'
                        : 'No students match your search.'}
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {visibleStudents.map((s) => (
                        <li key={s.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-black hover:bg-slate-50">
                            <input
                              type="radio"
                              name="student_id"
                              checked={String(form.student_id) === String(s.id)}
                              onChange={() => selectStudent(s.id)}
                              className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="flex-1">
                              {studentName(s)}{' '}
                              <span className="text-xs text-black opacity-70">({s.admission_number})</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {selectedStudent && (
                  <div className="border-t border-slate-100 bg-blue-50 px-3 py-2 text-xs text-black">
                    Selected: <span className="font-semibold">{studentName(selectedStudent)}</span> (
                    {selectedStudent.admission_number})
                  </div>
                )}
              </div>
            )}
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
              {saving ? 'Saving...' : 'Save Enrollment'}
            </button>
            <Link to="/dashboard/enrollments" className="text-sm text-black hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
