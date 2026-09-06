import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { resultsApi } from '../resultsApi';
import { useAuth } from '../../../context/AuthContext';
import { GRADE_POINTS, autoRemark, studentFullName } from './oLevelResultHelpers';

// O-Level Results — read-only detail view of a single recorded result.
export default function ResultView() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = ['admin', 'headteacher', 'teacher'].includes(user?.role);
  const canDelete = user?.role === 'admin';

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    resultsApi
      .getById(id)
      .then((res) => setResult(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load this result.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this result? This cannot be undone.')) return;
    try {
      await resultsApi.remove(id);
      navigate('/dashboard/results/o-level');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete this result.');
    }
  }

  if (loading) return <div className="p-8 text-sm text-black">Loading...</div>;

  return (
    <div className="p-4">
      <Link to="/dashboard/results/o-level" className="text-sm text-blue-600 hover:underline">
        ← Back to O-Level Results
      </Link>

      {error && <div className="mt-3 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-3 max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                <GraduationCap size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-black">{studentFullName(result.Student)}</h2>
                <p className="mt-1 text-xs text-black">Admission No. {result.Student?.admission_number || '—'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-b border-slate-100 px-6 py-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-black">Subject</p>
              <p className="mt-1 text-sm text-black">{result.Subject?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-black">Exam</p>
              <p className="mt-1 text-sm text-black">
                {result.Exam?.name || '—'} {result.Exam?.Term ? `(${result.Exam.Term.name})` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-black">Academic Year</p>
              <p className="mt-1 text-sm text-black">{result.Exam?.Term?.AcademicYear?.year_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-black">Max Marks</p>
              <p className="mt-1 text-sm text-black">{result.Exam?.max_marks ?? '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-b border-slate-100 px-6 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-black">Marks Obtained</p>
              <p className="mt-1 text-lg font-semibold text-black">{result.marks_obtained}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-black">Grade</p>
              <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-700">
                {result.grade || '—'}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-black">Points</p>
              <p className="mt-1 text-sm text-black">{result.grade ? GRADE_POINTS[result.grade] ?? '—' : '—'}</p>
            </div>
          </div>

          <div className="px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-black">Remarks</p>
            <p className="mt-1 text-sm text-black">{result.remarks || autoRemark(result.grade)}</p>
          </div>

          {(canEdit || canDelete) && (
            <div className="flex items-center gap-4 border-t border-slate-100 px-6 py-4">
              {canEdit && (
                <Link to={`/dashboard/results/o-level/${result.id}/edit`} className="text-sm font-medium text-blue-600 hover:underline">
                  Edit
                </Link>
              )}
              {canDelete && (
                <button onClick={handleDelete} className="text-sm font-medium text-red-600 hover:underline">
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
