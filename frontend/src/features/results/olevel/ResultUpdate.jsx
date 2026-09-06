import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { resultsApi } from '../resultsApi';
import { studentFullName } from './oLevelResultHelpers';

// O-Level Results — edit the marks for a single already-recorded result.
// Student, Subject and Exam are fixed (shown read-only) — only the marks
// (and optional remarks override) can change here.
export default function ResultUpdate() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [marks, setMarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    resultsApi
      .getById(id)
      .then((res) => {
        setResult(res.data);
        setMarks(String(res.data.marks_obtained));
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load this result.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');

    const maxMarks = result?.Exam?.max_marks || 100;
    const n = Number(marks);
    if (marks === '' || Number.isNaN(n) || n < 0 || n > maxMarks) {
      setError(`Marks must be a number between 0 and ${maxMarks}.`);
      return;
    }

    setSaving(true);
    try {
      await resultsApi.update(id, { marks_obtained: n });
      navigate(`/dashboard/results/o-level/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update this result.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-black">Loading...</div>;

  return (
    <div className="p-4">
      <Link to="/dashboard/results/o-level" className="text-sm text-blue-600 hover:underline">
        ← Back to O-Level Results
      </Link>

      {result && (
        <form
          onSubmit={handleSave}
          className="mt-3 max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                <GraduationCap size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-black">Edit Result</h2>
                <p className="mt-1 text-sm text-black">{studentFullName(result.Student)}</p>
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
          </div>

          <div className="px-6 py-5">
            <label className="mb-1 block text-sm font-medium text-black">
              Marks Obtained {result.Exam?.max_marks ? `(out of ${result.Exam.max_marks})` : ''}
            </label>
            <input
              type="number"
              min="0"
              max={result.Exam?.max_marks || undefined}
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-2 text-xs text-black">Grade and remarks are recalculated automatically when you save.</p>
          </div>

          {error && <p className="px-6 pb-2 text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link to={`/dashboard/results/o-level/${id}`} className="text-sm text-black hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
