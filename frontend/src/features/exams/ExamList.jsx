import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { examsApi } from './examsApi';
import { termsApi } from '../terms/termsApi';
import { useAuth } from '../../context/AuthContext';

export default function ExamList() {
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher', 'teacher'].includes(user?.role);
  const canDelete = ['admin'].includes(user?.role);

  const [exams, setExams] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterTerm, setFilterTerm] = useState('');

  useEffect(() => {
    termsApi.getAll().then((res) => setTerms(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTerm]);

  async function fetchExams() {
    setLoading(true);
    setError('');
    try {
      const res = await examsApi.getAll(filterTerm ? { term_id: filterTerm } : undefined);
      setExams(res.data);
    } catch (err) {
      setError('Failed to load exams.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete the exam "${name}"?`)) return;
    try {
      await examsApi.remove(id);
      setExams((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete the exam.');
    }
  }

  function formatRange(ex) {
    if (!ex.start_date) return '—';
    if (!ex.end_date || ex.end_date === ex.start_date) return ex.start_date;
    return `${ex.start_date} → ${ex.end_date}`;
  }

  return (
    <div className="p-4">
      {/* Everything for this page — header, term filter, and the table —
          lives inside one card instead of separate boxes. */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black">Exams</h2>
            <p className="mt-1 text-sm text-black">
              {exams.length} registered · every subject in an exam is marked out of 100
            </p>
          </div>
          {canEdit && (
            <Link
              to="/dashboard/exams/add"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              + Add Exam
            </Link>
          )}
        </div>

        {/* Term filter */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
          <label className="text-sm font-medium text-black">Filter by Term:</label>
          <select
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.AcademicYear ? `(${t.AcademicYear.year_name})` : ''}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">Loading...</p>}
        {error && <p className="border-b border-slate-100 px-6 py-4 text-sm text-red-600">{error}</p>}

        {/* Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
                <tr>
                  <th className="px-6 py-3 font-medium">Exam</th>
                  <th className="px-6 py-3 font-medium">Term</th>
                  <th className="px-6 py-3 font-medium">Dates</th>
                  <th className="px-6 py-3 font-medium">Weight (%)</th>
                  {canEdit && <th className="px-6 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-black">{ex.name}</td>
                    <td className="px-6 py-3 text-black">
                      {ex.Term?.name || '—'}
                      {ex.Term?.AcademicYear ? ` (${ex.Term.AcademicYear.year_name})` : ''}
                    </td>
                    <td className="px-6 py-3 text-black">{formatRange(ex)}</td>
                    <td className="px-6 py-3 text-black">{ex.weight_percent}%</td>
                    {canEdit && (
                      <td className="whitespace-nowrap px-6 py-3">
                        <Link to={`/dashboard/exams/${ex.id}/edit`} className="text-blue-600 hover:underline">
                          Edit
                        </Link>
                        {canDelete && (
                          <>
                            <span className="mx-2 text-slate-300">|</span>
                            <button onClick={() => handleDelete(ex.id, ex.name)} className="text-red-600 hover:underline">
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {exams.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 5 : 4} className="px-6 py-10 text-center text-black">
                      No exams yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
