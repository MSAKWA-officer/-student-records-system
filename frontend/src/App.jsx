import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
import StudentList from './features/students/StudentList';
import StudentForm from './features/students/StudentForm';
import StudentView from './features/students/StudentView';
import StudentReportCard from './features/students/StudentReportCard';
import MyAttendance from './features/students/MyAttendance';
import StudentResultSlip from './features/results/StudentResultSlip';
import ResultSlipsPage from './features/results/ResultSlipsPage';
import ClassList from './features/classes/ClassList';
import SubjectList from './features/subjects/SubjectList';
import TeacherList from './features/teachers/TeacherList';
import ClassSubjectList from './features/classSubjects/ClassSubjectList';
import AcademicYearList from './features/academicYears/AcademicYearList';
import TermList from './features/terms/TermList';
import ExamList from './features/exams/ExamList';
import ResultList from './features/results/ResultList';
import ClassResultsPage from './features/results/ClassResultsPage';
import UploadResultsPage from './features/results/UploadResultsPage';
import ClassResultSlipsPage from './features/results/ClassResultSlipsPage';
import AttendanceList from './features/attendance/AttendanceList';
import EnrollmentList from './features/enrollments/EnrollmentList';
import ReportsList from './features/reports/ReportsList';
import UserList from './features/users/UserList';
import AnnouncementList from './features/announcements/AnnouncementList';
import AnnouncementCreate from './features/announcements/AnnouncementCreate';
import AnnouncementUpdate from './features/announcements/AnnouncementUpdate';
import AnnouncementView from './features/announcements/AnnouncementView';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route
              path="students"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <StudentList />
                </ProtectedRoute>
              }
            />
            <Route
              path="students/add"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'staff']}>
                  <StudentForm />
                </ProtectedRoute>
              }
            />
            <Route path="students/:id" element={<StudentView />} />
            <Route
              path="students/:id/edit"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'staff']}>
                  <StudentForm />
                </ProtectedRoute>
              }
            />
            <Route path="students/:id/report-card" element={<StudentReportCard />} />
            <Route path="students/:id/result-slip" element={<StudentResultSlip />} />
            <Route path="students/:id/attendance" element={<MyAttendance />} />
            <Route
              path="classes"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'staff']}>
                  <ClassList />
                </ProtectedRoute>
              }
            />
            <Route
              path="subjects"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'staff']}>
                  <SubjectList />
                </ProtectedRoute>
              }
            />
            <Route
              path="teachers"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher']}>
                  <TeacherList />
                </ProtectedRoute>
              }
            />
            <Route
              path="class-subjects"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <ClassSubjectList />
                </ProtectedRoute>
              }
            />
            <Route
              path="academic-years"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <AcademicYearList />
                </ProtectedRoute>
              }
            />
            <Route
              path="terms"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'staff']}>
                  <TermList />
                </ProtectedRoute>
              }
            />
            <Route
              path="exams"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <ExamList />
                </ProtectedRoute>
              }
            />
            <Route path="results" element={<Navigate to="/dashboard/results/view" replace />} />
            <Route
              path="results/view"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <ResultList />
                </ProtectedRoute>
              }
            />
            <Route
              path="results/upload"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <UploadResultsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="results/slips"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <ResultSlipsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="results/slips/:classId"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <ClassResultSlipsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="results/class/:classId"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <ClassResultsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <ReportsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports/:classId"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <ReportsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="attendance"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <AttendanceList />
                </ProtectedRoute>
              }
            />
            <Route
              path="attendance/:classId"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <AttendanceList />
                </ProtectedRoute>
              }
            />
            <Route
              path="enrollments"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <EnrollmentList />
                </ProtectedRoute>
              }
            />
            <Route
              path="enrollments/:classId"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <EnrollmentList />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute roles={['admin']}>
                  <UserList />
                </ProtectedRoute>
              }
            />
            {/* Announcements — everyone signed in can view/list them (the
                backend only requires authentication for GET); only
                admin/headteacher can create, edit or delete, matching
                authorize('admin', 'headteacher') on the backend routes. */}
            <Route path="announcements" element={<AnnouncementList />} />
            <Route
              path="announcements/create"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <AnnouncementCreate />
                </ProtectedRoute>
              }
            />
            <Route path="announcements/:id" element={<AnnouncementView />} />
            <Route
              path="announcements/:id/edit"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <AnnouncementUpdate />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}