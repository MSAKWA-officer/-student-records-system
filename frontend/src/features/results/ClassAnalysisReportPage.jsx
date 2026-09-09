import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { classesApi } from '../classes/classesApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { termsApi } from '../terms/termsApi';
import { examsApi } from '../exams/examsApi';

// NOTE ON WIRING: this page calls GET /results/class-analysis directly
// through the shared `api` client (not resultsApi.js), so it doesn't
// require any change to that file. Once the backend route exists, this
// page works as-is. Expected response shape:
//
// {
//   meta: {
//     school_name, region_line,      // e.g. "MBEYA CITY, MBEYA"
//     class_name, exam_name, academic_year, generated_at,
//   },
//   divisionSummary: [
//     { sex: 'F', divisions: { I, II, III, IV, '0' } },
//     { sex: 'M', divisions: { I, II, III, IV, '0' } },
//     { sex: 'TOTAL', divisions: { I, II, III, IV, '0' } },
//   ],
//   topBest: [ { rank, student_name, class_name, points, division }, ... ],   // up to 10
//   topLowest: [ { rank, student_name, class_name, points, division }, ... ], // up to 10
//   subjectPerformance: [
//     {
//       subject_name,
//       rows: [
//         { sex: 'F', A, B, C, D, F, total },
//         { sex: 'M', A, B, C, D, F, total },
//         { sex: 'T', A, B, C, D, F, total },
//       ],
//     }, ...
//   ],
// }

const GOVERNMENT_HEADER = [
  'THE UNITED REPUBLIC OF TANZANIA',
  "PRIME MINISTER'S OFFICE - REGIONAL ADMINISTRATION AND LOCAL GOVERNMENT",
];
const DIVISION_COLUMNS = ['I', 'II', 'III', 'IV', '0'];

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function ClassAnalysisReportPage() {
  const [searchParams] = useSearchParams();

  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [exams, setExams] = useState([]);

  const [classId, setClassId] = useState(searchParams.get('class_id') || '');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [examId, setExamId] = useState(searchParams.get('exam_id') || '');

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Classes for the dropdown.
  useEffect(() => {
    classesApi.getAll().then((res) => setClasses(res.data));
  }, []);

  // Academic years, defaulting to the current one.
  useEffect(() => {
    academicYearsApi.getAll().then((res) => {
      setYears(res.data);
      const current = res.data.find((y) => y.is_current) || res.data[0];
      if (current) setAcademicYearId(String(current.id));
    });
  }, []);

  // Terms for the selected year, defaulting to the current one.
  useEffect(() => {
    if (!academicYearId) return;
    termsApi.getAll({ academic_year_id: academicYearId }).then((res) => {
      setTerms(res.data);
      const current = res.data.find((t) => t.is_current) || res.data[0];
      setTermId(current ? String(current.id) : '');
    });
  }, [academicYearId]);

  // Exams for the selected term.
  useEffect(() => {
    if (!termId) {
      setExams([]);
      return;
    }
    examsApi.getAll({ term_id: termId }).then((res) => {
      setExams(res.data);
      if (!examId || !res.data.some((ex) => String(ex.id) === String(examId))) {
        setExamId(res.data[0] ? String(res.data[0].id) : '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId]);

  // Fetch the class analysis whenever class or exam changes.
  useEffect(() => {
    if (!classId || !examId) {
      setReport(null);
      return;
    }
    setLoading(true);
    setError('');
    api
      .get('/results/class-analysis', { params: { class_id: classId, exam_id: examId } })
      .then((res) => setReport(res.data))
      .catch((err) => {
        setReport(null);
        setError(err.response?.data?.message || 'Failed to load the class analysis for this exam.');
      })
      .finally(() => setLoading(false));
  }, [classId, examId]);

  const divisionRows = useMemo(() => {
    const bySex = new Map((report?.divisionSummary || []).map((r) => [r.sex, r.divisions || {}]));
    return ['F', 'M', 'TOTAL'].map((sex) => ({ sex, divisions: bySex.get(sex) || {} }));
  }, [report]);

  return (
    <div>
      <div className="print:hidden">
        <Link to="/dashboard/reports" className="sims-link text-sm">
          ← Back to Reports
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">Class Analysis Report</h2>

          <div className="flex flex-wrap items-end gap-3">
            <Field label="Class">
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="sims-select">
                <option value="">-- Select Class --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Academic Year">
              <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} className="sims-select">
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.year_name}</option>
                ))}
              </select>
            </Field>

            <Field label="Term">
              <select value={termId} onChange={(e) => setTermId(e.target.value)} className="sims-select">
                {terms.length === 0 && <option value="">No terms</option>}
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Exam">
              <select value={examId} onChange={(e) => setExamId(e.target.value)} className="sims-select">
                {exams.length === 0 && <option value="">No exams</option>}
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </Field>

            {report && (
              <button onClick={() => window.print()} className="sims-btn sims-btn-primary">
                Download / Print
              </button>
            )}
          </div>
        </div>
      </div>

      {!classId && !examId && (
        <p className="mt-6 text-sm text-slate-500">Select a Class and an Exam above to generate the report.</p>
      )}
      {loading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && report && (
        <div className="class-analysis mt-6">
          <div className="class-analysis-sheet">
            {/* Government / school header */}
            <div className="class-analysis-header">
              {GOVERNMENT_HEADER.map((line) => (
                <p key={line} className="class-analysis-gov-line">{line}</p>
              ))}
              {report.meta?.region_line && (
                <p className="class-analysis-gov-line">{report.meta.region_line}</p>
              )}
              <p className="class-analysis-school-name">
                {report.meta?.school_name} {report.meta?.academic_year ? `- ${report.meta.academic_year}` : ''}
              </p>
              <p className="class-analysis-exam-name">
                {report.meta?.class_name ? `${report.meta.class_name} ` : ''}
                {report.meta?.exam_name} RESULTS
              </p>
            </div>

            <div className="class-analysis-body">
              {/* Division Performance Summary */}
              <table className="class-analysis-table">
                <caption>Division Performance Summary</caption>
                <thead>
                  <tr>
                    <th>Sex</th>
                    {DIVISION_COLUMNS.map((d) => (
                      <th key={d} className="text-right">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {divisionRows.map((row) => (
                    <tr key={row.sex}>
                      <td style={{ fontWeight: 600 }}>{row.sex}</td>
                      {DIVISION_COLUMNS.map((d) => (
                        <td key={d} className="text-right">{row.divisions[d] ?? 0}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Top 10 Best */}
              <table className="class-analysis-table" style={{ marginTop: '20px' }}>
                <caption>Top 10 Best Performing Students</caption>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th style={{ textAlign: 'left' }}>Student Name</th>
                    <th style={{ textAlign: 'left' }}>Class</th>
                    <th className="text-right">Points</th>
                    <th>Division</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.topBest || []).map((s) => (
                    <tr key={s.rank}>
                      <td>{s.rank}</td>
                      <td style={{ textAlign: 'left', fontWeight: 600 }}>{s.student_name}</td>
                      <td style={{ textAlign: 'left' }}>{s.class_name}</td>
                      <td className="text-right">{s.points}</td>
                      <td>{s.division}</td>
                    </tr>
                  ))}
                  {(!report.topBest || report.topBest.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#8a9490' }}>No results recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Top 10 Lowest */}
              <table className="class-analysis-table" style={{ marginTop: '20px' }}>
                <caption>Top 10 Lowest Performing Students</caption>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th style={{ textAlign: 'left' }}>Student Name</th>
                    <th style={{ textAlign: 'left' }}>Class</th>
                    <th className="text-right">Points</th>
                    <th>Division</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.topLowest || []).map((s) => (
                    <tr key={s.rank}>
                      <td>{s.rank}</td>
                      <td style={{ textAlign: 'left', fontWeight: 600 }}>{s.student_name}</td>
                      <td style={{ textAlign: 'left' }}>{s.class_name}</td>
                      <td className="text-right">{s.points}</td>
                      <td>{s.division}</td>
                    </tr>
                  ))}
                  {(!report.topLowest || report.topLowest.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#8a9490' }}>No results recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Subject Performance Summary */}
              <table className="class-analysis-table class-analysis-subject-table" style={{ marginTop: '20px' }}>
                <caption>Subject Performance Summary</caption>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Subject</th>
                    <th>Sex</th>
                    <th className="text-right">A</th>
                    <th className="text-right">B</th>
                    <th className="text-right">C</th>
                    <th className="text-right">D</th>
                    <th className="text-right">F</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.subjectPerformance || []).map((subj) => (
                    subj.rows.map((row, idx) => (
                      <tr key={`${subj.subject_name}-${row.sex}`}>
                        {idx === 0 && (
                          <td
                            rowSpan={subj.rows.length}
                            style={{ textAlign: 'left', fontWeight: 700, verticalAlign: 'top' }}
                          >
                            {subj.subject_name}
                          </td>
                        )}
                        <td style={{ fontWeight: row.sex === 'T' ? 700 : 400 }}>{row.sex}</td>
                        <td className="text-right">{row.A ?? 0}</td>
                        <td className="text-right">{row.B ?? 0}</td>
                        <td className="text-right">{row.C ?? 0}</td>
                        <td className="text-right">{row.D ?? 0}</td>
                        <td className="text-right">{row.F ?? 0}</td>
                        <td className="text-right" style={{ fontWeight: row.sex === 'T' ? 700 : 400 }}>
                          {row.total ?? 0}
                        </td>
                      </tr>
                    ))
                  ))}
                  {(!report.subjectPerformance || report.subjectPerformance.length === 0) && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: '#8a9490' }}>No subjects recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <p className="class-analysis-footer">
                Report Generated by: {report.meta?.school_name} on {report.meta?.generated_at}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Print-specific styling, scoped to this page so no shared CSS file
          needs to change. The app shell (header/sidebar/breadcrumb) is
          already hidden on print by the global stylesheet. */}
      <style>{`
        .class-analysis {
          font-family: 'Times New Roman', Times, serif;
          color: #1a1a1a;
        }
        .class-analysis-sheet {
          margin: 0 auto;
          background: #fff;
          max-width: 1000px;
          border: 1.5px solid #0b1f4d;
        }
        .class-analysis-header {
          border-bottom: 2px solid #0b1f4d;
          padding: 16px 24px;
          text-align: center;
          background: linear-gradient(180deg, #f4fbf9 0%, #ffffff 100%);
        }
        .class-analysis-gov-line {
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.3px;
          color: #0b1f4d;
          text-transform: uppercase;
          line-height: 1.4;
        }
        .class-analysis-school-name {
          margin-top: 6px;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #0b1f4d;
          text-transform: uppercase;
        }
        .class-analysis-exam-name {
          font-size: 13px;
          font-weight: 600;
          color: #3f4a48;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .class-analysis-body {
          padding: 22px 24px 28px;
        }
        .class-analysis-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }
        .class-analysis-table caption {
          caption-side: top;
          text-align: left;
          font-weight: 700;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0b1f4d;
          margin-bottom: 6px;
        }
        .class-analysis-table th,
        .class-analysis-table td {
          border: 1px solid #b9c4c0;
          padding: 5px 8px;
          text-align: center;
        }
        .class-analysis-table .text-right {
          text-align: right;
        }
        .class-analysis-table thead th {
          background-color: #0b3d91;
          color: #ffffff;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-size: 11px;
        }
        .class-analysis-table tbody tr:nth-child(even) {
          background-color: #f6faf9;
        }
        .class-analysis-footer {
          margin-top: 24px;
          border-top: 1px solid #d7dedb;
          padding-top: 10px;
          text-align: center;
          font-size: 10.5px;
          color: #8a9490;
          font-style: italic;
        }
        @media print {
          .class-analysis-sheet {
            border: none !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
