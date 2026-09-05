import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { classSubjectsApi } from './classSubjectsApi';
import { classesApi } from '../classes/classesApi';
import { academicYearsApi } from '../academicYears/academicYearsApi';

export default function ClassSubjectList() {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);

  const [filterClassId, setFilterClassId] = useState('');
  const [filterStreamId, setFilterStreamId] = useState('');
  const [filterYearId, setFilterYearId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load dropdown data once
  useEffect(() => {
    (async () => {
      try {
        const [classesRes, yearsRes] = await Promise.all([
          classesApi.getAll(),
          academicYearsApi.getAll(),
        ]);
        setClasses(classesRes.data);
        setYears(yearsRes.data);

        const current = yearsRes.data.find((y) => y.is_current);
        if (current) setFilterYearId(String(current.id));
      } catch (err) {
        setError('Failed to load base data (classes/years).');
      }
    })();
  }, []);

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClassId, filterStreamId, filterYearId]);

  async function fetchAssignments() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterClassId) params.school_class_id = filterClassId;
      if (filterStreamId) params.stream_id = filterStreamId;
      if (filterYearId) params.academic_year_id = filterYearId;
      const res = await classSubjectsApi.getAll(params);
      setAssignments(res.data);
    } catch (err) {
      setError('Failed to load subject allocations.');
    } finally {
      setLoading(false);
    }
  }

  function streamsForClass(classId) {
    const cls = classes.find((c) => String(c.id) === String(classId));
    return cls?.Streams || [];
  }

  // Group assignments by class, then by teacher within that class, so each
  // teacher's name appears only once per class — with every subject they've
  // been allocated in that class listed together in the Subject column.
  function groupByClassThenTeacher(list) {
    const classGroups = new Map();
    for (const a of list) {
      const classId = a.SchoolClass?.id ?? a.school_class_id ?? 'unknown';
      const className = a.SchoolClass?.name || 'Unassigned class';
      if (!classGroups.has(classId)) {
        classGroups.set(classId, { className, teacherGroups: new Map() });
      }
      const classGroup = classGroups.get(classId);

      const teacherKey = a.Teacher?.id ?? 'unassigned';
      const teacherName = a.Teacher?.full_name || 'Not assigned yet';
      const yearKey = a.AcademicYear?.id ?? a.academic_year_id ?? 'unknown';
      // Same teacher can appear again in a different academic year — keep
      // those as separate rows so the Year column stays meaningful.
      const rowKey = `${teacherKey}-${yearKey}`;

      if (!classGroup.teacherGroups.has(rowKey)) {
        classGroup.teacherGroups.set(rowKey, {
          teacherId: a.Teacher?.id ?? '',
          teacherName,
          yearId: a.AcademicYear?.id ?? a.academic_year_id ?? '',
          yearName: a.AcademicYear?.year_name || '—',
          subjects: [],
        });
      }
      classGroup.teacherGroups.get(rowKey).subjects.push({
        id: a.id,
        name: a.Subject?.name || '—',
        streamName: a.Stream?.name || 'All Streams',
      });
    }

    return Array.from(classGroups.entries())
      .map(([classId, group]) => ({
        classId,
        className: group.className,
        rows: Array.from(group.teacherGroups.values()).sort((a, b) =>
          a.teacherName.localeCompare(b.teacherName)
        ),
      }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }

  const grouped = groupByClassThenTeacher(assignments);

  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black">Subject Allocation</h2>
            <p className="mt-1 text-sm text-black">
              Link a Teacher, Subject, Class and Stream for an academic year · {assignments.length} found
            </p>
          </div>
          <Link
            to="/dashboard/class-subjects/add"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            + Add Allocation
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 border-b border-slate-100 px-6 py-4">
          <select
            value={filterClassId}
            onChange={(e) => {
              setFilterClassId(e.target.value);
              setFilterStreamId('');
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterStreamId}
            onChange={(e) => setFilterStreamId(e.target.value)}
            disabled={!filterClassId}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-black"
          >
            <option value="">All Streams</option>
            {streamsForClass(filterClassId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterYearId}
            onChange={(e) => setFilterYearId(e.target.value)}
            className="ml-auto rounded-md border border-slate-300 px-3 py-2 text-sm text-black outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.year_name}{y.is_current ? ' (Current)' : ''}</option>
            ))}
          </select>
        </div>

        {loading && <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">Loading...</p>}
        {error && <p className="border-b border-slate-100 px-6 py-4 text-sm text-black">{error}</p>}

        {/* Grouped tables, one per class, all within the same outer card */}
        {!loading && !error && (
          <div className="divide-y divide-slate-100">
            {grouped.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-black">No subject allocations yet.</div>
            )}

            {grouped.map((group) => (
              <div key={group.classId}>
                <div className="flex items-center justify-between bg-slate-50 px-6 py-3">
                  <h3 className="text-sm font-semibold text-black">{group.className}</h3>
                  <span className="text-xs font-medium text-black">
                    {group.rows.length} {group.rows.length === 1 ? 'teacher' : 'teachers'}
                  </span>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-black">
                    <tr>
                      <th className="px-6 py-2 font-medium">Teacher</th>
                      <th className="px-6 py-2 font-medium">Subject(s)</th>
                      <th className="px-6 py-2 font-medium">Year</th>
                      <th className="px-6 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((row) => {
                      const params = new URLSearchParams({
                        class_id: group.classId,
                        teacher_id: row.teacherId || '',
                        academic_year_id: row.yearId || '',
                      }).toString();
                      return (
                        <tr key={`${row.teacherId || 'unassigned'}-${row.yearId}`} className="hover:bg-slate-50">
                          <td className="px-6 py-3 font-medium text-black">
                            {row.teacherId ? row.teacherName : (
                              <span className="text-black">Not assigned yet</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-black">
                            <div className="flex flex-wrap gap-1.5">
                              {row.subjects.map((s) => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                                  title={s.streamName}
                                >
                                  {s.name}
                                  {s.streamName !== 'All Streams' ? ` (${s.streamName})` : ''}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-black">{row.yearName}</td>
                          <td className="whitespace-nowrap px-6 py-3">
                            <Link to={`/dashboard/class-subjects/view?${params}`} className="text-blue-600 hover:underline">
                              View
                            </Link>
                            <span className="mx-2 text-slate-300">|</span>
                            <Link to={`/dashboard/class-subjects/edit?${params}`} className="text-blue-600 hover:underline">
                              Change Teacher
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
