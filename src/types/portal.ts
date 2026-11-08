/* Shapes returned by the public applicant-portal API (Homepage/api/*.php).
 * Column names match the archon_nell_recruitment PostgreSQL tables. */

/** Every portal endpoint answers with a `success` flag, also when it rejects a request. */
export interface PortalResult {
    success: boolean;
    message?: string;
    errors?: string[];
    csrf_token?: string;
    redirect_url?: string | null;
    /** portal.php: where to send the applicant when a step is not reachable yet. */
    redirect?: 'apply' | 'recommendations';
}

export interface CareerLink {
    title: string;
    /** The portal job Apply Now uses, or null when there is none. */
    job_id: number | null;
    /** Its Job Posting ID: the job page is careers/<posting_no>. */
    posting_no: string;
}

export interface PortalBootstrap extends PortalResult {
    csrf_token: string;
    careers: CareerLink[];
}

export interface JobPosting {
    id: number;
    job_title: string;
}

export interface PortalApplicant extends PortalResult {
    full_name: string;
    applicant_number: string;
    preselected_job_id: number;
}

/** AI Resume Screening output (AIService::screenResume). */
export interface ScreeningSummary {
    skills?: string[];
    work_experience?: string[];
    education?: string[];
    certifications?: string[];
    summary?: string;
}

export interface ScreeningStepResult extends PortalResult {
    stage?: string;
    progress?: number;
    is_complete?: boolean;
    screening_summary?: ScreeningSummary | null;
}

/** AI Job Recommendation (matching.php). */
export interface JobRecommendation {
    job_id?: number;
    job_position_id: number | string;
    job_title?: string;
    description?: string;
    match_score: number | string;
    matching_skills?: string[];
    matching_experience?: string[];
    matching_education?: string[];
    ai_reason?: string;
    reason?: string;
}

export interface MatchingResult extends PortalResult {
    stage?: string;
    progress?: number;
    is_complete?: boolean;
    recommendations?: JobRecommendation[] | null;
}

export interface ReviewData extends PortalResult {
    job_position_id: number;
    applicant: {
        full_name: string;
        date_of_birth: string;
        gender: string;
        mobile_number: string;
        email: string;
        address: string;
        city: string;
        province: string;
    };
    education: { highest_attainment: string; course: string; year_graduated: string; school: string } | null;
    experience: {
        years_experience: string | number;
        current_position: string;
        previous_company: string;
        skills: string;
        certifications: string | null;
        professional_summary: string;
    } | null;
    resume: { original_filename: string; file_size: number; file_path: string } | null;
    recommendation: {
        job_title: string;
        match_score: number;
        matching_skills: string[];
        matching_experience: string[];
        matching_education: string[];
        ai_reason: string;
    };
    screening: { skills: string[]; experience: string[]; education: string[]; ai_summary: string };
}

export interface SubmitResult extends PortalResult {
    application?: { application_number: string };
}

export interface SubmittedApplication {
    application_number: string;
    applicant_number: string;
    full_name: string;
    job_title: string;
    status: string;
    match_score: string | number | null;
    submitted_at: string | null;
    email: string;
}

/* ---- Applicant Portal (Homepage/api/applicant_portal.php) ---- */

/** The e-mailed code step: masked address and seconds left on each timer. */
export interface ApplicantPortalPending {
    email: string;
    expires_in: number;
    resend_in: number;
}

export interface ApplicantPortalSession extends PortalResult {
    authenticated: boolean;
    pending: ApplicantPortalPending | null;
}

export interface ApplicantPortalAuthResult extends PortalResult {
    verification_required?: boolean;
    pending?: ApplicantPortalPending | null;
    /** The code step ended (too many attempts / resends): start again from the sign-in form. */
    restart?: boolean;
}

export type ProgressState = 'completed' | 'current' | 'pending' | 'rejected';

export interface ProgressStep {
    key: string;
    label: string;
    description: string;
    date: string | null;
    state: ProgressState;
}

export interface ApplicationUpdate {
    title: string;
    message: string;
    tone: 'info' | 'success' | 'warning' | 'danger';
    date: string | null;
}

export interface InterviewSchedule {
    round: string;
    scheduled_at: string;
    /** 'Face to Face' | 'Online', or null while HR has not set it. */
    type: string | null;
    location: string | null;
    meeting_link: string | null;
    interviewer: string | null;
    status: 'Scheduled' | 'Awaiting Result' | 'Completed';
    /** 'Pre-Interview' | 'Final Interview' (what interview_respond expects). */
    round_key?: string;
    /** Attendance confirmation of this interview (null when none was requested). */
    confirmation?: PortalInterviewConfirmation | null;
}

/** The applicant's attendance confirmation (3-day deadline, enforced by the server). */
export interface PortalInterviewConfirmation {
    status: 'Pending Confirmation' | 'Confirmed' | 'Declined' | 'Expired';
    deadline: string;
    /** Seconds until the deadline, computed by the server when the page was loaded. */
    seconds_left: number;
    responded_at: string | null;
    response_reason: string | null;
    can_respond: boolean;
}

/** What an e-mailed interview confirmation link is about (#/interview-confirmation). */
export interface InterviewConfirmationLink extends PortalResult {
    first_name?: string;
    round?: string;
    position?: string;
    department?: string;
    interview_at?: string;
    type?: string | null;
    location?: string | null;
    meeting_link?: string | null;
    status?: PortalInterviewConfirmation['status'] | 'Superseded';
    deadline?: string;
    seconds_left?: number;
    responded_at?: string | null;
    can_respond?: boolean;
    closed_message?: string | null;
}

export interface ApplicantDashboard extends PortalResult {
    authenticated: boolean;
    applicant: { full_name: string; first_name: string };
    summary: {
        application_id: string;
        job_posting_no: string | null;
        position: string;
        department: string;
        date_applied: string;
        status: string;
        status_tone: 'review' | 'interview' | 'hired' | 'rejected';
        status_message: string;
        latest_update: ApplicationUpdate;
        /** Set when the application was rejected. */
        rejection: { stage: string | null; reason: string | null; date: string | null } | null;
    };
    rejected: boolean;
    progress: ProgressStep[];
    interviews: InterviewSchedule[];
    updates: ApplicationUpdate[];
    application: {
        full_name: string;
        email: string;
        mobile_number: string;
        address: string;
        position: string;
        department: string;
        date_applied: string;
        resume: { file_name: string; file_size: number; uploaded_at: string } | null;
    };
    /** Every application of this applicant (same e-mail + date of birth). */
    applications: ApplicantApplicationSummary[];
    /** This application's job offer (details + Accept / Decline), or null. */
    offer?: PortalJobOffer | null;
    /** Future opportunities / Talent Pool / feedback of this application. */
    talent: PortalTalent | null;
}

/** A Future Job Opportunity invitation sent to this applicant (not a job offer). */
export interface PortalOpportunity {
    opportunity_no: string;
    status: 'Invited' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Expired';
    message: string | null;
    sent_at: string;
    expires_at: string | null;
    responded_at: string | null;
    posting_no: string;
    job_title: string;
    department: string | null;
    new_application_no: string | null;
}

export interface PortalTalent {
    status: string;
    future_pref: 'Pending Response' | 'Agreed' | 'Declined' | null;
    in_talent_pool: boolean;
    /** The applicant was invited and may answer or change their preference. */
    can_answer: boolean;
    opportunities: PortalOpportunity[];
    feedback: { allowed: boolean; submitted: boolean; ratings: Record<string, string> };
}

/** What an e-mailed answer link (#/opportunity) is about. */
export interface OpportunityLink extends PortalResult {
    type?: 'future' | 'job';
    first_name?: string;
    position?: string;
    job_title?: string;
    department?: string | null;
    posting_no?: string;
    employment_type?: string | null;
    expires_at?: string | null;
}

/* ---- Job Postings (Recruitment Management > Job Posting), applicant-facing ---- */

/** A job posting as applicants see it (careers page, job page, HR preview). */
export interface JobPostingPublic {
    posting_no: string;
    title: string;
    department: string;
    position: string;
    employment_type: string;
    work_setup: string;
    location: string;
    vacancies: number | null;
    description: string;
    responsibilities: string[];
    qualifications: string[];
    experience_required: string;
    required_skills: string[];
    preferred_skills: string[];
    /** e.g. "₱20,000 – ₱25,000 per month"; null when not disclosed. */
    salary: string | null;
    benefits: string[];
    opening_date: string | null;
    deadline: string | null;
    published_at: string | null;
    /** The id Apply Now carries (apply?job=<id>); null when applications are not accepted. */
    job_id: number | null;
    accepting: boolean;
}

/** Apply Now's job (portal.php?action=job). */
export interface ApplyJob extends JobPosting {
    posting_no: string | null;
    department: string | null;
    deadline: string | null;
}

/** "My Applications" in the Applicant Portal. */
export interface ApplicantApplicationSummary {
    application_id: string;
    job_title: string;
    job_posting_no: string | null;
    department: string;
    date_applied: string;
    status: string;
    status_tone: 'review' | 'interview' | 'hired' | 'rejected';
    current: boolean;
}

/** A job offer as the applicant sees it (Applicant Portal / e-mailed link). */
export interface PortalJobOffer {
    offer_no: string;
    position: string;
    department: string;
    employment_type: string;
    salary: number;
    start_date: string;
    work_schedule: string | null;
    benefits: string | null;
    terms: string | null;
    offer_date: string | null;
    expires_on: string;
    status: 'Extended' | 'Accepted' | 'Declined' | 'Expired' | 'Withdrawn';
    /** e.g. "Awaiting your answer", "Accepted - awaiting HR confirmation" */
    status_label: string;
    applicant_response: 'Accepted' | 'Declined' | null;
    responded_at: string | null;
    can_respond: boolean;
    closed_message: string | null;
}

export interface JobOfferLink extends PortalResult, Partial<PortalJobOffer> {
    first_name?: string;
}
