import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { classSubjectsApi } from './classSubjectsApi';
import { classesApi } from '../classes/classesApi';
import { subjectsApi } from '../subjects/Subjectsapi';
import { teachersApi } from '../teachers/teachersApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import TeacherSearchSelect from './TeacherSearchSelect';

export default function ClassSubjectUpdate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const classId = searchParams.get('class_id') || '';
  const originalTeacherId = searchParams.get('teacher_id') || '';
  const yearId = searchParams.get('academic_year_id') || '';

  const [schoolClass, setSchoolClass] = useState(null);
  const [year, setYear] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [existingRows, setExistingRows] = useState([]); // every ClassSubject row for this class/year, any teacher

  const [selectedTeacherId, setSelectedTeacherId] = useState(originalTeacherId);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [initialSubjectIds, setInitialSubjectIds] = useState([]);

  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, yearId]);

  async function fetchData() {
    setFetching(true);
    setError('');
    try {
      const [classRes, yearsRes, teachersRes, subjectsRes, allocationsRes] = await Promise.all([
        classId ? classesApi.getById(classId) : Promise.resolve({ data: null }),
        academicYearsApi.getAll(),
        teachersApi.getAll(),
        subjectsApi.getAll(),
        classSubjectsApi.getAll({ school_class_id: classId, academic_year_id: yearId }),
      ]);
      setSchoolClass(classRes.data);
      setYear(yearsRes.data.find((y) => String(y.id) === String(yearId)) || null);
      setTeachers(teachersRes.data);
      setAllSubjects(subjectsRes.data);
      setExistingRows(allocationsRes.data);

      const currentRows = originalTeacherId
        ? allocationsRes.data.filter((a) => String(a.Teacher?.id) === String(originalTeacherId))
        : allocationsRes.data.filter((a) => !a.Teacher);
      const subjectIds = [...new Set(currentRows.map((r) => r.subject_id))];
      setInitialSubjectIds(subjectIds);
      setSelectedSubjectIds(subjectIds);
    } catch (err) {
      setError('Failed to load this allocation.');
    } finally {
      setFetching(false);
    }
  }

  const selectedTeacher = teachers.find((t) => String(t.id) === String(selectedTeacherId));

  // Only ever offer subjects the chosen teacher is registered to teach.
  // With no teacher chosen, fall back to the full subject catalogue.
  const subjectOptions = selectedTeacher ? selectedTeacher.subjectsExpertise || [] : allSubjects;

  function handleTeacherChange(teacherId) {
    setSelectedTeacherId(teacherId);
    const newTeacher = teachers.find((t) => String(t.id) === String(teacherId));
    const newOptions = newTeacher ? newTeacher.subjectsExpertise || [] : allSubjects;
    const allowedIds = new Set(newOptions.map((s) => String(s.id)));
    // Drop any previously-checked subject that the newly chosen teacher
    // isn't registered to teach, so the assignment always stays valid.
    setSelectedSubjectIds((prev) => prev.filter((id) => allowedIds.has(String(id))));
  }

  function toggleSubject(subjectId) {
    setSelectedSubjectIds((prev) => {
      const idStr = String(subjectId);
      const already = prev.map(String).includes(idStr);
      return already ? prev.filter((id) => String(id) !== idStr) : [...prev, subjectId];
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const finalTeacherId = selectedTeacherId || null;
      const toAssign = selectedSubjectIds;
      const toUnassign = initialSubjectIds.filter(
        (id) => !selectedSubjectIds.map(String).includes(String(id))
      );

      // Give this teacher every currently-checked subject: update the
      // existing class/subject/year row(s) if one exists, otherwise create
      // a brand-new allocation.
      for (const subjectId of toAssign) {
        const rowsForSubject = existingRows.filter((r) => String(r.subject_id) === String(subjectId));
        if (rowsForSubject.length > 0) {
          await Promise.all(
            rowsForSubject
              .filter((r) => String(r.teacher_id) !== String(finalTeacherId))
              .map((r) => classSubjectsApi.update(r.id, { teacher_id: finalTeacherId }))
          );
        } else {
          await classSubjectsApi.create({
            school_class_id: classId,
            subject_id: subjectId,
            teacher_id: finalTeacherId,
            academic_year_id: yearId,
            stream_ids: [],
          });
        }
      }

      // Unassign subjects that were removed from this teacher, without
      // deleting the class/subject link itself.
      for (const subjectId of toUnassign) {
        const rowsToClear = existingRows.filter((r) => {
          if (String(r.subject_id) !== String(subjectId)) return false;
          return originalTeacherId ? String(r.teacher_id) === String(originalTeacherId) : !r.teacher_id;
        });
        await Promise.all(rowsToClear.map((r) => classSubjectsApi.update(r.id, { teacher_id: null })));
      }

      setSuccess('Allocation updated successfully!');
      const params = new URLSearchParams({
        class_id: classId,
        teacher_id: finalTeacherId || '',
        academic_year_id: yearId,
      }).toString();
      setTimeout(() => navigate(`/dashboard/class-subjects/view?${params}`), 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update this allocation.');
    } finally {
      setSaving(false);
    }
  }

  if (fetching) return <div className="p-8 text-sm text-slate-500">Loading...</div>;

  return (
    <div className="p-4">
      <Link to="/dashboard/class-subjects" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-3 max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-black">Change Teacher / Subjects</h2>
          <p className="mt-1 text-sm text-black">
            {schoolClass?.name || 'Class'} · {year?.year_name || '—'}
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
            <label className="mb-1 block text-sm font-medium text-black">Teacher</label>
            <TeacherSearchSelect
              teachers={teachers}
              value={selectedTeacherId}
              onChange={handleTeacherChange}
            />
            <p className="mt-1 text-xs text-black">
              Search by name or staff number. Changing the teacher updates the subject list below to only
              what they're registered to teach.
            </p>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-black">Subjects</label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-slate-300 px-3 py-2">
              {subjectOptions.length === 0 && (
                <span className="text-sm text-black">
                  {selectedTeacher
                    ? `${selectedTeacher.full_name} has no Subjects of Expertise registered yet.`
                    : 'No subjects available.'}
                </span>
              )}
              {subjectOptions.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm text-black">
                  <input
                    type="checkbox"
                    checked={selectedSubjectIds.map(String).includes(String(s.id))}
                    onChange={() => toggleSubject(s.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {s.name}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-black">
              Check every subject this teacher should cover in this class for this academic year.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
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
