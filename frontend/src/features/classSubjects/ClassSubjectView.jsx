import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { classSubjectsApi } from './classSubjectsApi';
import { classesApi } from '../classes/classesApi';
import { teachersApi } from '../teachers/teachersApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';

export default function ClassSubjectView() {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('class_id') || '';
  const teacherId = searchParams.get('teacher_id') || '';
  const yearId = searchParams.get('academic_year_id') || '';

  const [schoolClass, setSchoolClass] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [year, setYear] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, teacherId, yearId]);

  async function fetchDetails() {
    setLoading(true);
    setError('');
    try {
      const [classRes, yearsRes, allocationsRes] = await Promise.all([
        classId ? classesApi.getById(classId) : Promise.resolve({ data: null }),
        academicYearsApi.getAll(),
        classSubjectsApi.getAll({ school_class_id: classId, academic_year_id: yearId }),
      ]);
      setSchoolClass(classRes.data);
      setYear(yearsRes.data.find((y) => String(y.id) === String(yearId)) || null);

      // The "Not assigned yet" bucket has no teacher_id to filter by on the
      // server, so that case is filtered here on the client instead.
      const matching = teacherId
        ? allocationsRes.data.filter((a) => String(a.Teacher?.id) === String(teacherId))
        : allocationsRes.data.filter((a) => !a.Teacher);
      setRows(matching);

      if (teacherId) {
        const teacherRes = await teachersApi.getById(teacherId);
        setTeacher(teacherRes.data);
      } else {
        setTeacher(null);
      }
    } catch (err) {
      setError('Failed to load this allocation.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id) {
    if (!window.confirm('Remove this subject from the allocation?')) return;
    try {
      await classSubjectsApi.remove(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove this subject allocation.');
    }
  }

  const changeTeacherParams = new URLSearchParams({
    class_id: classId,
    teacher_id: teacherId,
    academic_year_id: yearId,
  }).toString();

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading...</div>;
  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;

  return (
    <div className="p-4">
      <Link to="/dashboard/class-subjects" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="mt-3 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {schoolClass?.name || 'Class'} · {year?.year_name || '—'}
          </h2>
        </div>

        <div className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-4 shadow-sm">
          <div className="flex justify-between py-3 text-sm">
            <span className="text-slate-500">Teacher</span>
            <span className="font-medium text-slate-900">{teacher ? teacher.full_name : 'Not assigned yet'}</span>
          </div>
          {teacher && (
            <>
              <div className="flex justify-between py-3 text-sm">
                <span className="text-slate-500">Staff Number</span>
                <span className="font-medium text-slate-900">{teacher.staff_number || '—'}</span>
              </div>
              <div className="flex justify-between py-3 text-sm">
                <span className="text-slate-500">Qualification</span>
                <span className="font-medium text-slate-900">{teacher.qualification || '—'}</span>
              </div>
              <div className="flex justify-between py-3 text-sm">
                <span className="text-slate-500">Subjects of Expertise</span>
                <span className="font-medium text-slate-900">
                  {(teacher.subjectsExpertise || []).map((s) => s.name).join(', ') || '—'}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Subjects Allocated in This Class
            </h4>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
              <tr>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Stream</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-black">{r.Subject?.name || '—'}</td>
                  <td className="px-4 py-3 text-black">{r.Stream?.name || 'All Streams'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleRemove(r.id)} className="text-red-600 hover:underline">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-black">
                    No subjects found for this allocation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            to={`/dashboard/class-subjects/edit?${changeTeacherParams}`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Change Teacher / Subjects
          </Link>
        </div>
      </div>
    </div>
  );
}
