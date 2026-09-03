import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { studentsApi } from './studentsApi';
import { attendanceApi } from '../attendance/attendanceApi';
import { useAuth } from '../../context/AuthContext';

const STATUS_LABEL = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Read-only attendance history for a single student — reused for a
// student viewing their own record and for staff viewing a student's
// record from their profile page.
export default function MyAttendance() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();

  // A student lands here with no page to go "back" to except Home; staff
  // came from the student's profile page, so send them back there.
  const backTo = location.state?.from || (user?.role === 'student' ? '/dashboard' : `/dashboard/students/${id}`);
  const backLabel = location.state?.from ? '← Back' : user?.role === 'student' ? '← Home' : '← Back to Student';

  const [student, setStudent] = useState(null);
  const [startDate, setStartDate] = useState(isoDaysAgo(30));
  const [endDate, setEndDate] = useState(isoDaysAgo(0));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    studentsApi.getById(id).then((res) => setStudent(res.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, startDate, endDate]);

  async function loadAttendance() {
    setLoading(true);
    setError('');
    try {
      const res = await attendanceApi.getAll({ student_id: id, start_date: startDate, end_date: endDate });
      setRecords(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance.');
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    records.forEach((r) => {
      if (counts[r.status] != null) counts[r.status] += 1;
    });
    return counts;
  }, [records]);

  return (
    <div className="p-4">
      <Link to={backTo} className="text-sm text-blue-600 hover:underline">
        {backLabel}
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {user?.role === 'student' ? 'My Attendance' : `${student ? `${student.first_name} ${student.last_name}` : 'Student'}'s Attendance`}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Attendance history between the selected dates.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {loading && <p className="mt-6 text-sm text-slate-500">Loading...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryBox label="Present" value={summary.present} color="emerald" />
            <SummaryBox label="Absent" value={summary.absent} color="red" />
            <SummaryBox label="Late" value={summary.late} color="amber" />
            <SummaryBox label="Excused" value={summary.excused} color="slate" />
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-slate-600">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{STATUS_LABEL[r.status] || r.status}</td>
                    <td className="px-4 py-3 text-slate-600">{r.notes || '—'}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-4 py-8 text-center text-slate-400">
                      No attendance records for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryBox({ label, value, color }) {
  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className={`rounded-lg px-4 py-3 ${colorClasses[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
