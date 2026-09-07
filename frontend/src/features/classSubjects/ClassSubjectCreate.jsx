import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { classSubjectsApi } from './classSubjectsApi';
import { classesApi } from '../classes/classesApi';
import { subjectsApi } from '../subjects/Subjectsapi';
import { teachersApi } from '../teachers/teachersApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import TeacherSearchSelect from './TeacherSearchSelect';
import SubjectSearchSelect from './SubjectSearchSelect';

const emptyForm = { school_class_id: '', subject_id: '', teacher_id: '', academic_year_id: '', stream_ids: [] };

export default function ClassSubjectCreate() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [years, setYears] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [classesRes, subjectsRes, teachersRes, yearsRes] = await Promise.all([
          classesApi.getAll(),
          subjectsApi.getAll(),
          teachersApi.getAll(),
          academicYearsApi.getAll(),
        ]);
        setClasses(classesRes.data);
        setAllSubjects(subjectsRes.data);
        setTeachers(teachersRes.data);
        setYears(yearsRes.data);

        const current = yearsRes.data.find((y) => y.is_current);
        if (current) {
          setForm((f) => ({ ...f, academic_year_id: String(current.id) }));
        }
      } catch (err) {
        setError('Failed to load base data (classes/subjects/teachers/years).');
      }
    })();
  }, []);

  const selectedTeacher = teachers.find((t) => String(t.id) === String(form.teacher_id));
  const selectedClass = classes.find((c) => String(c.id) === String(form.school_class_id));

  // A subject only makes sense for a class if it's registered for that
  // class's education level (primary/secondary) or marked "both".
  function subjectMatchesClass(subject, schoolClass) {
    if (!schoolClass) return true;
    return subject.education_level === 'both' || subject.education_level === schoolClass.education_level;
  }

  // Once a Teacher is picked, only the subjects they're registered to teach
  // (their Subjects of Expertise) are offered — this is what keeps a
  // teacher from being allocated a subject they aren't qualified for.
  // With no Teacher chosen yet, the full subject list is shown instead.
  // Either way, once a Class is also picked, the list is narrowed further
  // to subjects that actually belong to that class's education level —
  // e.g. a Form Three (secondary) class never offers a primary-only
  // subject, and vice versa — so the dropdown only ever shows subjects
  // that are actually relevant, not the whole subject catalogue.
  const subjectOptions = (selectedTeacher ? selectedTeacher.subjectsExpertise || [] : allSubjects).filter((s) =>
    subjectMatchesClass(s, selectedClass)
  );

  function streamsForClass(classId) {
    const cls = classes.find((c) => String(c.id) === String(classId));
    return cls?.Streams || [];
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    if (name === 'school_class_id') {
      setForm((f) => {
        const newClass = classes.find((c) => String(c.id) === String(value));
        const newOptions = (selectedTeacher ? selectedTeacher.subjectsExpertise || [] : allSubjects).filter((s) =>
          subjectMatchesClass(s, newClass)
        );
        const stillValid = newOptions.some((s) => String(s.id) === String(f.subject_id));
        return { ...f, school_class_id: value, stream_ids: [], subject_id: stillValid ? f.subject_id : '' };
      });
      return;
    }
    setForm((f) => ({ ...f, [name]: value }));
  }

  function handleTeacherChange(teacherId) {
    setForm((f) => {
      const newTeacher = teachers.find((t) => String(t.id) === String(teacherId));
      const newSubjectOptions = (newTeacher ? newTeacher.subjectsExpertise || [] : allSubjects).filter((s) =>
        subjectMatchesClass(s, selectedClass)
      );
      // If the subject currently picked isn't taught by the newly chosen
      // teacher (or doesn't fit the selected class's level), clear it so an
      // invalid combination can't be submitted.
      const stillValid = newSubjectOptions.some((s) => String(s.id) === String(f.subject_id));
      return { ...f, teacher_id: teacherId, subject_id: stillValid ? f.subject_id : '' };
    });
  }

  function handleSubjectChange(subjectId) {
    setForm((f) => ({ ...f, subject_id: subjectId }));
  }

  function toggleFormStream(streamId) {
    setForm((f) => {
      const idStr = String(streamId);
      const already = f.stream_ids.map(String).includes(idStr);
      return {
        ...f,
        stream_ids: already
          ? f.stream_ids.filter((id) => String(id) !== idStr)
          : [...f.stream_ids, streamId],
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.school_class_id || !form.subject_id || !form.academic_year_id) {
      setError('Class, subject and academic year are required.');
      return;
    }

    setLoading(true);
    try {
      await classSubjectsApi.create({
        ...form,
        teacher_id: form.teacher_id || null,
      });
      setSuccess('Subject allocation saved successfully!');
      setTimeout(() => navigate('/dashboard/class-subjects'), 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save the subject allocation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <Link to="/dashboard/class-subjects" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-3 max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-black">New Subject Allocation</h2>
          <p className="mt-1 text-sm text-black">
            Link a Teacher, Subject, Class and Stream for an academic year.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-black">Teacher</label>
              <TeacherSearchSelect
                teachers={teachers}
                value={form.teacher_id}
                onChange={handleTeacherChange}
              />
              <p className="mt-1 text-xs text-black">
                Search by name or staff number. Leave blank to allocate the subject without a teacher for now.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-black">Subject *</label>
              <SubjectSearchSelect
                subjects={subjectOptions}
                value={form.subject_id}
                onChange={handleSubjectChange}
              />
              {selectedTeacher && subjectOptions.length === 0 && (
                <p className="mt-1 text-xs text-red-600">
                  {selectedClass
                    ? `${selectedTeacher.full_name} has no ${selectedClass.education_level} Subjects of Expertise registered yet — update their profile first, or leave the Teacher field blank.`
                    : `${selectedTeacher.full_name} has no Subjects of Expertise registered yet — update their profile first, or leave the Teacher field blank.`}
                </p>
              )}
              {!selectedTeacher && selectedClass && subjectOptions.length === 0 && (
                <p className="mt-1 text-xs text-red-600">
                  No {selectedClass.education_level} subjects exist yet — add one on the Subjects page first.
                </p>
              )}
              {selectedTeacher && subjectOptions.length > 0 && (
                <p className="mt-1 text-xs text-black">
                  Showing only subjects {selectedTeacher.full_name} is registered to teach
                  {selectedClass ? ` that also fit ${selectedClass.name} (${selectedClass.education_level})` : ''}.
                </p>
              )}
              {!selectedTeacher && selectedClass && subjectOptions.length > 0 && (
                <p className="mt-1 text-xs text-black">
                  Showing only {selectedClass.education_level} subjects — the ones that fit {selectedClass.name}.
                </p>
              )}
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
              <label className="mb-1 block text-sm font-medium text-black">Academic Year *</label>
              <select
                name="academic_year_id"
                value={form.academic_year_id}
                onChange={handleFormChange}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select Year --</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.year_name}{y.is_current ? ' (Current)' : ''}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-black">Stream</label>
              {!form.school_class_id && (
                <p className="text-xs text-black">Select a class first to see its streams.</p>
              )}
              {form.school_class_id && (
                <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-slate-300 px-3 py-2">
                  {streamsForClass(form.school_class_id).length === 0 && (
                    <span className="text-sm text-black">
                      This class has no streams — the allocation will apply to the whole class.
                    </span>
                  )}
                  {streamsForClass(form.school_class_id).map((s) => (
                    <label key={s.id} className="flex items-center gap-1.5 text-sm text-black">
                      <input
                        type="checkbox"
                        checked={form.stream_ids.map(String).includes(String(s.id))}
                        onChange={() => toggleFormStream(s.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-black">
                Select one or more streams. If you select none, the allocation will apply to ALL streams of this class.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save Allocation'}
            </button>
            <Link to="/dashboard/class-subjects" className="text-sm text-black hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
