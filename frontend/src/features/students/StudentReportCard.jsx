import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { studentsApi } from './studentsApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { termsApi } from '../terms/termsApi';

const SCHOOL_NAME = 'Student Records System School';
const GRADE_POINTS = { A: 1, B: 2, C: 3, D: 4, F: 5 };
const GRADE_REMARKS = { A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Satisfactory', F: 'Fail' };

function computeGrade(pct) {
  if (pct == null) return null;
  if (pct >= 80) return 'A';
  if (pct >= 65) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 35) return 'D';
  return 'F';
}

function computeDivision(totalPoints, count) {
  if (!count) return null;
  if (totalPoints <= 17) return 'I';
  if (totalPoints <= 21) return 'II';
  if (totalPoints <= 25) return 'III';
  if (totalPoints <= 33) return 'IV';
  return '0';
}

export default function StudentReportCard() {
  const { id } = useParams();
  const location = useLocation();
  // If we arrived here from a class listing (e.g. Reports > Form 1), go
  // back there instead of always landing on the student's profile page.
  const backTo = location.state?.from || `/dashboard/students/${id}`;
  const backLabel = location.state?.from ? '← Back' : '← Back to Student';
  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState(''); // '' = whole year

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load academic years once, default to the current one
  useEffect(() => {
    academicYearsApi.getAll().then((res) => {
      setYears(res.data);
      const current = res.data.find((y) => y.is_current) || res.data[0];
      if (current) setAcademicYearId(String(current.id));
    });
  }, []);

  // Load terms for the selected academic year
  useEffect(() => {
    if (!academicYearId) return;
    termsApi.getAll({ academic_year_id: academicYearId }).then((res) => setTerms(res.data));
    setTermId('');
  }, [academicYearId]);

  // Load the report whenever the year (or term) selection changes
  useEffect(() => {
    if (!academicYearId) return;
    setLoading(true);
    setError('');
    studentsApi
      .getReportCard(id, { academic_year_id: academicYearId, term_id: termId || undefined })
      .then((res) => setReport(res.data))
      .catch((err) => {
        setReport(null);
        setError(err.response?.data?.message || 'Failed to load the results report.');
      })
      .finally(() => setLoading(false));
  }, [id, academicYearId, termId]);

  // Each subject's average -> Grade + Remarks + Points, in one summary
  const gradedSubjects = useMemo(() => {
    if (!report) return [];
    return report.subjects
      .filter((s) => s.average != null)
      .map((s) => {
        const grade = computeGrade(s.average);
        return {
          subject_id: s.subject_id,
          subject_name: s.subject_name,
          average: s.average,
          grade,
          points: grade ? GRADE_POINTS[grade] : null,
        };
      });
  }, [report]);

  const totalPoints = gradedSubjects.reduce((sum, s) => sum + (s.points || 0), 0);
  const division = computeDivision(totalPoints, gradedSubjects.length);

  return (
    <div className="p-8">
      <div className="print:hidden">
        <Link to={backTo} className="text-sm text-teal-600 hover:underline">
          {backLabel}
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">Results Report</h2>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500">Academic Year</label>
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.year_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Term</label>
              <select
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              >
                <option value="">Whole Year (All Terms)</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {report && (
              <button
                onClick={() => window.print()}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
              >
                Print
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && report && (
        <div className="result-slip mt-6">
          <div className="result-slip-sheet">
            {/* Letterhead */}
            <div className="result-slip-letterhead">
              <div className="result-slip-crest">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 3 2 8l10 5 8-4v6M6 10.5V16c0 1.5 2.7 3.5 6 3.5s6-2 6-3.5v-5.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="result-slip-school-name">{SCHOOL_NAME}</p>
                <p className="result-slip-school-meta">
                  P.O. Box 000, Mbeya, Tanzania · Tel: +255 000 000 000 · info@school.example
                </p>
              </div>
            </div>

            {/* Document title */}
            <div className="result-slip-doc-title">
              <h3>Student Results Report</h3>
              <p>
                {report.school_class}{report.stream ? ` - ${report.stream}` : ''} · {report.academic_year} · {report.term}
              </p>
            </div>

            <div className="result-slip-body">
              {/* Student info */}
              <div className="result-slip-info-grid">
                <div className="result-slip-info-row">
                  <span className="result-slip-info-label">Full Name</span>
                  <span className="result-slip-info-value">{report.student.full_name}</span>
                </div>
                <div className="result-slip-info-row">
                  <span className="result-slip-info-label">Admission Number</span>
                  <span className="result-slip-info-value">{report.student.admission_number}</span>
                </div>
                <div className="result-slip-info-row">
                  <span className="result-slip-info-label">Class</span>
                  <span className="result-slip-info-value">
                    {report.school_class}{report.stream ? ` (${report.stream})` : ''}
                  </span>
                </div>
                <div className="result-slip-info-row">
                  <span className="result-slip-info-label">Date Issued</span>
                  <span className="result-slip-info-value">
                    {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Single summary table: each subject's average */}
              {gradedSubjects.length === 0 ? (
                <p className="mt-8 text-center text-sm text-slate-400">
                  No results recorded for this student in the selected period.
                </p>
              ) : (
                <table className="result-slip-table">
                  <caption>Subject Performance</caption>
                  <thead>
                    <tr>
                      <th style={{ width: '8%' }}>#</th>
                      <th>Subject</th>
                      <th className="text-right" style={{ width: '18%' }}>
                        Marks
                      </th>
                      <th style={{ width: '14%' }}>Grade</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradedSubjects.map((s, idx) => (
                      <tr key={s.subject_id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{s.subject_name}</td>
                        <td className="text-right">{Math.round(s.average)}/100</td>
                        <td>{s.grade || '—'}</td>
                        <td>{s.grade ? GRADE_REMARKS[s.grade] : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Summary: Subjects Sat / Total Points / Division */}
              {gradedSubjects.length > 0 && (
                <div className="result-slip-summary">
                  <div className="result-slip-summary-box">
                    <p className="result-slip-summary-label">Subjects Sat</p>
                    <p className="result-slip-summary-value">{gradedSubjects.length}</p>
                  </div>
                  <div className="result-slip-summary-box">
                    <p className="result-slip-summary-label">Total Points</p>
                    <p className="result-slip-summary-value">{totalPoints}</p>
                  </div>
                  <div className="result-slip-summary-box">
                    <p className="result-slip-summary-label">Division</p>
                    <p className="result-slip-summary-value">
                      {division != null ? `Division ${division}` : '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* Remarks / comments */}
              <div className="result-slip-remarks">
                <span style={{ fontWeight: 700 }}>Class Teacher&apos;s Comment: </span>
                <span>________________________________________________</span>
              </div>

              {/* Signatures */}
              <div className="result-slip-signatures">
                <div className="result-slip-signature-line">Class Teacher&apos;s Signature</div>
                <div className="result-slip-signature-line">Head Teacher&apos;s Signature</div>
              </div>

              <p className="result-slip-footer">
                This is an official computer-generated results report issued by {SCHOOL_NAME}. Any alteration
                renders it invalid.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
