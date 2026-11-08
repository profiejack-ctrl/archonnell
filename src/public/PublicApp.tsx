import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { PortalProvider } from './PortalContext';
import { ApplicantLayout, PublicLayout } from './layouts/SiteLayouts';
import HomePage from './pages/HomePage';
import { AboutPage, ContactPage, EmployeePortalPage, PartnersPage, ProductsPage, ProjectsPage } from './pages/CompanyPages';
import { CareersPage, JobPostingPage } from './pages/CareersPages';
import ApplyPage from './pages/ApplyPage';
import ScreeningPage from './pages/ScreeningPage';
import RecommendationsPage from './pages/RecommendationsPage';
import ReviewPage from './pages/ReviewPage';
import SuccessPage from './pages/SuccessPage';
import ApplicantPortalLoginPage from './pages/portal/ApplicantPortalLoginPage';
import ApplicantPortalDashboardPage from './pages/portal/ApplicantPortalDashboardPage';
import OpportunityResponsePage from './pages/portal/OpportunityResponsePage';
import InterviewConfirmationPage from './pages/portal/InterviewConfirmationPage';
import JobOfferResponsePage from './pages/portal/JobOfferResponsePage';
import RouteError from '../components/RouteError';

/**
 * Public website + applicant portal (formerly Homepage/*.php).
 * The old URLs (Homepage/index.php, Homepage/Pages/about.php,
 * Homepage/applicant/apply.php?job=3, ...) redirect to these routes.
 */
const router = createHashRouter([
    {
        element: <PublicLayout />,
        errorElement: <RouteError />,
        children: [
            { path: '/', element: <HomePage /> },
            { path: '/about', element: <AboutPage /> },
            { path: '/projects', element: <ProjectsPage /> },
            { path: '/products', element: <ProductsPage /> },
            { path: '/partners', element: <PartnersPage /> },
            { path: '/contact', element: <ContactPage /> },
            { path: '/employee-portal', element: <EmployeePortalPage /> },
            // Job vacancies: Published postings -> job page -> Apply Now (apply?job=<id>).
            { path: '/careers', element: <CareersPage /> },
            { path: '/careers/:postingNo', element: <JobPostingPage /> },
        ],
    },
    {
        // Job Posting -> Apply Now -> AI Resume Screening -> AI Job Recommendation -> Review & Submit
        element: <ApplicantLayout />,
        errorElement: <RouteError />,
        children: [
            { path: '/apply', element: <ApplyPage /> },
            { path: '/screening', element: <ScreeningPage /> },
            { path: '/recommendations', element: <RecommendationsPage /> },
            { path: '/review', element: <ReviewPage /> },
            { path: '/success', element: <SuccessPage /> },
            // Applicant Portal: sign in, then the applicant's own application status.
            { path: '/applicant-portal', element: <ApplicantPortalLoginPage /> },
            { path: '/applicant-portal/dashboard', element: <ApplicantPortalDashboardPage /> },
            // E-mailed answer links: future opportunity consent / Future Job Opportunity.
            { path: '/opportunity', element: <OpportunityResponsePage /> },
            // E-mailed interview attendance confirmation link (3-day deadline).
            { path: '/interview-confirmation', element: <InterviewConfirmationPage /> },
            // E-mailed job offer Accept / Decline link (until the expiration date).
            { path: '/job-offer', element: <JobOfferResponsePage /> },
        ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
]);

export default function PublicApp() {
    return (
        <PortalProvider>
            <RouterProvider router={router} />
        </PortalProvider>
    );
}
