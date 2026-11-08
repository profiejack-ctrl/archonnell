import { PERM } from './hooks/AuthContext';

/**
 * Route -> permission gate. Paths keep the legacy page ids (index.php#<id>),
 * so old links like index.php#announcements still land on the same page.
 */
// An array: any one of the permissions opens the page (the page shows what that user may see).
export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
    '/dashboard': PERM.DASHBOARD,
    '/applicant-validation': PERM.APPLICANTS,
    '/candidate-ranking': PERM.APPLICANTS,
    '/talent-pool': PERM.APPLICANTS,
    '/rejected-applicants': PERM.APPLICANTS,
    '/archived-applicants': PERM.APPLICANTS,
    '/job-postings': PERM.RECRUITMENT,
    // Signed-in staff; the page and the API decide who may request / approve / post.
    '/vacancy-requests': PERM.ESS,
    '/pre-interview': PERM.RECRUITMENT,
    '/final-interview': PERM.RECRUITMENT,
    '/new-hire-onboarding': PERM.ONBOARDING,
    '/employee-directory': PERM.CORE_HCM,
    '/employee-records': PERM.EMPLOYEE_RECORDS,
    // HR staff see every employee; everyone else only their own records (the API enforces both).
    '/attendance-schedule': [PERM.TIME_ATTENDANCE, PERM.SHIFT_SCHEDULE, PERM.ESS],
    '/leave-management': [PERM.LEAVE, PERM.ESS],
    '/reports': PERM.REPORTS,
    '/employee-self-service': PERM.ESS,
    '/settings': PERM.ESS,
    '/announcements': PERM.ANNOUNCEMENTS,
    '/admin/users': PERM.USER_MANAGEMENT,
    '/admin/create-user': PERM.USER_MANAGEMENT,
    '/admin/roles': PERM.ROLE_MANAGEMENT,
    '/admin/permissions': PERM.PERMISSION_MANAGEMENT,
    '/admin/audit-logs': PERM.AUDIT_LOGS,
};

/** Legacy standalone admin page titles (the SPA pages derived theirs from the page id). */
const ADMIN_TITLES: Record<string, string> = {
    '/admin/users': 'User Directory',
    '/admin/create-user': 'Register New System User',
    '/admin/roles': 'Roles & Permissions',
    '/admin/permissions': 'Permissions',
    '/admin/audit-logs': 'Audit Logs',
    '/job-postings': 'Job Posting',
    '/vacancy-requests': 'Vacancy Requests',
    '/attendance-schedule': 'Attendance & Schedule',
    '/leave-management': 'Leave Management',
};

export function pageTitle(pathname: string): string {
    if (ADMIN_TITLES[pathname]) return ADMIN_TITLES[pathname];
    return pathname.replace(/^\//, '').replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Former pages of these modules (bookmarks, older notification links) -> where they live now. */
export const MOVED_ROUTES: Record<string, string> = {
    '/time-attendance': '/attendance-schedule?view=attendance',
    '/shift-schedule': '/attendance-schedule?view=schedule',
    '/my-attendance': '/attendance-schedule?view=mine',
    '/my-leave': '/leave-management?view=mine',
};

/** True when the user holds the route's permission (or one of them). */
export function canOpen(path: string, can: (permission: string) => boolean): boolean {
    const perm = ROUTE_PERMISSIONS[path];
    if (!perm) return true;
    return Array.isArray(perm) ? perm.some(can) : can(perm);
}
