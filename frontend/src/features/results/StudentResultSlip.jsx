import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { studentsApi } from '../students/studentsApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';
import { termsApi } from '../terms/termsApi';
import { examsApi } from '../exams/examsApi';
import { resultsApi } from './resultsApi';

const DIVISION_LABEL = {
  I: 'Division I',
  II: 'Division II',
  III: 'Division III',
  IV: 'Division IV',
  0: 'Division 0',
};

const GRADE_REMARKS = {
  A: 'Excellent',
  B: 'Very Good',
  C: 'Good',
  D: 'Satisfactory',
  F: 'Fail',
};

function gradeRemark(grade) {
  return GRADE_REMARKS[grade] || '—';
}

const SCHOOL_NAME = 'Student Records System School';

export default function StudentResultSlip() {
  const { id } = useParams(); // student id
  const [searchParams] = useSearchParams();
  const location = useLocation();
  // If we arrived here from a class listing (e.g. Result Slips > Form 1),
  // go back there instead of always landing on the student's profile page.
  const backTo = location.state?.from || `/dashboard/students/${id}`;
  const backLabel = location.state?.from ? '← Back' : '← Back to Student';

  // Optional deep-link preselection, e.g. coming from the class-by-class
  // Result Slips page: /students/:id/result-slip?year=1&term=2&exam=3
  const initialYear = searchParams.get('year') || '';
  const initialTerm = searchParams.get('term') || '';
  const initialExam = searchParams.get('exam') || '';

  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [exams, setExams] = useState([]);

  const [academicYearId, setAcademicYearId] = useState(initialYear);
  const [termId, setTermId] = useState(initialTerm);
  const [examId, setExamId] = useState(initialExam);

  const [student, setStudent] = useState(null);
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Student header info (name, admission number) shown above the table
  useEffect(() => {
    studentsApi.getById(id).then((res) => setStudent(res.data)).catch(() => {});
  }, [id]);

  // Academic years, defaulting to the current one unless preselected via URL
  useEffect(() => {
    academicYearsApi.getAll().then((res) => {
      setYears(res.data);
      if (initialYear) return;
      const current = res.data.find((y) => y.is_current) || res.data[0];
      if (current) setAcademicYearId(String(current.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Terms for the selected year
  useEffect(() => {
    if (!academicYearId) return;
    termsApi.getAll({ academic_year_id: academicYearId }).then((res) => {
      setTerms(res.data);
      if (initialTerm && res.data.some((t) => String(t.id) === initialTerm)) {
        setTermId(initialTerm);
        return;
      }
      const current = res.data.find((t) => t.is_current) || res.data[0];
      setTermId(current ? String(current.id) : '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId]);

  // Exams for the selected term (e.g. Mid-Term, Mock, Final)
  useEffect(() => {
    if (!termId) {
      setExams([]);
      setExamId('');
      return;
    }
    examsApi.getAll({ term_id: termId }).then((res) => {
      setExams(res.data);
      if (initialExam && res.data.some((e) => String(e.id) === initialExam)) {
        setExamId(initialExam);
        return;
      }
      setExamId(res.data[0] ? String(res.data[0].id) : '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId]);

  // Fetch the result slip whenever the chosen exam changes
  useEffect(() => {
    if (!examId) {
      setSlip(null);
      return;
    }
    setLoading(true);
    setError('');
    resultsApi
      .getExamSlip({ student_id: id, exam_id: examId })
      .then((res) => setSlip(res.data))
      .catch((err) => {
        setSlip(null);
        setError(err.response?.data?.message || 'Failed to load results for this exam.');
      })
      .finally(() => setLoading(false));
  }, [id, examId]);

  const enrollment = (student?.Enrollments || [])[0];
  const className = enrollment?.SchoolClass?.name || '—';
  const streamName = enrollment?.Stream?.name;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div>
      <div className="print:hidden">
        <Link to={backTo} className="sims-link text-sm">
          {backLabel}
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">Exam Result Slip</h2>

          <div className="flex flex-wrap items-end gap-3">
            <Field label="Academic Year">
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                className="sims-select"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.year_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Term">
              <select value={termId} onChange={(e) => setTermId(e.target.value)} className="sims-select">
                {terms.length === 0 && <option value="">No terms</option>}
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Exam">
              <select value={examId} onChange={(e) => setExamId(e.target.value)} className="sims-select">
                {exams.length === 0 && <option value="">No exams</option>}
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>

            {slip && (
              <button onClick={() => window.print()} className="sims-btn sims-btn-primary">
                Print
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && slip && (
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
              <h3>Official Exam Result Slip</h3>
              <p>
                {slip.exam.name} · {slip.exam.term_name} · {slip.exam.academic_year_name}
              </p>
            </div>

            <div className="result-slip-body">
              {/* Student information */}
              <div className="result-slip-info-grid">
                <div className="result-slip-info-row">
                  <span className="result-slip-info-label">Full Name</span>
                  <span className="result-slip-info-value">{slip.student.full_name}</span>
                </div>
                <div className="result-slip-info-row">
                  <span className="result-slip-info-label">Admission Number</span>
                  <span className="result-slip-info-value">{slip.student.admission_number}</span>
                </div>
                <div className="result-slip-info-row">
                  <span className="result-slip-info-label">Class</span>
                  <span className="result-slip-info-value">
                    {className}
                    {streamName ? ` (${streamName})` : ''}
                  </span>
                </div>
                <div className="result-slip-info-row">
                  <span className="result-slip-info-label">Date Issued</span>
                  <span className="result-slip-info-value">{today}</span>
                </div>
              </div>

              {/* Results table */}
              {slip.subjects.length === 0 ? (
                <p className="mt-8 text-center text-sm text-slate-400">
                  No results recorded for this student in this exam yet.
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
                    {slip.subjects.map((s, idx) => (
                      <tr key={s.subject_id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{s.subject_name}</td>
                        <td className="text-right">
                          {s.marks_obtained}/{s.max_marks}
                        </td>
                        <td>{s.grade || '—'}</td>
                        <td>{gradeRemark(s.grade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Summary */}
              {slip.subjects.length > 0 && (
                <div className="result-slip-summary">
                  <div className="result-slip-summary-box">
                    <p className="result-slip-summary-label">Subjects Sat</p>
                    <p className="result-slip-summary-value">{slip.subjects.length}</p>
                  </div>
                  <div className="result-slip-summary-box">
                    <p className="result-slip-summary-label">Total Points</p>
                    <p className="result-slip-summary-value">{slip.total_points ?? '—'}</p>
                  </div>
                  <div className="result-slip-summary-box">
                    <p className="result-slip-summary-label">Division</p>
                    <p className="result-slip-summary-value">
                      {slip.division != null ? DIVISION_LABEL[slip.division] : '—'}
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
                This is an official computer-generated result slip issued by {SCHOOL_NAME}. Any alteration
                renders it invalid.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
