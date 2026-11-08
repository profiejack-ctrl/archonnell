import { lazy, Suspense, type ReactNode } from 'react';
import { createHashRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/AuthContext';
import AppLayout from './layouts/AppLayout';
import { MOVED_ROUTES, ROUTE_PERMISSIONS, canOpen } from './routes';
import LoginPage from './pages/LoginPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import RouteError from './components/RouteError';
const DashboardPage = lazy(() => import('./modules/dashboard/DashboardPage'));
const ApplicantValidationPage = lazy(() => import('./modules/applicants/ApplicantValidationPage'));
const CandidateRankingPage = lazy(() => import('./modules/applicants/CandidateRankingPage'));
const VacancyRequestsPage = lazy(() => import('./modules/recruitment/VacancyRequestsPage'));
const JobPostingsPage = lazy(() => import('./modules/recruitment/JobPostingsPage'));
const PreInterviewPage = lazy(() => import('./modules/recruitment/PreInterviewPage'));
const FinalInterviewPage = lazy(() => import('./modules/recruitment/FinalInterviewPage'));
const OnboardingPage = lazy(() => import('./modules/onboarding/OnboardingPage'));
const EmployeeDirectoryPage = lazy(() => import('./modules/hcm/EmployeeDirectoryPage'));
const EmployeeRecordsPage = lazy(() => import('./modules/records/EmployeeRecordsPage'));
const ProfilePage = lazy(() => import('./modules/ess/ProfilePage'));
const SettingsPage = lazy(() => import('./modules/ess/SettingsPage'));
const AnnouncementsPage = lazy(() => import('./modules/announcements/AnnouncementsPage'));
const UserDirectoryPage = lazy(() => import('./modules/admin/UserDirectoryPage'));
const RegisterUserPage = lazy(() => import('./modules/admin/RegisterUserPage'));
const RolesPage = lazy(() => import('./modules/admin/RolesPage'));
const PermissionsPage = lazy(() => import('./modules/admin/PermissionsPage'));
const AuditLogsPage = lazy(() => import('./modules/admin/AuditLogsPage'));
const TalentPoolPage = lazy(() => import('./modules/applicants/TalentPoolPage'));
const RejectedApplicantsPage = lazy(() => import('./modules/applicants/RejectedApplicantsPage'));
const ArchivedApplicantsPage = lazy(() => import('./modules/applicants/ArchivedApplicantsPage'));
const ReportsPage = lazy(() => import('./modules/reports/ReportsPage'));
const AttendanceSchedulePage = lazy(() => import('./modules/attendance/AttendanceSchedulePage'));
const LeaveModulePage = lazy(() => import('./modules/leave/LeaveModulePage'));

function Loading() {
    return (
        <div className="chart-state-box" style={{ minHeight: '100vh' }}>
            <div className="chart-spinner"></div>
        </div>
    );
}

/** Shown in the content area while a page module downloads. */
function PageLoading() {
    return (
        <div className="chart-state-box" style={{ minHeight: 160 }}>
            <div className="chart-spinner"></div>
        </div>
    );
}

/** Protected area: no session -> login page (remembering where the user was going). */
function RequireAuth({ children }: { children: ReactNode }) {
    const { session, loading, expired } = useAuth();
    const location = useLocation();
    if (loading) return <Loading />;
    if (!session) return <Navigate to={expired ? '/login?msg=timeout' : '/login'} replace state={{ from: location.pathname }} />;
    return <>{children}</>;
}

/** Page permission gate (UI only - the API enforces the same permission). */
function Gate({ path, children }: { path: string; children: ReactNode }) {
    const { can } = useAuth();
    if (!canOpen(path, can)) return <Navigate to="/unauthorized" replace />;
    return <>{children}</>;
}

/** "/" -> the page the user was last on (if still permitted), else the role's landing page. */
function Landing() {
    const { session, can } = useAuth();
    if (!session) return <Navigate to="/login" replace />;
    let saved: string | null = null;
    try { saved = localStorage.getItem('archon_active_page'); } catch { /* ignore */ }
    const savedPath = saved ? `/${saved}` : null;
    if (savedPath && ROUTE_PERMISSIONS[savedPath] && canOpen(savedPath, can)) {
        return <Navigate to={savedPath} replace />;
    }
    return <Navigate to={`/${session.landing_page}`} replace />;
}

// errorElement: a page that fails (e.g. its chunk is from an older build) shows RouteError inside the layout.
const page = (path: string, element: ReactNode) => ({ path, errorElement: <RouteError />, element: <Gate path={path}><Suspense fallback={<PageLoading />}>{element}</Suspense></Gate> });

const router = createHashRouter([
    { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
    { path: '/unauthorized', element: <UnauthorizedPage />, errorElement: <RouteError /> },
    {
        element: <RequireAuth><AppLayout /></RequireAuth>,
        errorElement: <RouteError />,
        children: [
            { index: true, element: <Landing /> },
            page('/dashboard', <DashboardPage />),
            page('/applicant-validation', <ApplicantValidationPage />),
            page('/candidate-ranking', <CandidateRankingPage />),
            page('/talent-pool', <TalentPoolPage />),
            page('/rejected-applicants', <RejectedApplicantsPage />),
            page('/archived-applicants', <ArchivedApplicantsPage />),
            page('/job-postings', <JobPostingsPage />),
            page('/vacancy-requests', <VacancyRequestsPage />),
            page('/pre-interview', <PreInterviewPage />),
            page('/final-interview', <FinalInterviewPage />),
            page('/new-hire-onboarding', <OnboardingPage />),
            page('/employee-directory', <EmployeeDirectoryPage />),
            page('/employee-records', <EmployeeRecordsPage />),
            page('/attendance-schedule', <AttendanceSchedulePage />),
            page('/leave-management', <LeaveModulePage />),
            page('/reports', <ReportsPage />),
            ...Object.entries(MOVED_ROUTES).map(([from, to]) => ({ path: from, element: <Navigate to={to} replace /> })),
            page('/employee-self-service', <ProfilePage />),
            page('/settings', <SettingsPage />),
            page('/announcements', <AnnouncementsPage />),
            page('/admin/users', <UserDirectoryPage />),
            page('/admin/create-user', <RegisterUserPage />),
            page('/admin/roles', <RolesPage />),
            page('/admin/permissions', <PermissionsPage />),
            page('/admin/audit-logs', <AuditLogsPage />),
            { path: '*', element: <Landing /> },
        ],
    },
]);

export default function App() {
    return (
        <AuthProvider>
            <RouterProvider router={router} />
        </AuthProvider>
    );
}
