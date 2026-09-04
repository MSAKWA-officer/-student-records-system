import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { attendanceApi } from './attendanceApi';
import { studentsApi } from '../students/studentsApi';
import { classesApi } from '../classes/classesApi';
import { useAuth } from '../../context/AuthContext';
import { exportToExcel } from '../../utils/exportToExcel';

const statusLabels = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};
const statusStyles = {
  present: 'bg-emerald-100 text-black',
  absent: 'bg-red-100 text-black',
  late: 'bg-amber-100 text-black',
  excused: 'bg-slate-200 text-black',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceList() {
  const { user } = useAuth();
  const canEdit = ['admin', 'headteacher', 'teacher'].includes(user?.role);
  const { classId: routeClassId } = useParams();

  const [classes, setClasses] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [error, setError] = useState('');

  // Filters: Class -> Stream -> Date. When reached via a class-specific
  // sidebar link (Attendance > Form 1, Form 2, ...) the class is locked.
  const [classId, setClassId] = useState(routeClassId || '');
  const [streamId, setStreamId] = useState('');
  const [date, setDate] = useState(todayIso());

  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState({}); // studentId -> { status, notes, recordId, saving, error }
  const [loadingGrid, setLoadingGrid] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await classesApi.getAll();
        setClasses(res.data);
      } catch (err) {
        setError('Failed to load classes.');
      } finally {
        setLoadingLookups(false);
      }
    })();
  }, []);

  // Keep the selected class in sync with the route (e.g. navigating between
  // Attendance > Form 1 and Attendance > Form 2 via the sidebar).
  useEffect(() => {
    setClassId(routeClassId || '');
    setStreamId('');
  }, [routeClassId]);

  const streamsForSelectedClass = useMemo(() => {
    const cls = classes.find((c) => String(c.id) === String(classId));
    return cls?.Streams || [];
  }, [classes, classId]);

  const selectedClass = classes.find((c) => String(c.id) === String(classId));

  const readyToLoad = classId && date;

  useEffect(() => {
    if (!readyToLoad) {
      setStudents([]);
      setRows({});
      return;
    }
    loadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, streamId, date]);

  async function loadGrid() {
    setLoadingGrid(true);
    setError('');
    try {
      const studentParams = { class_id: classId, limit: 1000 };
      if (streamId) studentParams.stream_id = streamId;

      const [studentsRes, attendanceRes] = await Promise.all([
        studentsApi.getAll(studentParams),
        attendanceApi.getAll({ date }),
      ]);

      const studentList = studentsRes.data.data || [];
      const attendanceList = attendanceRes.data || [];

      setStudents(studentList);

      const nextRows = {};
      studentList.forEach((s) => {
        const existing = attendanceList.find((r) => r.student_id === s.id);
        nextRows[s.id] = existing
          ? {
              status: existing.status,
              notes: existing.notes || '',
              recordId: existing.id,
              saving: false,
              error: '',
            }
          : { status: 'present', notes: '', recordId: null, saving: false, error: '' };
      });
      setRows(nextRows);
    } catch (err) {
      setError('Failed to load students/attendance for this class.');
    } finally {
      setLoadingGrid(false);
    }
  }

  function updateRow(studentId, field, value) {
    setRows((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  }

  async function saveRow(studentId) {
    const row = rows[studentId];
    if (!row) return;
    updateRow(studentId, 'saving', true);
    updateRow(studentId, 'error', '');
    try {
      const payload = { student_id: studentId, date, status: row.status, notes: row.notes || null };
      let res;
      if (row.recordId) {
        res = await attendanceApi.update(row.recordId, payload);
      } else {
        res = await attendanceApi.create(payload);
      }
      setRows((prev) => ({
        ...prev,
        [studentId]: {
          status: res.data.status,
          notes: res.data.notes || '',
          recordId: res.data.id,
          saving: false,
          error: '',
        },
      }));
    } catch (err) {
      updateRow(studentId, 'saving', false);
      updateRow(studentId, 'error', err.response?.data?.message || 'Failed to save attendance.');
    }
  }

  async function saveAll() {
    const ids = students.map((s) => s.id);
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await saveRow(id);
    }
  }

  async function deleteRow(studentId, studentName) {
    const row = rows[studentId];
    if (!row?.recordId) return;
    if (!window.confirm(`Are you sure you want to delete the attendance record for "${studentName}" on ${date}?`)) return;
    try {
      await attendanceApi.remove(row.recordId);
      setRows((prev) => ({
        ...prev,
        [studentId]: { status: 'present', notes: '', recordId: null, saving: false, error: '' },
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete the attendance record.');
    }
  }

  function studentName(s) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
  }

  function studentStream(s) {
    const enrollment = (s.Enrollments || []).find((e) => (streamId ? e.stream_id === Number(streamId) : true));
    return enrollment?.Stream?.name || (s.Enrollments || [])[0]?.Stream?.name || '—';
  }

  function handleExportExcel() {
    const data = students.map((s) => ({
      'Admission No.': s.admission_number,
      'Student': studentName(s),
      'Stream': studentStream(s),
      'Status': statusLabels[rows[s.id]?.status] || rows[s.id]?.status || '',
      'Notes': rows[s.id]?.notes || '',
    }));
    const label = selectedClass?.name || 'Class';
    exportToExcel(data, `${label}-Attendance-${date}`, 'Attendance');
  }

  const recordedCount = Object.values(rows).filter((r) => r.recordId).length;

  return (
    <div className="p-4">
      {/* Everything for this page — breadcrumb, header, filters, and the
          attendance table — lives inside one card instead of separate boxes. */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Breadcrumb (only when reached via a class-specific link) */}
        {routeClassId && (
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 pt-4 text-sm text-black">
            <Link to="/dashboard/attendance" className="hover:underline">Attendance</Link>
            <span>/</span>
            <span className="pb-4 text-black">{selectedClass?.name || '...'}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black">
              {routeClassId ? `${selectedClass?.name || 'Class'} Attendance` : 'Attendance'}
            </h2>
            <p className="mt-1 text-sm text-black">
              {routeClassId
                ? `Select a Stream and Date to record or view attendance for ${selectedClass?.name || 'this class'}.`
                : 'Select a Class, Stream and Date to record or view attendance for all students in that class/stream.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {readyToLoad && students.length > 0 && (
              <button
                onClick={handleExportExcel}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-50"
              >
                Export to Excel
              </button>
            )}
            {readyToLoad && students.length > 0 && (
              <button
                onClick={() => window.print()}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-50"
              >
                Print / PDF
              </button>
            )}
            {canEdit && readyToLoad && students.length > 0 && (
              <button
                onClick={saveAll}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Save All
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-4 border-b border-slate-100 px-6 py-5 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-black">Class *</label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setStreamId('');
              }}
              disabled={loadingLookups || Boolean(routeClassId)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-black"
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-black">Stream</label>
            <select
              value={streamId}
              onChange={(e) => setStreamId(e.target.value)}
              disabled={!classId}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-black"
            >
              <option value="">All Streams</option>
              {streamsForSelectedClass.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-black">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">{error}</p>}

        {!readyToLoad && !error && (
          <p className="px-6 py-6 text-sm text-black">
            Select a Class and a Date above to see the student list and record their attendance.
          </p>
        )}

        {readyToLoad && loadingGrid && <p className="px-6 py-6 text-sm text-black">Loading...</p>}

        {/* Attendance table */}
        {readyToLoad && !loadingGrid && (
          <>
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-2 text-xs text-black">
              {students.length} students · {recordedCount} attendance record(s) for {date}
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-black">
                <tr>
                  <th className="px-6 py-3 font-medium">Admission No.</th>
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">Stream</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Notes</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => {
                  const row = rows[s.id] || {};
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-black">{s.admission_number}</td>
                      <td className="px-6 py-3 font-medium text-black">{studentName(s)}</td>
                      <td className="px-6 py-3 text-black">{studentStream(s)}</td>
                      <td className="px-6 py-3">
                        {canEdit ? (
                          <select
                            value={row.status}
                            onChange={(e) => updateRow(s.id, 'status', e.target.value)}
                            className={`rounded-full px-2 py-1 text-xs font-medium outline-none ${statusStyles[row.status] || 'bg-slate-100 text-black'}`}
                          >
                            {Object.entries(statusLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[row.status] || 'bg-slate-100 text-black'}`}>
                            {statusLabels[row.status] || row.status}
                          </span>
                        )}
                        {row.error && <p className="mt-1 text-xs text-black">{row.error}</p>}
                      </td>
                      <td className="px-6 py-3">
                        {canEdit ? (
                          <input
                            value={row.notes}
                            onChange={(e) => updateRow(s.id, 'notes', e.target.value)}
                            placeholder="e.g. Was sick"
                            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-black">{row.notes || '—'}</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {canEdit ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => saveRow(s.id)}
                              disabled={row.saving}
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                            >
                              {row.saving ? 'Saving...' : 'Save'}
                            </button>
                            {row.recordId && (
                              <button
                                onClick={() => deleteRow(s.id, studentName(s))}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-black">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-black">
                      No students in this class/stream.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
