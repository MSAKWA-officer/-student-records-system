import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { termsApi } from '../terms/termsApi';
import { examsApi } from '../exams/examsApi';
import { classesApi } from '../classes/classesApi';
import { resultsApi } from './resultsApi';
import { exportToExcel } from '../../utils/exportToExcel';

// School letterhead — change these to match your school. (Each printable
// report in this app defines its own letterhead constants the same way;
// see StudentResultSlip.jsx / StudentReportCard.jsx.)
const OFFICE_LINE_1 = "PRESIDENT'S OFFICE";
const OFFICE_LINE_2 = 'REGIONAL ADMINISTRATION AND LOCAL GOVERNMENT';
const REGION_LINE = 'MBEYA CITY, MBEYA';
const SCHOOL_NAME = 'LUPETA SECONDARY SCHOOL';

// Order the division columns/rows are shown in, left to right / top to bottom.
const DIVISIONS = ['I', 'II', 'III', 'IV', '0'];
const SEX_ROWS = [
  { key: 'F', label: 'F' },
  { key: 'M', label: 'M' },
  { key: 'T', label: 'T' },
];

// The backend (resultController.buildDivisionReport) returns division tallies
// as an array — [{ sex: 'F', I, II, III, IV, zero }, ...] — with the "0"
// division stored under the key `zero` (can't use a numeric-looking key
// cleanly). This turns that into a { F: { I, II, III, IV, 0 }, ... } map
// that's easy to read from in the tables below.
function buildDivisionSummaryMap(divisionsBySex) {
  const map = {};
  (divisionsBySex || []).forEach((row) => {
    map[row.sex] = { I: row.I || 0, II: row.II || 0, III: row.III || 0, IV: row.IV || 0, 0: row.zero || 0 };
  });
  return map;
}

// Builds "SUBJECTCODE: GRADE" pairs, comma-separated, in subject-code order —
// this is the compact "Detailed Subjects" cell shown per student, using each
// subject's short CODE rather than its full name.
function detailedSubjectsText(subjects) {
  if (!subjects || subjects.length === 0) return '—';
  return [...subjects]
    .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    .map((s) => `${s.code || '—'}: ${s.grade || '—'}`)
    .join(' , ');
}

function formatGpa(gpa) {
  return gpa == null || Number.isNaN(gpa) ? '—' : gpa.toFixed(4);
}

export default function ClassDivisionReportPage() {
  const { classId: routeClassId } = useParams();
  const [searchParams] = useSearchParams();

  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);

  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [examId, setExamId] = useState(searchParams.get('exam') || '');
  const [classId, setClassId] = useState(routeClassId || searchParams.get('class') || '');
  const [streamId, setStreamId] = useState(searchParams.get('stream') || '');

  const [report, setReport] = useState(null);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');

  // Academic years, defaulting to the current one
  useEffect(() => {
    academicYearsApi
      .getAll()
      .then((res) => {
        setYears(res.data);
        const current = res.data.find((y) => y.is_current) || res.data[0];
        if (current) setAcademicYearId(String(current.id));
      })
      .catch(() => setError('Failed to load academic years.'))
      .finally(() => setLoadingLookups(false));
  }, []);

  // Classes (for the class picker) — loaded once
  useEffect(() => {
    classesApi.getAll().then((res) => setClasses(res.data)).catch(() => {});
  }, []);

  // Terms for the selected year
  useEffect(() => {
    if (!academicYearId) return;
    termsApi.getAll({ academic_year_id: academicYearId }).then((res) => {
      setTerms(res.data);
      const current = res.data.find((t) => t.is_current) || res.data[0];
      setTermId(current ? String(current.id) : '');
    });
  }, [academicYearId]);

  // Exams for the selected term
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

  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === String(classId)),
    [classes, classId]
  );
  const streamsForSelectedClass = selectedClass?.Streams || [];

  const readyToLoad = Boolean(examId && classId);

  useEffect(() => {
    if (!readyToLoad) {
      setReport(null);
      return;
    }
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, classId, streamId]);

  async function loadReport() {
    setLoadingReport(true);
    setError('');
    try {
      const res = await resultsApi.getClassReport({
        exam_id: examId,
        school_class_id: classId,
        stream_id: streamId || undefined,
      });
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load results for this class.');
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  }

  // --- Everything below reads the ACTUAL shape returned by
  // resultController.getClassResultsReport / buildDivisionReport:
  //   { meta: { school_name, region, district, exam_name, year_name, class_name },
  //     registered, sat, absent, incomplete, withheld, no_ca, clean, gpa,
  //     divisionsBySex: [{ sex, I, II, III, IV, zero }, ...],
  //     students: [{ candidate_number, name, sex, class_name, agg, div, subjects: [{code, grade}], absent }],
  //     subjectsPerformance: [{ code, name, reg, sat, pass, gpa, competency }] }

  const meta = report?.meta || {};
  const divisionSummary = useMemo(() => buildDivisionSummaryMap(report?.divisionsBySex), [report]);
  const totalDivision = divisionSummary?.T;

  const className = meta.class_name || selectedClass?.name || '';
  const examName = meta.exam_name || '';
  const yearName = meta.year_name || '';
  const reportTitle = `${className} ${examName} RESULT - ${yearName}`.toUpperCase().replace(/\s+/g, ' ').trim();

  function handleExportExcel() {
    if (!report?.students?.length) return;
    const rows = report.students.map((s) => ({
      'Candidate Number': s.candidate_number,
      'Student Name': s.name,
      Sex: s.sex,
      AGG: s.agg ?? '',
      DIV: s.div ?? '',
      'Detailed Subjects': detailedSubjectsText(s.subjects),
    }));
    const label = `${className || 'Class'}-${examName || 'Results'}`;
    exportToExcel(rows, label.replace(/\s+/g, '-'), 'Results');
  }

  return (
    <div className="p-4">
      {/* Print-only styling, scoped to this page so it doesn't touch other
          pages: hides the whole filter/toolbar block, and strips the report
          sheet's card chrome (border/shadow/background/padding) so the
          printed/PDF page starts right at the "PRESIDENT'S OFFICE..."
          letterhead with nothing above or around it. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .class-division-report-sheet {
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          /* Keep the Examination Centre summary/division/subjects block
             together as its own sheet of paper instead of letting it get
             split across two pages. */
          .exam-centre-section {
            page-break-before: always;
            break-before: page;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Filters / toolbar — hidden when printing */}
      <div className="no-print">
        <h2 className="text-xl font-semibold text-slate-900">Class Division Report</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose the Academic Year, Term, Exam and Class to view the division performance summary and full class
          results, then download it as a PDF or export it to Excel.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Academic Year</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              disabled={loadingLookups}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.year_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Term</label>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              disabled={!academicYearId}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              {terms.length === 0 && <option value="">No terms</option>}
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Exam *</label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              disabled={!termId}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              {exams.length === 0 && <option value="">No exams</option>}
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Class *</label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setStreamId('');
              }}
              disabled={!!routeClassId}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Stream</label>
            <select
              value={streamId}
              onChange={(e) => setStreamId(e.target.value)}
              disabled={streamsForSelectedClass.length === 0}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">All Streams</option>
              {streamsForSelectedClass.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => window.print()}
            disabled={!report?.students?.length}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            Download PDF (Print)
          </button>
          <button
            onClick={handleExportExcel}
            disabled={!report?.students?.length}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Export to Excel
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {!readyToLoad && !error && (
          <p className="mt-6 text-sm text-slate-500">Select an Exam and Class above to view results.</p>
        )}
        {readyToLoad && loadingReport && <p className="mt-6 text-sm text-slate-500">Loading results...</p>}
      </div>

      {/* Printable report */}
      {readyToLoad && !loadingReport && report && (
        <div
          className="class-division-report-sheet mx-auto mt-6 max-w-5xl rounded-lg border border-slate-200 bg-[#eafffb] p-8"
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
        >
          <div className="text-center">
            <p className="font-bold text-slate-900">{OFFICE_LINE_1}</p>
            <p className="font-bold text-slate-900">{OFFICE_LINE_2}</p>
            <p className="font-bold text-slate-900">{REGION_LINE}</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900">{SCHOOL_NAME}</p>
          </div>

          <h3 className="mt-4 text-center text-lg font-extrabold uppercase text-purple-700">{reportTitle}</h3>

          <h4 className="mt-6 text-center text-base font-bold uppercase text-slate-900">Division Performance Summary</h4>

          <table className="mx-auto mt-3 border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-slate-400 bg-sky-200 px-4 py-1.5 font-bold uppercase text-slate-900">
                  Sex
                </th>
                {DIVISIONS.map((d) => (
                  <th key={d} className="border border-slate-400 bg-sky-200 px-4 py-1.5 font-bold text-slate-900">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SEX_ROWS.map((row) => (
                <tr key={row.key} className={row.key === 'M' ? 'bg-slate-100' : 'bg-white'}>
                  <td className="border border-slate-400 px-4 py-1.5 text-center font-medium">{row.label}</td>
                  {DIVISIONS.map((d) => (
                    <td key={d} className="border border-slate-400 px-4 py-1.5 text-center">
                      {divisionSummary?.[row.key]?.[d] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="mt-8 text-base font-bold text-slate-900">
            <span className="uppercase">Student Results</span>{' '}
            <span className="normal-case font-normal">
              ( Total Enrolled: {report.registered ?? report.students?.length ?? 0}, Total Sat: {report.sat ?? 0},
              Total Absent: {report.absent ?? 0}, Total Incomplete: {report.incomplete ?? 0} )
            </span>
          </h4>

          <table className="mt-3 w-full border-collapse text-sm">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '47%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-left font-bold uppercase text-slate-900">
                  Candidate Number
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-left font-bold uppercase text-slate-900">
                  Student Name
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-center font-bold uppercase text-slate-900">
                  Sex
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-center font-bold uppercase text-slate-900">
                  Agg
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-center font-bold uppercase text-slate-900">
                  Div
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-center font-bold uppercase text-slate-900">
                  Detailed Subjects
                </th>
              </tr>
            </thead>
            <tbody>
              {(report.students || []).map((s, idx) => (
                <tr key={s.candidate_number || idx} className={idx % 2 === 1 ? 'bg-sky-50' : 'bg-white'}>
                  <td className="border border-slate-300 px-3 py-2 align-top">{s.candidate_number}</td>
                  <td className="border border-slate-300 px-3 py-2 align-top font-medium">{s.name}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center align-top">{s.sex}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center align-top">{s.agg ?? '—'}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center align-top">{s.div ?? '—'}</td>
                  <td className="border border-slate-300 px-3 py-2 align-top">{detailedSubjectsText(s.subjects)}</td>
                </tr>
              ))}
              {(!report.students || report.students.length === 0) && (
                <tr>
                  <td colSpan="6" className="border border-slate-300 px-3 py-8 text-center text-slate-400">
                    No results to show for the selected class/exam.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* --------------------------------------------------------------
              Examination Centre Overall Performance Summary, Division
              Performance (Detailed) and Subjects Performance — printed
              below the full student results table. Wrapped in its own
              "exam-centre-section" block so that, when printing, this
              whole block starts on a fresh sheet and is kept together
              rather than being split across two pages.
          --------------------------------------------------------------- */}
          <div className="exam-centre-section">
          <h4 className="mt-10 text-center text-base font-bold uppercase text-slate-900">
            Examination Centre Overall Performance Summary
          </h4>

          <table className="mx-auto mt-3 border-collapse text-sm">
            <tbody>
              <tr>
                <td className="border border-slate-400 bg-sky-200 px-4 py-1.5 text-right font-bold uppercase text-slate-900">
                  Region
                </td>
                <td className="border border-slate-400 bg-white px-4 py-1.5">{meta.region || '—'}</td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-sky-200 px-4 py-1.5 text-right font-bold uppercase text-slate-900">
                  District
                </td>
                <td className="border border-slate-400 bg-white px-4 py-1.5">{meta.district || '—'}</td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-sky-200 px-4 py-1.5 text-right font-bold uppercase text-slate-900">
                  Class
                </td>
                <td className="border border-slate-400 bg-white px-4 py-1.5">{className || '—'}</td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-sky-200 px-4 py-1.5 text-right font-bold uppercase text-slate-900">
                  Examination
                </td>
                <td className="border border-slate-400 bg-white px-4 py-1.5">{examName || '—'}</td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-sky-200 px-4 py-1.5 text-right font-bold uppercase text-slate-900">
                  Year
                </td>
                <td className="border border-slate-400 bg-white px-4 py-1.5">{yearName || '—'}</td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-sky-200 px-4 py-1.5 text-right font-bold uppercase text-slate-900">
                  Examination Centre GPA
                </td>
                <td className="border border-slate-400 bg-white px-4 py-1.5 font-semibold">{formatGpa(report.gpa)}</td>
              </tr>
            </tbody>
          </table>

          {/* --------------------------------------------------------------
              Examination Centre Division Performance (Detailed)
          --------------------------------------------------------------- */}
          <h4 className="mt-10 text-center text-base font-bold uppercase text-slate-900">
            Examination Centre Division Performance (Detailed)
          </h4>

          <div className="overflow-x-auto">
            <table className="mt-3 w-full table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  {['Regist', 'Absent', 'Sat', 'Withheld', 'No-CA', 'Clean', 'Div I', 'Div II', 'Div III', 'Div IV', 'Div 0', 'Inc'].map(
                    (h) => (
                      <th
                        key={h}
                        className="border border-slate-400 bg-sky-200 px-2 py-1.5 font-bold uppercase text-slate-900"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white text-center">
                  <td className="border border-slate-400 px-2 py-1.5">{report.registered ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{report.absent ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{report.sat ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{report.withheld ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{report.no_ca ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{report.clean ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{totalDivision?.I ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{totalDivision?.II ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{totalDivision?.III ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{totalDivision?.IV ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{totalDivision?.[0] ?? 0}</td>
                  <td className="border border-slate-400 px-2 py-1.5">{report.incomplete ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* --------------------------------------------------------------
              Examination Centre Subjects Performance
          --------------------------------------------------------------- */}
          <h4 className="mt-10 text-center text-base font-bold uppercase text-slate-900">
            Examination Centre Subjects Performance
          </h4>

          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-left font-bold uppercase text-slate-900">
                  Code
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-left font-bold uppercase text-slate-900">
                  Subject Name
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-center font-bold uppercase text-slate-900">
                  Reg
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-center font-bold uppercase text-slate-900">
                  Sat
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-center font-bold uppercase text-slate-900">
                  Pass
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-center font-bold uppercase text-slate-900">
                  Gpa
                </th>
                <th className="border border-slate-400 bg-sky-200 px-3 py-2 text-left font-bold uppercase text-slate-900">
                  Competency Level
                </th>
              </tr>
            </thead>
            <tbody>
              {(report.subjectsPerformance || []).map((sp, idx) => (
                <tr key={sp.code || idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="border border-slate-300 px-3 py-2">{sp.code}</td>
                  <td className="border border-slate-300 px-3 py-2">{sp.name}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{sp.reg ?? 0}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{sp.sat ?? 0}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{sp.pass ?? 0}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center">{formatGpa(sp.gpa)}</td>
                  <td className="border border-slate-300 px-3 py-2">{sp.competency || '—'}</td>
                </tr>
              ))}
              {(!report.subjectsPerformance || report.subjectsPerformance.length === 0) && (
                <tr>
                  <td colSpan="7" className="border border-slate-300 px-3 py-8 text-center text-slate-400">
                    No subject performance data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
