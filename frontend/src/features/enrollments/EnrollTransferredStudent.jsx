import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { studentsApi } from '../students/studentsApi';
import { enrollmentsApi } from './enrollmentsApi';
import { classesApi } from '../classes/classesApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { classSubjectsApi } from '../classSubjects/classSubjectsApi';

const emptyForm = { student_id: '', school_class_id: '', stream_id: '', academic_year_id: '', subject_ids: [] };

// Separate enrollment flow for students who transferred in from another
// school. They never went through the normal "new student" or "promoted
// from last year's class" pools (see EnrollmentCreate's eligible-students
// logic), so they need their own list here — every student flagged
// `is_transfer_student`, regardless of which class they're joining.
export default function EnrollTransferredStudent() {
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [transferStudents, setTransferStudents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState(emptyForm);
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [lastEnrolled, setLastEnrolled] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [classesRes, yearsRes, studentsRes] = await Promise.all([
          classesApi.getAll(),
          academicYearsApi.getAll(),
          studentsApi.getAll({ is_transfer_student: true, limit: 1000 }),
        ]);
        setClasses(classesRes.data);
        setAcademicYears(yearsRes.data);
        setTransferStudents(studentsRes.data.data || []);
      } catch (err) {
        setError('Failed to load classes, academic years, or transferred students.');
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  // A transfer student who already has an Enrollment for the selected
  // academic year can't be enrolled again into that same year.
  const availableTransferStudents = useMemo(() => {
    if (!form.academic_year_id) return transferStudents;
    return transferStudents.filter(
      (s) => !(s.Enrollments || []).some((e) => String(e.academic_year_id) === String(form.academic_year_id))
    );
  }, [transferStudents, form.academic_year_id]);

  const visibleStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return availableTransferStudents;
    return availableTransferStudents.filter((s) => {
      const name = studentName(s).toLowerCase();
      return (
        name.includes(term) ||
        (s.admission_number || '').toLowerCase().includes(term) ||
        (s.previous_school_name || '').toLowerCase().includes(term)
      );
    });
  }, [availableTransferStudents, studentSearch]);

  const streamsForSelectedClass = useMemo(() => {
    const cls = classes.find((c) => String(c.id) === String(form.school_class_id));
    return cls?.Streams || [];
  }, [classes, form.school_class_id]);

  const selectedStudent = useMemo(
    () => transferStudents.find((s) => String(s.id) === String(form.student_id)),
    [transferStudents, form.student_id]
  );

  useEffect(() => {
    if (form.school_class_id && form.academic_year_id) {
      setLoadingSubjects(true);
      classSubjectsApi
        .getAll({ school_class_id: form.school_class_id, academic_year_id: form.academic_year_id })
        .then((res) => {
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

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    if (name === 'school_class_id') {
      setForm({ ...form, school_class_id: value, stream_id: '', subject_ids: [] });
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
        subject_ids: already ? prev.subject_ids.filter((s) => s !== id) : [...prev.subject_ids, id],
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.student_id) {
      setError('Select a transferred student to enroll.');
      return;
    }
    if (!form.school_class_id || !form.academic_year_id) {
      setError('Select an academic year and a class.');
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
      const enrolledStudent = selectedStudent;
      setLastEnrolled({
        classId: enrolledClass?.id,
        className: enrolledClass?.name,
        studentName: enrolledStudent ? studentName(enrolledStudent) : '',
      });
      // Remove them from the local pool so they don't show up as still
      // pending, and reset the form for the next transfer student.
      setTransferStudents((prev) => prev.filter((s) => String(s.id) !== String(form.student_id)));
      setForm((prev) => ({ ...emptyForm, academic_year_id: prev.academic_year_id }));
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
        ← Back to Class Enrollments
      </Link>

      <div className="mt-3 max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-black">Enroll a Transferred Student</h2>
          <p className="mt-1 text-sm text-black">
            {transferStudents.length} student{transferStudents.length === 1 ? '' : 's'} registered as
            transferred from another school. Pick one below, then choose the class/stream and subjects
            they'll take.
          </p>
        </div>

        {lastEnrolled && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50 px-6 py-4">
            <p className="text-sm text-black">
              <span className="font-semibold">{lastEnrolled.studentName}</span> enrolled successfully in{' '}
              <span className="font-semibold">{lastEnrolled.className}</span>.
            </p>
            <div className="flex items-center gap-3">
              <Link
                to={`/dashboard/enrollments/class/${lastEnrolled.classId}`}
                className="whitespace-nowrap rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                View {lastEnrolled.className} Enrollments
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

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
                  <option key={y.id} value={y.id}>{y.year_name}</option>
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
                  <option key={c.id} value={c.id}>{c.name}</option>
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
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Transferred-student picker — every transfer student who isn't
              already enrolled for the selected academic year. */}
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-black">Transferred Student *</label>

            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="relative border-b border-slate-100 px-3 py-2">
                <Search size={14} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-black" />
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search name, admission no. or previous school..."
                  className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="max-h-72 overflow-y-auto">
                {visibleStudents.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-black">
                    {transferStudents.length === 0
                      ? 'No transferred students have been registered yet.'
                      : form.academic_year_id
                      ? 'All transferred students are already enrolled for this academic year.'
                      : 'No student matches your search.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {visibleStudents.map((s) => (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm text-black hover:bg-slate-50">
                          <input
                            type="radio"
                            name="student_id"
                            checked={String(form.student_id) === String(s.id)}
                            onChange={() => selectStudent(s.id)}
                            className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="flex-1">
                            <span className="block font-medium">
                              {studentName(s)}{' '}
                              <span className="text-xs font-normal text-black opacity-70">({s.admission_number})</span>
                            </span>
                            <span className="mt-0.5 block text-xs text-black opacity-70">
                              From {s.previous_school_name || 'unknown school'}
                              {s.previous_class_level ? ` · was ${s.previous_class_level}` : ''}
                              {s.transfer_date ? ` · transferred ${s.transfer_date}` : ''}
                            </span>
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
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-black">Subjects This Student Takes *</label>
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
              {saving ? 'Saving...' : 'Enroll Student'}
            </button>
            <Link to="/dashboard/students/add-transfer" className="text-sm text-black hover:underline">
              + Register another transferred student
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
