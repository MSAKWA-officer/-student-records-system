import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Layers,
  BookOpen,
  UserSquare2,
  ListChecks,
  CalendarRange,
  ClipboardList,
  CalendarCheck2,
  UsersRound,
  ShieldCheck,
  LogOut,
  Bell,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  School,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { academicYearsApi } from '../features/academicYears/academicYearsApi';
import { termsApi } from '../features/terms/termsApi';
import { classesApi } from '../features/classes/classesApi';

// Base nav tree. Items can be a leaf (has `to`) or a group (has `children`).
// Groups can be nested up to 3 levels deep, e.g.
//   Examination Result > Results > View Results
//   Examination Result > Result Slips > Form 1
// The "Result Slips" children are populated at runtime from the real class
// list (see buildNavConfig below), since class names are school-specific data.
function buildNavConfig(classes) {
  const classSlipLinks = (classes || []).map((c) => ({
    to: `/dashboard/results/slips/${c.id}`,
    label: c.name,
  }));
  const classReportLinks = (classes || []).map((c) => ({
    to: `/dashboard/reports/${c.id}`,
    label: c.name,
  }));
  const classAttendanceLinks = (classes || []).map((c) => ({
    to: `/dashboard/attendance/${c.id}`,
    label: c.name,
  }));
  const classEnrollmentLinks = (classes || []).map((c) => ({
    to: `/dashboard/enrollments/${c.id}`,
    label: c.name,
  }));

  return [
    { to: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
    { to: '/dashboard/students', label: 'Students', icon: Users },
    { to: '/dashboard/classes', label: 'Classes', icon: Layers, roles: ['admin', 'headteacher', 'staff'] },
    { to: '/dashboard/subjects', label: 'Subjects', icon: BookOpen, roles: ['admin', 'headteacher', 'staff'] },
    { to: '/dashboard/teachers', label: 'Teachers', icon: UserSquare2, roles: ['admin', 'headteacher', 'teacher'] },
    {
      to: '/dashboard/class-subjects',
      label: 'Subject Allocation',
      icon: ListChecks,
      roles: ['admin', 'headteacher'],
    },
    {
      label: 'Academics',
      icon: CalendarRange,
      children: [
        { to: '/dashboard/academic-years', label: 'Academic Years', roles: ['admin', 'headteacher'] },
        { to: '/dashboard/terms', label: 'Terms', roles: ['admin', 'headteacher', 'staff'] },
      ],
    },
    {
      label: 'Examination Result',
      icon: ClipboardList,
      children: [
        { to: '/dashboard/exams', label: 'Exams' },
        {
          label: 'Results',
          children: [
            { to: '/dashboard/results/view', label: 'View Results' },
            { to: '/dashboard/results/upload', label: 'Upload Results' },
          ],
        },
        {
          label: 'Result Slips',
          children: [{ to: '/dashboard/results/slips', label: 'All Classes' }, ...classSlipLinks],
        },
        {
          label: 'Reports',
          roles: ['admin', 'headteacher'],
          children: [{ to: '/dashboard/reports', label: 'All Classes' }, ...classReportLinks],
        },
      ],
    },
    {
      label: 'Attendance',
      icon: CalendarCheck2,
      children: [{ to: '/dashboard/attendance', label: 'All Classes' }, ...classAttendanceLinks],
    },
    {
      label: 'Class Enrollments',
      icon: UsersRound,
      roles: ['admin', 'headteacher'],
      children: [{ to: '/dashboard/enrollments', label: 'All Classes' }, ...classEnrollmentLinks],
    },
    { to: '/dashboard/users', label: 'Users', icon: ShieldCheck, roles: ['admin'] },
  ];
}

// A student account gets a short, dedicated menu instead of the full staff
// tree — just their own results and attendance, deep-linked with their own
// student id so they never have to pick a class or another student.
function buildStudentNavConfig(user) {
  const sid = user?.student_id;
  return [
    { to: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
    { to: `/dashboard/students/${sid}/report-card`, label: 'My Report Card', icon: ClipboardList },
    { to: `/dashboard/students/${sid}/result-slip`, label: 'My Result Slip', icon: ListChecks },
    { to: `/dashboard/students/${sid}/attendance`, label: 'My Attendance', icon: CalendarCheck2 },
  ];
}

// Recursively drop items the current user's role isn't allowed to see, and
// drop any group that ends up with no visible children. A group can also
// carry its own `roles` restriction (e.g. "Reports"), which is checked
// before descending into its children.
function filterNavByRole(items, role) {
  return items
    .map((item) => {
      if (item.roles && !item.roles.includes(role)) return null;
      if (item.children) {
        const children = filterNavByRole(item.children, role);
        return children.length ? { ...item, children } : null;
      }
      return item;
    })
    .filter(Boolean);
}

// True if this item (or, for a group, any descendant) matches the current path.
function isItemActive(item, pathname) {
  if (item.children) {
    return item.children.some((c) => isItemActive(c, pathname));
  }
  return item.exact ? pathname === item.to : pathname.startsWith(item.to);
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [currentYear, setCurrentYear] = useState(null);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [classes, setClasses] = useState([]);

  const isStudent = user?.role === 'student';
  const rawNav = useMemo(
    () => (isStudent ? buildStudentNavConfig(user) : buildNavConfig(classes)),
    [classes, isStudent, user]
  );
  const visibleNav = useMemo(
    () => (isStudent ? rawNav : filterNavByRole(rawNav, user?.role)),
    [rawNav, isStudent, user?.role]
  );

  // Any group (at any depth) whose active descendant matches the current
  // path should start expanded, so navigating directly to a deep link (e.g.
  // a bookmarked class result-slip page) still shows an open trail.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      const walk = (items, pathPrefix) => {
        items.forEach((item) => {
          if (!item.children) return;
          const key = `${pathPrefix}${item.label}`;
          if (isItemActive(item, location.pathname)) next[key] = true;
          walk(item.children, `${key}>`);
        });
      };
      walk(visibleNav, '');
      return next;
    });
  }, [location.pathname, visibleNav]);

  useEffect(() => {
    if (isStudent) return; // student nav/breadcrumb don't need this lookup data
    (async () => {
      try {
        const [yearsRes, termsRes, classesRes] = await Promise.all([
          academicYearsApi.getAll(),
          termsApi.getAll(),
          classesApi.getAll(),
        ]);
        setCurrentYear(yearsRes.data.find((y) => y.is_current) || null);
        setCurrentTerm(termsRes.data.find((t) => t.is_current) || null);
        setClasses(classesRes.data || []);
      } catch {
        // Non-critical for the shell — breadcrumb badge and class sub-menu
        // simply stay empty/hidden if this fails.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent]);

  // Builds the breadcrumb trail (section labels) down to the active leaf.
  const activeTrail = useMemo(() => {
    const walk = (items) => {
      for (const item of items) {
        if (item.children) {
          const nested = walk(item.children);
          if (nested) return [item.label, ...nested];
        } else if (isItemActive(item, location.pathname)) {
          return [item.label];
        }
      }
      return null;
    };
    const trail = walk(visibleNav);
    return trail || ['Dashboard'];
  }, [visibleNav, location.pathname]);

  function toggleGroup(key) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top brand header */}
      <header className="sims-header sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 px-4 text-white shadow-md sm:px-6">
        <button
          className="rounded-md p-1.5 hover:bg-white/10 lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          <School size={22} />
        </div>

        <div className="min-w-0 leading-tight">
          <p className="truncate text-base font-bold tracking-wide sm:text-lg">Student Records System</p>
          <p className="hidden text-xs font-medium text-white/80 sm:block">
            Manage students, results and attendance
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <button className="rounded-full p-2 hover:bg-white/10" aria-label="Notifications">
            <Bell size={19} />
          </button>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-white/10"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold uppercase">
                {user?.full_name?.charAt(0) || 'U'}
              </span>
              <span className="hidden text-sm font-semibold sm:block">{user?.full_name}</span>
              <ChevronDown size={16} className="hidden sm:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md border border-slate-200 bg-white py-1 text-slate-700 shadow-lg">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.full_name}</p>
                  <p className="truncate text-xs capitalize text-slate-500">{user?.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut size={15} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 top-16 z-20 flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          } ${collapsed ? 'w-64 lg:w-[68px]' : 'w-64'}`}
        >
          <div className={`flex items-center gap-2 px-4 py-3 ${collapsed ? 'lg:justify-center lg:px-0' : 'justify-between'}`}>
            <span
              className={`inline-block rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white ${
                collapsed ? 'lg:hidden' : ''
              }`}
              style={{ backgroundColor: 'var(--brand-blue-600)' }}
            >
              {user?.role === 'admin' ? 'Admin Panel' : user?.role || 'Panel'}
            </span>
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="hidden shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:block"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-3 pb-4">
            {visibleNav.map((item) => (
              <NavNode
                key={item.to || item.label}
                item={item}
                depth={0}
                pathPrefix=""
                pathname={location.pathname}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
                onNavigate={() => setMobileOpen(false)}
                collapsed={collapsed}
              />
            ))}
          </nav>

          <button
            onClick={logout}
            className="mx-3 mb-4 flex items-center justify-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 lg:hidden"
          >
            <LogOut size={15} /> Log out
          </button>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 top-16 z-10 bg-slate-900/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sims-breadcrumb justify-between">
            <div className="flex items-center gap-1.5">
              <Link to="/dashboard" className="hover:text-blue-700">
                Home
              </Link>
              {activeTrail.map((label, idx) => (
                <span key={`${label}-${idx}`} className="flex items-center gap-1.5">
                  <ChevronRight size={13} />
                  <span className={idx === activeTrail.length - 1 ? 'font-semibold text-slate-700' : ''}>
                    {label}
                  </span>
                </span>
              ))}
            </div>
            {currentYear && (
              <span className="hidden text-xs font-medium text-slate-500 sm:block">
                Active Academic Year:{' '}
                <span className="font-semibold text-slate-700">
                  {currentYear.year_name}
                  {currentTerm ? ` — ${currentTerm.name}` : ''}
                </span>
              </span>
            )}
          </div>

          <main className="flex-1 p-3 sm:p-4">
            <Outlet />
          </main>

          <footer className="border-t border-slate-200 bg-white px-6 py-3 text-center text-xs text-slate-500">
            © 2024–{new Date().getFullYear()} Student Records System. Built for schools in Tanzania.
          </footer>
        </div>
      </div>
    </div>
  );
}

// Renders one nav entry — a plain link (leaf) or a toggleable group, and
// recurses into its children. `depth` controls indentation/size so nested
// sub-sub-items (e.g. individual classes under "Result Slips") read clearly.
function NavNode({ item, depth, pathPrefix, pathname, openGroups, toggleGroup, onNavigate, collapsed }) {
  const key = `${pathPrefix}${item.label || item.to}`;
  // Labels/chevrons hide only at the lg breakpoint when the sidebar is
  // collapsed to an icon rail; on mobile the sidebar is always full-width.
  const hideLabel = collapsed ? 'lg:hidden' : '';

  if (item.children) {
    const active = isItemActive(item, pathname);
    const open = !!openGroups[key];
    const Icon = item.icon;
    return (
      <div>
        <button
          onClick={() => toggleGroup(key)}
          title={collapsed ? item.label : undefined}
          className={`sims-nav-item w-full justify-between ${depth > 0 ? 'py-1.5 text-[13px]' : ''} ${
            active ? 'sims-nav-item-active' : ''
          } ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
        >
          <span className="flex items-center gap-3">
            {Icon && <Icon size={17} className="shrink-0" />}
            <span className={hideLabel}>{item.label}</span>
          </span>
          <span className={hideLabel}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
        </button>
        {open && (
          <div className={`ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3 ${collapsed ? 'lg:hidden' : ''}`}>
            {item.children.map((child) => (
              <NavNode
                key={child.to || child.label}
                item={child}
                depth={depth + 1}
                pathPrefix={`${key}>`}
                pathname={pathname}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
                onNavigate={onNavigate}
                collapsed={collapsed}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const Icon = item.icon;
  const active = isItemActive(item, pathname);
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={`sims-nav-item ${depth > 0 ? 'py-1.5 text-[13px]' : ''} ${active ? 'sims-nav-item-active' : ''} ${
        collapsed ? 'lg:justify-center lg:px-2' : ''
      }`}
    >
      {Icon && <Icon size={17} className="shrink-0" />}
      <span className={hideLabel}>{item.label}</span>
    </Link>
  );
}
