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
  Megaphone,
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
import { announcementsApi } from '../features/announcements/announcementsApi';

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

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  useEffect(() => {
    if (isStudent) return; // this school-wide overview isn't relevant to a student login
    loadStats();
    loadAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent]);

  async function loadAnnouncements() {
    setAnnouncementsLoading(true);
    try {
      // Backend already returns newest first, so item [0] is the current announcement.
      const res = await announcementsApi.getAll({ active: 'true' });
      setAnnouncements(res.data || []);
    } catch (err) {
      setAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  }

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
      {/* Top section stays full-width and is NOT split into columns. */}
      <div className="sims-card mb-6">
        <div className="sims-card-header">
          <p className="sims-card-title text-black">System Overview</p>
        </div>
        <div className="sims-card-body py-1">
  <h1 className="text-sm font-bold text-black leading-none">School Records Management System</h1>
  <p className="mt-0.5 text-xs text-black leading-none">
    {currentYear ? `Current Academic Year: ${currentYear.year_name}` : 'A summary of all system data.'}
  </p>
</div>
      </div>

      {/* Below the header: page split into two equal halves — announcements
          on the left, the rest of the overview info on the right. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT: bottom-to-top animated announcements feed, current one first. */}
        <div className="sims-card flex flex-col">
          <div className="sims-card-header">
            <p className="sims-card-title text-black flex items-center gap-2">
              <Megaphone size={16} />
              Announcements
            </p>
          </div>
          <div className="sims-card-body">
            <AnnouncementFeed announcements={announcements} loading={announcementsLoading} />
          </div>
        </div>

        {/* RIGHT: the rest of the overview information (stat cards). */}
        <div>
          {loading && <p className="text-sm text-black">Loading system data...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {!loading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>
    </div>
  );
}

function AnnouncementFeed({ announcements, loading }) {
  if (loading) {
    return <p className="text-sm text-black">Loading announcements...</p>;
  }

  if (!announcements.length) {
    return <p className="text-sm text-black">No announcements yet.</p>;
  }

  function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Duplicate the list so the CSS animation can loop seamlessly from
  // 0% to -50% without a visible jump, while the very first item shown
  // is always the current (most recent / first in the array) announcement.
  const loopItems = [...announcements, ...announcements];

  // Slower scroll for longer lists so items stay readable.
  const durationSeconds = Math.max(10, announcements.length * 5);

  return (
    <div className="announcement-viewport">
      <ul
        className="announcement-track"
        style={{ animationDuration: `${durationSeconds}s` }}
      >
        {loopItems.map((a, i) => (
          <li key={`${a.id}-${i}`} className="announcement-item">
            <p className="text-sm font-semibold text-blue-700">{a.title}</p>
            <p className="mt-1 text-sm text-black">{a.body}</p>
            <p className="mt-1 text-xs text-black">{formatDate(a.createdAt)}</p>
          </li>
        ))}
      </ul>
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
        <p className="text-xl font-bold text-black">{value}</p>
        <p className="text-xs font-medium text-black">{label}</p>
      </div>
    </div>
  );
}
