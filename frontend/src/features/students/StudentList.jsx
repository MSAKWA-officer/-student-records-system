import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Search,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Users,
  UploadCloud,
  Download,
  X,
  Eye,
} from 'lucide-react';
import { studentsApi } from './studentsApi';
import { useAuth } from '../../context/AuthContext';

const PAGE_SIZE = 20;

// Column headers accepted in the uploaded Excel file, and the student field
// each one maps to. Matching is case-insensitive and ignores spaces/underscores,
// so "Admission Number", "admission_number" and "ADMISSION NUMBER" all work.
const TEMPLATE_COLUMNS = [
  { header: 'Admission Number', field: 'admission_number', required: true },
  { header: 'First Name', field: 'first_name', required: true },
  { header: 'Middle Name', field: 'middle_name', required: false },
  { header: 'Last Name', field: 'last_name', required: true },
  { header: 'Gender (Male/Female)', field: 'gender', required: true },
  { header: 'Date of Birth (YYYY-MM-DD)', field: 'date_of_birth', required: false },
  { header: 'Admission Date (YYYY-MM-DD)', field: 'admission_date', required: false },
  { header: 'Guardian Name', field: 'guardian_name', required: false },
  { header: 'Guardian Phone', field: 'guardian_phone', required: false },
  { header: 'Guardian Relationship', field: 'guardian_relationship', required: false },
  { header: 'Address', field: 'address', required: false },
];

function normalizeKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Build a lookup from normalized header text -> student field name, so the
// uploaded sheet's headers don't have to match TEMPLATE_COLUMNS exactly.
const HEADER_TO_FIELD = TEMPLATE_COLUMNS.reduce((map, col) => {
  map[normalizeKey(col.header)] = col.field;
  map[normalizeKey(col.field)] = col.field;
  return map;
}, {});

function toDateString(value) {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value)) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

// Turns one raw row object (as read from the sheet, keyed by whatever headers
// the file used) into a clean student payload keyed by our API's field names.
function mapRowToStudent(row) {
  const student = {};
  Object.entries(row).forEach(([rawKey, rawValue]) => {
    const field = HEADER_TO_FIELD[normalizeKey(rawKey)];
    if (!field) return;
    if (field === 'date_of_birth' || field === 'admission_date') {
      student[field] = toDateString(rawValue);
    } else if (field === 'gender') {
      const g = String(rawValue || '').trim().toLowerCase();
      student[field] = g.startsWith('f') ? 'female' : 'male';
    } else {
      student[field] = String(rawValue ?? '').trim();
    }
  });
  return student;
}

export default function StudentList() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const fileInputRef = useRef(null);

  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null); // { added, failed: [{row, name, message}] }

  // Debounce the search box so we don't fire a request on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      fetchStudents(1);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  useEffect(() => {
    fetchStudents(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function fetchStudents(targetPage) {
    setLoading(true);
    setError('');
    try {
      const params = { page: targetPage, limit: PAGE_SIZE };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      const res = await studentsApi.getAll(params);
      setStudents(res.data.data || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      setError('Failed to load students.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;
    try {
      await studentsApi.remove(id);
      fetchStudents(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete student.');
    }
  }

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  function studentClassLabel(s) {
    const enrollment = (s.Enrollments || [])[0];
    if (!enrollment) return '—';
    const className = enrollment.SchoolClass?.name;
    const streamName = enrollment.Stream?.name;
    if (!className) return '—';
    return streamName ? `${className} (${streamName})` : className;
  }

  function downloadTemplate() {
    const sampleRow = {};
    TEMPLATE_COLUMNS.forEach((col) => {
      sampleRow[col.header] = '';
    });
    const worksheet = XLSX.utils.json_to_sheet([sampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, 'student-upload-template.xlsx');
  }

  function handleUploadClick() {
    setUploadSummary(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    setUploading(true);
    setUploadSummary(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        setUploadSummary({ added: 0, failed: [], empty: true });
        return;
      }

      let added = 0;
      const failed = [];

      // Uploaded one at a time (not in parallel) so admission-number
      // duplicate checks on the server stay reliable and errors map
      // clearly back to the row that caused them.
      for (let i = 0; i < rows.length; i++) {
        const student = mapRowToStudent(rows[i]);
        const rowLabel = student.admission_number || studentName(student) || `Row ${i + 2}`;
        if (!student.admission_number || !student.first_name || !student.last_name) {
          failed.push({ row: i + 2, name: rowLabel, message: 'Missing a required field (admission number, first or last name).' });
          continue;
        }
        try {
          await studentsApi.create(student);
          added += 1;
        } catch (err) {
          failed.push({
            row: i + 2,
            name: rowLabel,
            message: err.response?.data?.message || 'Failed to save.',
          });
        }
      }

      setUploadSummary({ added, failed });
      if (added > 0) fetchStudents(1);
      setPage(1);
    } catch (err) {
      setUploadSummary({ added: 0, failed: [], readError: true });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-4">
      {/* Everything for this page lives in one card — header, totals, filters,
          bulk-upload and the table — instead of separate boxes. */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black">Students</h2>
            <p className="mt-1 text-sm text-black">
              Manage every student in the school add, view, edit, or remove records.
            </p>
          </div>

          {!isTeacher && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 rounded-md border border-slate-300 px-3.5 py-2 text-sm font-semibold text-black transition hover:bg-slate-50"
                title="Download the Excel template with the expected columns"
              >
                <Download size={16} /> Template
              </button>
              <button
                onClick={handleUploadClick}
                disabled={uploading}
                className="flex items-center gap-2 rounded-md border border-blue-600 px-3.5 py-2 text-sm font-semibold text-black transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UploadCloud size={16} /> {uploading ? 'Uploading…' : 'Upload Excel'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelected}
                className="hidden"
              />
              <Link
                to="/dashboard/students/add"
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-black transition hover:bg-blue-500"
              >
                <UserPlus size={16} /> Add Student
              </Link>
            </div>
          )}
        </div>

        {/* Bulk-upload result summary */}
        {uploadSummary && (
          <div className="border-b border-slate-100 px-6 py-4">
            {uploadSummary.readError ? (
              <div className="flex items-start justify-between gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-black">
                <span>Couldn't read that file. Please upload a valid .xlsx, .xls or .csv file.</span>
                <button onClick={() => setUploadSummary(null)} className="text-black hover:opacity-70">
                  <X size={16} />
                </button>
              </div>
            ) : uploadSummary.empty ? (
              <div className="flex items-start justify-between gap-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-black">
                <span>That file didn't have any rows to import.</span>
                <button onClick={() => setUploadSummary(null)} className="text-black hover:opacity-70">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                className={`rounded-md px-4 py-3 text-sm text-black ${
                  uploadSummary.failed.length ? 'bg-amber-50' : 'bg-emerald-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">
                    Imported {uploadSummary.added} student{uploadSummary.added === 1 ? '' : 's'}
                    {uploadSummary.failed.length ? `, ${uploadSummary.failed.length} row${uploadSummary.failed.length === 1 ? '' : 's'} skipped` : ''}.
                  </span>
                  <button onClick={() => setUploadSummary(null)} className="text-black opacity-70 hover:opacity-100">
                    <X size={16} />
                  </button>
                </div>
                {uploadSummary.failed.length > 0 && (
                  <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-black">
                    {uploadSummary.failed.map((f, idx) => (
                      <li key={idx}>
                        Row {f.row} ({f.name}): {f.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Whole-school total */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-black">
            <Users size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none text-black">{total}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-black">
              Total Students — Whole School
            </p>
          </div>
        </div>

        {/* Search & filter — search bar narrowed instead of stretching full width */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="relative w-56">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or admission no..."
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ml-auto rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="transferred">Transferred</option>
          </select>
        </div>

        {error && <p className="px-6 pt-4 text-sm text-black">{error}</p>}

        {/* Table */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-2 text-xs text-black">
          {loading ? 'Loading...' : `Showing ${students.length} of ${total} students`}
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
            <tr>
              <th className="px-6 py-3 font-medium">Admission Number</th>
              <th className="px-6 py-3 font-medium">Full Name</th>
              <th className="px-6 py-3 font-medium">Gender</th>
              <th className="px-6 py-3 font-medium">Class</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading &&
              students.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-black">{s.admission_number}</td>
                  <td className="px-6 py-3 font-medium text-black">{studentName(s)}</td>
                  <td className="px-6 py-3 text-black">{s.gender === 'male' ? 'Male' : 'Female'}</td>
                  <td className="px-6 py-3 text-black">{studentClassLabel(s)}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-black">
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/dashboard/students/${s.id}`}
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                        title="View student"
                      >
                        <Eye size={14} /> View
                      </Link>
                      {!isTeacher && (
                        <>
                          <span className="text-slate-300">|</span>
                          <Link to={`/dashboard/students/${s.id}/edit`} className="text-blue-600 hover:underline">
                            Edit
                          </Link>
                          <span className="text-slate-300">|</span>
                          <button onClick={() => handleDelete(s.id, studentName(s))} className="text-red-600 hover:underline">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && students.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-10 text-center text-black">
                  No students found{search || status ? ' for this search/filter.' : ' yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3">
            <span className="text-xs text-black">
              Page {page} of {pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
