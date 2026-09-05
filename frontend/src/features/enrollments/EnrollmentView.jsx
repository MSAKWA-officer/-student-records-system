import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { UsersRound } from 'lucide-react';
import { enrollmentsApi } from './enrollmentsApi';

export default function EnrollmentView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    enrollmentsApi
      .getById(id)
      .then((res) => setEnrollment(res.data))
      .catch(() => setError('Failed to load this enrollment.'))
      .finally(() => setLoading(false));
  }, [id]);

  function studentName(s) {
    if (!s) return '—';
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  async function handleDelete() {
    const name = enrollment.Student ? studentName(enrollment.Student) : '';
    if (!window.confirm(`Are you sure you want to delete the enrollment for "${name}"? This cannot be undone.`)) return;
    try {
      await enrollmentsApi.remove(id);
      navigate('/dashboard/enrollments');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete this enrollment.');
    }
  }

  if (loading) return <div className="p-8 text-sm text-black">Loading...</div>;

  return (
    <div className="p-4">
      <Link to="/dashboard/enrollments" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>

      {error && (
        <div className="mt-3 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Everything for this page — header, class/stream/year info, and
          subject list — lives inside one card/div with a single background. */}
      {enrollment && (
        <div className="mt-3 max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                <UsersRound size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-black">
                  {enrollment.Student ? studentName(enrollment.Student) : 'Enrollment'}
                </h2>
                <p className="mt-1 text-xs text-black">
                  {enrollment.Student?.admission_number ? `Admission No. ${enrollment.Student.admission_number}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100 px-6 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-black">Current Class &amp; Subjects</p>
          </div>

          <div className="grid grid-cols-1 gap-4 border-b border-slate-100 px-6 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-black">Class</p>
              <p className="mt-1 text-sm text-black">
                {enrollment.SchoolClass ? (
                  <Link
                    to={`/dashboard/enrollments/class/${enrollment.SchoolClass.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {enrollment.SchoolClass.name}
                  </Link>
                ) : (
                  '—'
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-black">Stream</p>
              <p className="mt-1 text-sm text-black">{enrollment.Stream?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-black">Academic Year</p>
              <p className="mt-1 text-sm text-black">{enrollment.AcademicYear?.year_name || '—'}</p>
            </div>
          </div>

          <div className="px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-black">Subjects</p>
            {enrollment.EnrollmentSubjects?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {enrollment.EnrollmentSubjects.map((es) => (
                  <span
                    key={es.id}
                    className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {es.Subject?.name || `Subject #${es.subject_id}`}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-black">No subjects recorded.</p>
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-slate-100 px-6 py-4">
            <Link
              to={`/dashboard/enrollments/${enrollment.id}/edit`}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Edit
            </Link>
            <button onClick={handleDelete} className="text-sm font-medium text-red-600 hover:underline">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
