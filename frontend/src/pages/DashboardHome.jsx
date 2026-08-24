import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserSquare2,
  Layers,
  BookOpen,
  ListChecks,
  CalendarRange,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  CalendarCheck2,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { studentsApi } from '../features/students/studentsApi';
import { teachersApi } from '../features/teachers/teachersApi';
import { classesApi } from '../features/classes/classesApi';
import { subjectsApi } from '../features/subjects/Subjectsapi';
import { classSubjectsApi } from '../features/classSubjects/classSubjectsApi';
import { academicYearsApi } from '../features/academicYears/academicYearsApi';
import { termsApi } from '../features/terms/termsApi';
import { examsApi } from '../features/exams/examsApi';
import { resultsApi } from '../features/results/resultsApi';
import { attendanceApi } from '../features/attendance/attendanceApi';
import { enrollmentsApi } from '../features/enrollments/enrollmentsApi';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardHome() {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const [stats, setStats] = useState(null);
  const [currentYear, setCurrentYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isStudent) return; // this school-wide overview isn't relevant to a student login
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent]);

  async function loadStats() {
    setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled([
        studentsApi.getAll({ limit: 1 }),
        teachersApi.getAll(),
        classesApi.getAll(),
        subjectsApi.getAll(),
        classSubjectsApi.getAll(),
        academicYearsApi.getAll(),
        termsApi.getAll(),
        examsApi.getAll(),
        resultsApi.getAll(),
        attendanceApi.getAll({ date: todayIso() }),
        enrollmentsApi.getAll(),
      ]);

      const [
        studentsRes,
        teachersRes,
        classesRes,
        subjectsRes,
        classSubjectsRes,
        academicYearsRes,
        termsRes,
        examsRes,
        resultsRes,
        attendanceRes,
        enrollmentsRes,
      ] = results;

      const value = (res, fallback) => (res.status === 'fulfilled' ? fallback(res.value.data) : null);

      const classesData = value(classesRes, (d) => d) || [];
      const streamCount = classesData.reduce((sum, c) => sum + (c.Streams?.length || 0), 0);
      const yearsData = value(academicYearsRes, (d) => d) || [];

      setStats({
        students: value(studentsRes, (d) => d.total),
        teachers: value(teachersRes, (d) => d.length),
        classes: classesData.length,
        streams: streamCount,
        subjects: value(subjectsRes, (d) => d.length),
        classSubjects: value(classSubjectsRes, (d) => d.length),
        academicYears: yearsData.length,
        terms: value(termsRes, (d) => d.length),
        exams: value(examsRes, (d) => d.length),
        results: value(resultsRes, (d) => d.length),
        attendanceToday: value(attendanceRes, (d) => d.length),
        enrollments: value(enrollmentsRes, (d) => d.length),
      });
      setCurrentYear(yearsData.find((y) => y.is_current) || null);
    } catch (err) {
      setError('Failed to load system data.');
    } finally {
      setLoading(false);
    }
  }

  function statValue(key) {
    if (!stats) return '—';
    const v = stats[key];
    return v === null || v === undefined ? '—' : v;
  }

  if (isStudent) {
    const sid = user?.student_id;
    return (
      <div className="sims-card">
        <div className="sims-card-header">
          <p className="sims-card-title">Welcome</p>
        </div>
        <div className="sims-card-body">
          <h1 className="text-lg font-bold text-slate-900">Welcome, {user?.full_name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Use the menu to view your results and attendance.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to={`/dashboard/students/${sid}/report-card`}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              My Report Card
            </Link>
            <Link to={`/dashboard/students/${sid}/result-slip`} className="sims-btn sims-btn-outline">
              My Result Slip
            </Link>
            <Link
              to={`/dashboard/students/${sid}/attendance`}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              My Attendance
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sims-card mb-6">
        <div className="sims-card-header">
          <p className="sims-card-title">System Overview</p>
        </div>
        <div className="sims-card-body">
          <h1 className="text-lg font-bold text-slate-900">School Records Management System</h1>
          <p className="mt-1 text-sm text-slate-500">
            {currentYear ? `Current Academic Year: ${currentYear.year_name}` : 'A summary of all system data.'}
          </p>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading system data...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard icon={Users} label="Students" value={statValue('students')} />
          <StatCard icon={UserSquare2} label="Teachers" value={statValue('teachers')} />
          <StatCard icon={Layers} label="Classes" value={statValue('classes')} />
          <StatCard icon={Layers} label="Streams" value={statValue('streams')} />
          <StatCard icon={BookOpen} label="Subjects" value={statValue('subjects')} />
          <StatCard icon={ListChecks} label="Subject Allocations" value={statValue('classSubjects')} />
          <StatCard icon={CalendarRange} label="Academic Years" value={statValue('academicYears')} />
          <StatCard icon={CalendarDays} label="Terms" value={statValue('terms')} />
          <StatCard icon={ClipboardList} label="Exams" value={statValue('exams')} />
          <StatCard icon={FileCheck2} label="Results Recorded" value={statValue('results')} />
          <StatCard icon={CalendarCheck2} label="Today's Attendance" value={statValue('attendanceToday')} />
          <StatCard icon={UsersRound} label="Class Enrollments" value={statValue('enrollments')} />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="sims-stat-card">
      <div className="sims-stat-icon">
        <Icon size={19} />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}
