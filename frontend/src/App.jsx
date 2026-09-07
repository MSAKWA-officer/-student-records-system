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
import SubjectCreate from './features/subjects/SubjectCreate';
import SubjectUpdate from './features/subjects/SubjectUpdate';
import SchoolSubjectList from './features/schoolSubjects/SchoolSubjectList';
import SchoolSubjectCreate from './features/schoolSubjects/SchoolSubjectCreate';
import SchoolSubjectUpdate from './features/schoolSubjects/SchoolSubjectUpdate';
import TeacherList from './features/teachers/TeacherList';
import TeacherCreate from './features/teachers/TeacherCreate';
import TeacherUpdate from './features/teachers/TeacherUpdate';
import TeacherView from './features/teachers/TeacherView';
import ClassSubjectList from './features/classSubjects/ClassSubjectList';
import ClassSubjectCreate from './features/classSubjects/ClassSubjectCreate';
import ClassSubjectUpdate from './features/classSubjects/ClassSubjectUpdate';
import ClassSubjectView from './features/classSubjects/ClassSubjectView';
import AcademicYearList from './features/academicYears/AcademicYearList';
import TermList from './features/terms/TermList';
import ExamList from './features/exams/ExamList';
import ExamCreate from './features/exams/ExamCreate';
import ExamUpdate from './features/exams/ExamUpdate';
import ClassResultsPage from './features/results/ClassResultsPage';
import ClassResultSlipsPage from './features/results/ClassResultSlipsPage';
import OLevelResultList from './features/results/olevel/ResultList';
import OLevelResultCreate from './features/results/olevel/ResultCreate';
import OLevelResultUpdate from './features/results/olevel/ResultUpdate';
import OLevelResultView from './features/results/olevel/ResultView';
import AttendanceList from './features/attendance/AttendanceList';
import EnrollmentList from './features/enrollments/EnrollmentList';
import EnrollmentCreate from './features/enrollments/EnrollmentCreate';
import EnrollmentUpdate from './features/enrollments/EnrollmentUpdate';
import EnrollmentView from './features/enrollments/EnrollmentView';
import ReportsList from './features/reports/ReportsList';
import UserList from './features/users/UserList';
import AnnouncementList from './features/announcements/AnnouncementList';
import AnnouncementCreate from './features/announcements/AnnouncementCreate';
import AnnouncementUpdate from './features/announcements/AnnouncementUpdate';
import AnnouncementView from './features/announcements/AnnouncementView';
import ClassGatewayManager from './features/smsGateways/ClassGatewayManager';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

             <Route path="/forgot-password" element={<ForgotPassword />} />
   <Route path="/reset-password" element={<ResetPassword />} />


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
              path="subjects/add"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <SubjectCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="subjects/:id/edit"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <SubjectUpdate />
                </ProtectedRoute>
              }
            />
            <Route
              path="school-subjects"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'staff']}>
                  <SchoolSubjectList />
                </ProtectedRoute>
              }
            />
            <Route
              path="school-subjects/add"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <SchoolSubjectCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="school-subjects/:id/edit"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <SchoolSubjectUpdate />
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
              path="teachers/add"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <TeacherCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="teachers/:id"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher']}>
                  <TeacherView />
                </ProtectedRoute>
              }
            />
            <Route
              path="teachers/:id/edit"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <TeacherUpdate />
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
              path="class-subjects/add"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <ClassSubjectCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="class-subjects/view"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <ClassSubjectView />
                </ProtectedRoute>
              }
            />
            <Route
              path="class-subjects/edit"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <ClassSubjectUpdate />
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
            <Route
              path="exams/add"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher']}>
                  <ExamCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="exams/:id/edit"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher']}>
                  <ExamUpdate />
                </ProtectedRoute>
              }
            />
            <Route path="results" element={<Navigate to="/dashboard/results/o-level" replace />} />
            <Route
              path="results/o-level"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <OLevelResultList />
                </ProtectedRoute>
              }
            />
            <Route
              path="results/o-level/create"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher']}>
                  <OLevelResultCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="results/o-level/:id"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher', 'staff']}>
                  <OLevelResultView />
                </ProtectedRoute>
              }
            />
            <Route
              path="results/o-level/:id/edit"
              element={
                <ProtectedRoute roles={['admin', 'headteacher', 'teacher']}>
                  <OLevelResultUpdate />
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
              path="enrollments/class/:classId"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <EnrollmentList />
                </ProtectedRoute>
              }
            />
            <Route
              path="enrollments/create"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <EnrollmentCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="enrollments/:id"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <EnrollmentView />
                </ProtectedRoute>
              }
            />
            <Route
              path="enrollments/:id/edit"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <EnrollmentUpdate />
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

                        <Route
              path="sms-gateways"
              element={
                <ProtectedRoute roles={['admin', 'headteacher']}>
                  <ClassGatewayManager />
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