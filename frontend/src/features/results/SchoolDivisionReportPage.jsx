import { useEffect, useMemo, useState } from 'react';
import { Printer, School } from 'lucide-react';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { termsApi } from '../terms/termsApi';
import { examsApi } from '../exams/examsApi';
import { resultsApi } from './resultsApi';

// ---------------------------------------------------------------------------
// Whole-school, NECTA-style results report: Division Performance Summary,
// per-student results (with DETAILED SUBJECTS shown by subject CODE), and the
// Examination Centre Overall / Subjects Performance summaries — matching the
// printed format used for class result sheets, but aggregated across every
// class/stream in the school for the selected exam.
//
// Expects a backend endpoint: GET /results/school-report?exam_id=...
// returning:
// {
//   meta: { school_name, region, district, exam_name, year_name },
//   registered, absent, sat, withheld, no_ca, clean, incomplete,
//   divisionsBySex: [{ sex: 'F', I, II, III, IV, zero }, { sex: 'M', ... }, { sex: 'T', ... }],
//   gpa,
//   students: [
//     { candidate_number, name, sex, class_name, agg, div, subjects: [{ code, grade }], absent: false }
//   ],
//   subjectsPerformance: [
//     { code, name, reg, sat, pass, gpa, competency }
//   ]
// }
// (resultsApi.getSchoolReport and the matching backend controller/route still
// need to be added — this component is the view/print page only.)
// ---------------------------------------------------------------------------

export default function SchoolDivisionReportPage() {
  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [exams, setExams] = useState([]);

  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [examId, setExamId] = useState('');

  const [report, setReport] = useState(null);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (!academicYearId) return;
    termsApi.getAll({ academic_year_id: academicYearId }).then((res) => {
      setTerms(res.data);
      const current = res.data.find((t) => t.is_current) || res.data[0];
      setTermId(current ? String(current.id) : '');
    });
  }, [academicYearId]);

  useEffect(() => {
    if (!termId) {
      setExams([]);
      setExamId('');
      return;
    }
    examsApi.getAll({ term_id: termId }).then((res) => {
      setExams(res.data);
      setExamId(res.data[0] ? String(res.data[0].id) : '');
    });
  }, [termId]);

  useEffect(() => {
    if (!examId) {
      setReport(null);
      return;
    }
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function loadReport() {
    setLoadingReport(true);
    setError('');
    try {
      const res = await resultsApi.getSchoolReport({ exam_id: examId });
      setReport(res.data);
    } catch (err) {
      setError('Failed to load the school results report for this exam.');
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  }

  const subjectColumns = useMemo(() => {
    if (!report?.students) return [];
    const codes = new Set();
    report.students.forEach((s) => (s.subjects || []).forEach((sub) => codes.add(sub.code)));
    return Array.from(codes).sort();
  }, [report]);

  function detailedSubjects(student) {
    if (student.absent) return 'Absent';
    return (student.subjects || [])
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((s) => `${s.code}: ${s.grade}`)
      .join(' , ');
  }

  const divRow = (row) => (
    <tr key={row.sex}>
      <td className="border border-slate-300 px-2 py-1 font-medium">{row.sex}</td>
      <td className="border border-slate-300 px-2 py-1 text-center">{row.I}</td>
      <td className="border border-slate-300 px-2 py-1 text-center">{row.II}</td>
      <td className="border border-slate-300 px-2 py-1 text-center">{row.III}</td>
      <td className="border border-slate-300 px-2 py-1 text-center">{row.IV}</td>
      <td className="border border-slate-300 px-2 py-1 text-center">{row.zero}</td>
    </tr>
  );

  return (
    <div className="p-4">
      <div className="print:hidden">
        <div className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <School size={20} /> School Results Report
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Whole-school division and subject performance report, in the official examination-centre format.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Academic Year</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              disabled={loadingLookups}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.year_name}</option>
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
                <option key={t.id} value={t.id}>{t.name}</option>
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
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => window.print()}
              disabled={!report}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Printer size={15} /> Print / Download
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {!examId && !error && <p className="mt-6 text-sm text-slate-500">Select an Exam above to generate the school report.</p>}
        {examId && loadingReport && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      </div>

      {report && !loadingReport && (
        <div className="mx-auto mt-6 max-w-[1100px] bg-white p-6 pb-10 text-[13px] text-slate-900 print:mt-0 print:max-w-full print:p-0 print:pb-6 print:text-[10px]">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide">President's Office</p>
            <p className="text-xs uppercase tracking-wide">Regional Administration and Local Government</p>
            <p className="text-xs uppercase">{report.meta?.region} {report.meta?.district ? `, ${report.meta.district}` : ''}</p>
            <p className="mt-1 text-base font-bold uppercase">{report.meta?.school_name}</p>
            <p className="text-sm font-semibold uppercase">{report.meta?.exam_name} — {report.meta?.year_name}</p>
            <p className="text-sm font-bold uppercase underline">Division Performance Summary</p>
          </div>

          <table className="mt-3 w-full border-collapse text-center">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-1">SEX</th>
                <th className="border border-slate-300 px-2 py-1">I</th>
                <th className="border border-slate-300 px-2 py-1">II</th>
                <th className="border border-slate-300 px-2 py-1">III</th>
                <th className="border border-slate-300 px-2 py-1">IV</th>
                <th className="border border-slate-300 px-2 py-1">0</th>
              </tr>
            </thead>
            <tbody>{(report.divisionsBySex || []).map(divRow)}</tbody>
          </table>

          <div className="h-16 print:h-12" />

          <p className="text-xs">
            STUDENT RESULTS ( Total Enrolled: {report.registered ?? 0}, Total Sat: {report.sat ?? 0}, Total Absent: {report.absent ?? 0}, Total Incomplete: {report.incomplete ?? 0} )
          </p>

          <table className="mt-2 w-full border-collapse text-left text-[11px] print:text-[8px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-1">CANDIDATE NUMBER</th>
                <th className="border border-slate-300 px-2 py-1">STUDENT NAME</th>
                <th className="border border-slate-300 px-2 py-1">CLASS</th>
                <th className="border border-slate-300 px-2 py-1 text-center">SEX</th>
                <th className="border border-slate-300 px-2 py-1 text-center">AGG</th>
                <th className="border border-slate-300 px-2 py-1 text-center">DIV</th>
                <th className="border border-slate-300 px-2 py-1">DETAILED SUBJECTS</th>
              </tr>
            </thead>
            <tbody>
              {(report.students || []).map((s) => (
                <tr key={s.candidate_number}>
                  <td className="border border-slate-300 px-2 py-1">{s.candidate_number}</td>
                  <td className="border border-slate-300 px-2 py-1 font-medium">{s.name}</td>
                  <td className="border border-slate-300 px-2 py-1">{s.class_name}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{s.sex}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{s.absent ? 'X' : s.agg}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{s.absent ? 'X' : s.div}</td>
                  <td className="border border-slate-300 px-2 py-1">{detailedSubjects(s)}</td>
                </tr>
              ))}
              {(report.students || []).length === 0 && (
                <tr>
                  <td colSpan="7" className="border border-slate-300 px-2 py-4 text-center text-slate-400">
                    No students found for this exam.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="h-16 print:h-12" />

          <p className="text-center text-sm font-bold uppercase underline">Examination Centre Overall Performance Summary</p>
          <div className="mt-3 flex flex-col items-start gap-y-1 text-left text-xs">
            <p>REGION: {report.meta?.region}</p>
            <p>EXAMINATION: {report.meta?.exam_name}</p>
            <p>DISTRICT: {report.meta?.district}</p>
            <p>YEAR: {report.meta?.year_name}</p>
            <p className="font-semibold">EXAMINATION CENTRE GPA: {Number(report.gpa ?? 0).toFixed(4)}</p>
          </div>

          <table className="mt-4 w-full border-collapse text-center text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-1">REGIST</th>
                <th className="border border-slate-300 px-2 py-1">ABSENT</th>
                <th className="border border-slate-300 px-2 py-1">SAT</th>
                <th className="border border-slate-300 px-2 py-1">WITHHELD</th>
                <th className="border border-slate-300 px-2 py-1">NO-CA</th>
                <th className="border border-slate-300 px-2 py-1">CLEAN</th>
                <th className="border border-slate-300 px-2 py-1">DIV I</th>
                <th className="border border-slate-300 px-2 py-1">DIV II</th>
                <th className="border border-slate-300 px-2 py-1">DIV III</th>
                <th className="border border-slate-300 px-2 py-1">DIV IV</th>
                <th className="border border-slate-300 px-2 py-1">DIV 0</th>
                <th className="border border-slate-300 px-2 py-1">INC</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 px-2 py-1">{report.registered ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.absent ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.sat ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.withheld ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.no_ca ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.clean ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.divisionsBySex?.find((r) => r.sex === 'T')?.I ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.divisionsBySex?.find((r) => r.sex === 'T')?.II ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.divisionsBySex?.find((r) => r.sex === 'T')?.III ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.divisionsBySex?.find((r) => r.sex === 'T')?.IV ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.divisionsBySex?.find((r) => r.sex === 'T')?.zero ?? 0}</td>
                <td className="border border-slate-300 px-2 py-1">{report.incomplete ?? 0}</td>
              </tr>
            </tbody>
          </table>

          <div className="h-16 print:h-12" />

          <p className="text-center text-sm font-bold uppercase underline">Examination Centre Subjects Performance</p>
          <table className="mt-2 w-full border-collapse text-left text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-1">CODE</th>
                <th className="border border-slate-300 px-2 py-1">SUBJECT NAME</th>
                <th className="border border-slate-300 px-2 py-1 text-center">REG</th>
                <th className="border border-slate-300 px-2 py-1 text-center">SAT</th>
                <th className="border border-slate-300 px-2 py-1 text-center">PASS</th>
                <th className="border border-slate-300 px-2 py-1 text-center">GPA</th>
                <th className="border border-slate-300 px-2 py-1">COMPETENCY LEVEL</th>
              </tr>
            </thead>
            <tbody>
              {(report.subjectsPerformance || []).map((sp) => (
                <tr key={sp.code}>
                  <td className="border border-slate-300 px-2 py-1">{sp.code}</td>
                  <td className="border border-slate-300 px-2 py-1">{sp.name}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{sp.reg}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{sp.sat}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{sp.pass}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{Number(sp.gpa ?? 0).toFixed(4)}</td>
                  <td className="border border-slate-300 px-2 py-1">{sp.competency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
