import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { studentsApi } from './studentsApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { termsApi } from '../terms/termsApi';

const SCHOOL_NAME = 'KATORO SECONDARY SCHOOL';
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
  const navigate = useNavigate();
  // Only ever go back to wherever the user actually came from (e.g. a
  // specific student's page, or a class's Reports listing). If there is no
  // recorded origin, fall back to normal browser history instead of
  // hard-coding a route — this page should never force the user into the
  // main Students list.
  const cameFrom = location.state?.from;
  function goBack() {
    if (cameFrom) {
      navigate(cameFrom);
    } else {
      navigate(-1);
    }
  }
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

  // Every subject registered for this class, whether or not marks were
  // recorded — subjects with no marks are flagged so they can be shown as
  // "Incomplete" instead of silently disappearing from the report.
  const allSubjectRows = useMemo(() => {
    if (!report) return [];
    return report.subjects.map((s) => {
      const complete = s.average != null;
      const grade = complete ? computeGrade(s.average) : null;
      return {
        subject_id: s.subject_id,
        subject_name: s.subject_name,
        average: complete ? s.average : null,
        grade,
        points: grade ? GRADE_POINTS[grade] : null,
        complete,
      };
    });
  }, [report]);

  // Only fully-marked subjects count toward Subjects Sat / Total Points / Division.
  const completedSubjects = useMemo(
    () => allSubjectRows.filter((s) => s.complete),
    [allSubjectRows]
  );

  // Division points come from only the best 7 subjects (lowest points =
  // strongest grades) among those actually sat — not every subject the
  // student took. If fewer than 7 were sat, all of them count.
  const bestSubjectsForDivision = useMemo(
    () => [...completedSubjects].sort((a, b) => a.points - b.points).slice(0, 7),
    [completedSubjects]
  );

  const totalPoints = bestSubjectsForDivision.reduce((sum, s) => sum + (s.points || 0), 0);
  // While any subject is still missing marks, the division isn't final —
  // show "Incomplete" rather than a number that could change once the
  // remaining marks are entered.
  const hasIncompleteSubject = allSubjectRows.some((s) => !s.complete);
  const divisionRaw = computeDivision(totalPoints, bestSubjectsForDivision.length);
  const division = hasIncompleteSubject ? null : divisionRaw;

  return (
    <div className="p-4 print:p-0">
      <div className="print:hidden">
        <button onClick={goBack} className="text-sm text-blue-600 hover:underline">
          ← Back
        </button>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">Results Report</h2>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500">Academic Year</label>
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
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
                className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
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
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
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
        <div className="result-slip report-print-compact mt-6 print:mt-0">
          {/* Scoped print overrides — shrink spacing/fonts so the whole
              report (letterhead, table, summary, comment, signatures)
              always fits on a single sheet of paper, no matter how many
              subjects are listed. */}
          <style>{`
            @media print {
              @page { size: A4; margin: 8mm; }
              .report-print-compact .result-slip-sheet {
                border: none !important;
                max-width: 100% !important;
              }
              .report-print-compact .result-slip-letterhead {
                padding: 8px 14px !important;
                gap: 10px !important;
              }
              .report-print-compact .result-slip-crest {
                width: 40px !important;
                height: 40px !important;
              }
              .report-print-compact .result-slip-crest svg {
                width: 20px !important;
                height: 20px !important;
              }
              .report-print-compact .result-slip-school-name {
                font-size: 12px !important;
                line-height: 1.1 !important;
              }
              .report-print-compact .result-slip-school-meta {
                font-size: 9.5px !important;
                line-height: 1.2 !important;
              }
              .report-print-compact .result-slip-doc-title {
                padding: 4px 14px !important;
              }
              .report-print-compact .result-slip-doc-title h3 {
                font-size: 12px !important;
                margin: 0 !important;
              }
              .report-print-compact .result-slip-doc-title p {
                font-size: 9.5px !important;
                margin-top: 1px !important;
              }
              .report-print-compact .result-slip-body {
                padding: 8px 16px 10px !important;
              }
              .report-print-compact .result-slip-info-grid {
                padding: 6px 12px !important;
                font-size: 10.5px !important;
                gap: 0 !important;
              }
              .report-print-compact .result-slip-info-row {
                padding: 2px 0 !important;
              }
              .report-print-compact .result-slip-table {
                margin-top: 8px !important;
                font-size: 10px !important;
              }
              .report-print-compact .result-slip-table caption {
                font-size: 10px !important;
                margin-bottom: 3px !important;
              }
              .report-print-compact .result-slip-table th,
              .report-print-compact .result-slip-table td {
                padding: 3px 6px !important;
              }
              .report-print-compact .result-slip-summary {
                margin-top: 8px !important;
                gap: 6px !important;
              }
              .report-print-compact .result-slip-summary-box {
                padding: 4px 6px !important;
              }
              .report-print-compact .result-slip-summary-label {
                font-size: 9px !important;
              }
              .report-print-compact .result-slip-summary-value {
                font-size: 13px !important;
                margin-top: 0 !important;
              }
              .report-print-compact .result-slip-remarks {
                margin-top: 8px !important;
                padding: 6px 10px !important;
                font-size: 10px !important;
                min-height: 26px !important;
              }
              .report-print-compact .result-slip-signatures {
                margin-top: 16px !important;
                gap: 24px !important;
                font-size: 10px !important;
              }
              .report-print-compact .result-slip-signature-line {
                margin-top: 16px !important;
                padding-top: 3px !important;
              }
              .report-print-compact .result-slip-footer {
                margin-top: 10px !important;
                padding-top: 6px !important;
                font-size: 8.5px !important;
              }
            }
          `}</style>
          <div className="result-slip-sheet">
            {/* Letterhead — background forced to match the rest of the sheet
                so the whole report reads as one continuous card. */}
            <div className="result-slip-letterhead" style={{ background: '#ffffff' }}>
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
                <p className="result-slip-school-name" style={{ fontSize: '14px' }}>{SCHOOL_NAME}</p>
                <p className="result-slip-school-meta">
                  P.O. Box 000, Mbeya, Tanzania · Tel: +255 000 000 000 · info@school.example
                </p>
              </div>
            </div>

            {/* Document title — same background as the rest of the sheet.
                Both this heading and the school name above are set to the
                same, smaller font size. */}
            <div className="result-slip-doc-title" style={{ background: '#ffffff' }}>
              <h3 style={{ fontSize: '14px' }}>Student Results Report</h3>
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

              {/* Single summary table: every subject registered for this class,
                  including any still missing marks (shown as Incomplete) */}
              {allSubjectRows.length === 0 ? (
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
                    {allSubjectRows.map((s, idx) => (
                      <tr key={s.subject_id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{s.subject_name}</td>
                        <td className="text-right">{s.complete ? Math.round(s.average) : 'Incomplete'}</td>
                        <td>{s.complete ? s.grade || 'Incomplete' : 'Incomplete'}</td>
                        <td>{s.complete ? GRADE_REMARKS[s.grade] : 'Incomplete'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Summary: Subjects Sat / Total Points / Division */}
              {allSubjectRows.length > 0 && (
                <div className="result-slip-summary">
                  <div className="result-slip-summary-box">
                    <p className="result-slip-summary-label">Subjects Sat</p>
                    <p className="result-slip-summary-value">{completedSubjects.length}</p>
                  </div>
                  <div className="result-slip-summary-box">
                    <p className="result-slip-summary-label">Total Points (Best 7)</p>
                    <p className="result-slip-summary-value">{totalPoints}</p>
                  </div>
                  <div className="result-slip-summary-box">
                    <p className="result-slip-summary-label">Division</p>
                    <p className="result-slip-summary-value">
                      {division != null ? `Division ${division}` : 'Division Incomplete'}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
