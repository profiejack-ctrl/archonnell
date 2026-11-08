import { backendUrl } from './http';
import type {
    ApplicantDashboard, ApplicantPortalAuthResult, InterviewConfirmationLink, JobOfferLink, OpportunityLink, ApplicantPortalSession, ApplyJob,
    JobPostingPublic, MatchingResult, PortalApplicant, PortalBootstrap, PortalResult, ReviewData,
    ScreeningStepResult, SubmitResult, SubmittedApplication,
} from '../types/portal';

/**
 * Public site / applicant portal API (Homepage/api/*.php, database
 * archon_nell_recruitment). It keeps its own PHP session and CSRF token,
 * separate from the HRMS login.
 */

const PORTAL_API = 'Homepage/api/';

let csrfToken = '';
export function setPortalCsrfToken(token: string): void { csrfToken = token || ''; }
export function getPortalCsrfToken(): string { return csrfToken; }

/**
 * The portal endpoints answer with a JSON body carrying `success` even when
 * they reject a request (bad token 403, validation 422, rate limit 429...),
 * so that body is returned for the caller to handle; only a missing or
 * unreadable body is an error (same rules as the former js/applicant.js).
 */
async function request<T extends PortalResult>(url: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
    } catch {
        throw new Error('Network connection error. Please check your connection and try again.');
    }

    let rawText = '';
    try {
        rawText = await response.text();
    } catch {
        throw new Error('Server response could not be read. Please try again.');
    }

    let result: T;
    try {
        result = JSON.parse(rawText) as T;
    } catch {
        if (!response.ok) {
            throw new Error(`Server error (HTTP ${response.status}). Please try again or contact support.`);
        }
        throw new Error('Invalid server response format. Please refresh the page and try again.');
    }

    if (result && typeof result === 'object' && result.csrf_token && typeof result.csrf_token === 'string') {
        setPortalCsrfToken(result.csrf_token);
    }

    if (!result || typeof result !== 'object' || typeof result.success === 'undefined') {
        throw new Error((result as Partial<PortalResult> | null)?.message || `Request failed (HTTP ${response.status}). Please try again.`);
    }
    return result;
}

function get<T extends PortalResult>(params: Record<string, string | number>, file = 'portal.php'): Promise<T> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    return request<T>(`${backendUrl(PORTAL_API + file)}?${qs.toString()}`, { headers: { Accept: 'application/json' } });
}

function post<T extends PortalResult>(file: string, body: FormData): Promise<T> {
    if (csrfToken) {
        body.set('csrf_token', csrfToken);
    }
    const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
    };
    if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }
    return request<T>(backendUrl(PORTAL_API + file), {
        method: 'POST',
        body,
        headers,
    });
}

function fields(values: Record<string, string | number>): FormData {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => fd.append(k, String(v)));
    return fd;
}

export const portalService = {
    /** CSRF token + the careers slide's job links. */
    bootstrap: async () => {
        const data = await get<PortalBootstrap>({ action: 'bootstrap' });
        setPortalCsrfToken(data.csrf_token);
        return data;
    },
    /** The job Apply Now applies for (?job=<id>); unavailable = it no longer accepts applications. */
    job: (id: number) => get<PortalResult & { job: ApplyJob | null; unavailable: boolean }>({ action: 'job', id }),
    /** Careers page: Published job postings that accept applications. */
    jobs: () => get<PortalResult & { jobs: JobPostingPublic[] }>({ action: 'jobs' }),
    /** One job page by Job Posting ID (null when it is not open to applicants). */
    jobPosting: (postingNo: string) =>
        get<PortalResult & { posting: JobPostingPublic | null }>({ action: 'job_posting', no: postingNo }),
    applicant: (applicantId: number) => get<PortalApplicant>({ action: 'applicant', applicant: applicantId }),
    review: (applicantId: number) => get<ReviewData>({ action: 'review', applicant: applicantId }),
    application: (applicationNumber: string) =>
        get<PortalResult & { application: SubmittedApplication | null }>({ action: 'application', app: applicationNumber }),

    /** Step 1: applicant details + resume upload. */
    uploadApplication: (form: FormData) => post<PortalResult & { applicant_id?: number }>('resume_upload.php', form),
    /** Step 2: one stage of AI Resume Screening. */
    screeningStep: (applicantId: number, stage: string) =>
        post<ScreeningStepResult>('screening_process.php', fields({ applicant_id: applicantId, stage })),
    /** Step 3: AI Job Recommendation. */
    generateRecommendations: (applicantId: number, stage: string) =>
        post<MatchingResult>('matching.php', fields({ applicant_id: applicantId, action: 'generate', stage })),
    getRecommendations: (applicantId: number) =>
        post<MatchingResult>('matching.php', fields({ applicant_id: applicantId, action: 'get_recommendations' })),
    selectJob: (applicantId: number, jobPositionId: number) =>
        post<PortalResult>('matching.php', fields({ applicant_id: applicantId, job_position_id: jobPositionId, action: 'select_job' })),
    /** Step 4: submit the application (e-mail confirmation + HRMS bridge run server-side). */
    submit: (applicantId: number, jobPositionId: number) =>
        post<SubmitResult>('submit_application.php', fields({ applicant_id: applicantId, job_position_id: jobPositionId, action: 'submit' })),
};

const APPLICANT_PORTAL = 'applicant_portal.php';

/**
 * Applicant Portal: sign in with the application's details (+ an e-mailed
 * code), then read that one application. The application is always taken
 * from the signed-in session, never from an id sent by the browser.
 */
export const applicantPortalService = {
    session: () => get<ApplicantPortalSession>({ action: 'session' }, APPLICANT_PORTAL),
    login: (applicationNumber: string, email: string, dateOfBirth: string) =>
        post<ApplicantPortalAuthResult>(APPLICANT_PORTAL, fields({
            action: 'login', application_number: applicationNumber, email, date_of_birth: dateOfBirth,
        })),
    verify: (code: string) => post<ApplicantPortalAuthResult>(APPLICANT_PORTAL, fields({ action: 'verify', code })),
    resend: () => post<ApplicantPortalAuthResult>(APPLICANT_PORTAL, fields({ action: 'resend' })),
    cancel: () => post<PortalResult>(APPLICANT_PORTAL, fields({ action: 'cancel' })),
    logout: () => post<PortalResult>(APPLICANT_PORTAL, fields({ action: 'logout' })),
    /**
     * passive: background refresh, which does not extend the 30-minute session.
     * app: switch to another of the applicant's own applications (My Applications).
     */
    dashboard: (passive = false, app = '') =>
        get<ApplicantDashboard>({ action: 'dashboard', ...(passive ? { passive: 1 } : {}), ...(app ? { app } : {}) }, APPLICANT_PORTAL),
    /** The signed-in applicant's resume (PDF opens in the browser, Word downloads). */
    resumeUrl: () => backendUrl(PORTAL_API + 'resume.php?portal=1'),
    /** Consider me for future opportunities (yes) or do not contact me (no). */
    futurePreference: (choice: 'yes' | 'no') => post<PortalResult>(APPLICANT_PORTAL, fields({ action: 'future_preference', choice })),
    /** Answer one of the applicant's own Future Job Opportunity invitations. */
    respondOpportunity: (opportunityNo: string, choice: 'accept' | 'decline') =>
        post<PortalResult & { application_no?: string | null }>(APPLICANT_PORTAL, fields({ action: 'opportunity_respond', opportunity_no: opportunityNo, choice })),
    /** Recruitment experience feedback (ratings 1-5 + comments), once per application. */
    submitFeedback: (values: Record<string, string>) => post<PortalResult>(APPLICANT_PORTAL, fields({ action: 'submit_feedback', ...values })),
    /** Accept / decline the signed-in application's own job offer (reason required to decline). */
    offerRespond: (choice: 'accept' | 'decline', reason = '') => post<PortalResult>(APPLICANT_PORTAL, fields({ action: 'offer_respond', choice, reason })),
    /** Confirm / decline the signed-in application's own interview (reason required to decline). */
    interviewRespond: (round: string, choice: 'confirm' | 'decline', reason = '') =>
        post<PortalResult & { expired?: boolean }>(APPLICANT_PORTAL, fields({ action: 'interview_respond', round, choice, reason })),
};

const INTERVIEW_CONFIRMATION = 'interview_confirmation.php';

/** Interview confirmation links e-mailed to applicants (3-day deadline). */
export const interviewConfirmationService = {
    lookup: (token: string) => get<InterviewConfirmationLink>({ action: 'lookup', token }, INTERVIEW_CONFIRMATION),
    respond: (token: string, choice: 'confirm' | 'decline', reason = '') =>
        post<PortalResult & { status?: string; expired?: boolean }>(INTERVIEW_CONFIRMATION, fields({ action: 'respond', token, choice, reason })),
};

const OPPORTUNITY = 'opportunity.php';

/** Answer links e-mailed to applicants (future opportunity consent, job opportunity). */
export const opportunityService = {
    lookup: (type: string, token: string) => get<OpportunityLink>({ action: 'lookup', type, token }, OPPORTUNITY),
    respond: (type: string, token: string, choice: string) =>
        post<PortalResult & { application_no?: string | null }>(OPPORTUNITY, fields({ action: 'respond', type, token, choice })),
};

const JOB_OFFER_RESPONSE = 'job_offer_response.php';

/** Job offer Accept / Decline links e-mailed to applicants. */
export const jobOfferLinkService = {
    lookup: (token: string) => get<JobOfferLink>({ action: 'lookup', token }, JOB_OFFER_RESPONSE),
    respond: (token: string, choice: 'accept' | 'decline', reason = '') =>
        post<PortalResult>(JOB_OFFER_RESPONSE, fields({ action: 'respond', token, choice, reason })),
};
