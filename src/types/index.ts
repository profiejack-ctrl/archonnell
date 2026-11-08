/* Shapes returned by the PHP API (api.php / auth-api.php). Column names match
 * the PostgreSQL tables; numeric(5,2) values arrive as strings, as before. */

export type Permission =
    | 'dashboard' | 'applicant_management' | 'recruitment_management' | 'onboarding_management'
    | 'core_hcm' | 'ess' | 'employee_records' | 'user_management' | 'role_management'
    | 'permission_management' | 'system_settings' | 'reports' | 'audit_logs' | 'announcement_management';

export interface CurrentUser {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    role_id: number;
    role_name: string;
}

export interface Session {
    user: CurrentUser;
    permissions: string[];
    landing_page: string;
    csrf_token: string;
    timeout: number;
    remaining: number;
    unread_count: number;
    mail_from: string;
    /** Vacancy Requests: the department this user manages (may request), Super Admin (approves), Recruitment (posts). */
    vacancy?: { manager_of: string | null; is_admin: boolean; can_recruit: boolean };
}

export interface Applicant {
    id: number;
    applicant_no: string | null;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    full_name: string;
    position: string;
    email: string | null;
    mobile_number: string | null;
    resume_path: string | null;
    match_score: string | null;
    status: string;
    stage: string;
    pre_interview_at: string | null;
    final_interview_at: string | null;
    /** Final Interview > Schedule details (the pre-interview keeps its own). */
    final_interview_type?: string | null;
    final_interview_location?: string | null;
    final_interviewer?: string | null;
    /** Pre-interview details. */
    interview_type?: string | null;
    interview_location?: string | null;
    interviewer?: string | null;
    /** Latest attendance confirmation request of the stage's interview (Pre-Interview / Final Interview pages). */
    confirmation?: InterviewConfirmation | null;
    /** Department of the position (interview pages). */
    department?: string | null;
    applied_at: string;
    updated_at?: string;
    /** The Job Posting applied through (Recruitment Management > Job Posting). */
    job_posting_id?: number | null;
    job_posting_no?: string | null;
    job_posting_title?: string | null;
    job_posting_department?: string | null;
    /** Set once rejected (the record is kept). */
    rejection_stage?: string | null;
    rejection_reason?: string | null;
    rejected_at?: string | null;
    rejected_by_name?: string | null;
}

/**
 * A Candidate Ranking row: the applicant plus its three scores (0-100).
 * resume_score / quality_of_hire are null when that data is not available.
 */
export interface RankedCandidate extends Applicant {
    resume_score: number | null;
    role_fit: number;
    quality_of_hire: number | null;
    overall_score: number;
}

export interface Employee {
    id: number;
    employee_no: string;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    full_name: string;
    email: string | null;
    mobile_number: string | null;
    /** As entered on the application form (Male / Female / Other / Prefer not to say). */
    gender: string | null;
    date_of_birth: string | null;
    address: string | null;
    department: string;
    position: string;
    employment_status: string;
    contract_type: string;
    date_hired: string | null;
    applicant_id: number | null;
    created_at: string;
    /** Recruitment history: the application and Job Posting this employee was hired from. */
    application_no?: string | null;
    applied_at?: string | null;
    job_posting_no?: string | null;
    job_posting_title?: string | null;
}

export interface OnboardingRow {
    id: number;
    employee_id: number | null;
    status: string;
    progress: number;
    eno: string | null;
    fname: string | null;
    dep: string | null;
    pos: string | null;
    ctr: string;
    dh: string | null;
}

export interface DepartmentHires { department: string; count: number; color: string }
export interface HiresOverTime { year_month: string; label: string; short_label: string; count: number }
export interface OnboardingCharts {
    department_hires: DepartmentHires[];
    hires_over_time: HiresOverTime[];
    total_new_hires: number;
}

export interface Distribution {
    items: { name: string; count: number; pct: number; color: string }[];
    total: number;
}

export interface WorkforceStats {
    total: number;
    active: number;
    on_leave: number;
    inactive: number;
    depts: number;
    statuses: { name: string; count: number; pct: number; pct_label: number; color: string }[];
}

export interface Announcement {
    id: number;
    title: string;
    summary: string | null;
    cover_image: string | null;
    body: string;
    status: string;
    published_at: string;
    end_at: string | null;
    show_on_dashboard: boolean;
    scope_all: boolean;
    withdrawn_at: string | null;
    created_at: string;
    updated_at: string;
    scope_departments: string[];
    created_by_name: string | null;
    updated_by_name: string | null;
}

export interface DashboardAnnouncement {
    id: number;
    title: string;
    summary: string | null;
    body: string;
    cover_image: string | null;
    published_at: string;
    created_by_name: string | null;
}

export interface NotificationItem {
    id: number;
    title: string;
    summary: string | null;
    published_at: string;
    cover_image: string | null;
    created_by_name: string | null;
    is_read: boolean;
}

export interface DirectoryUser {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    status: string;
    role_id: number;
    role_name: string;
    last_login: string | null;
    created_at: string;
    employee_id: number | null;
    employee_no: string | null;
    middle_name: string | null;
    department: string | null;
    position: string | null;
    mobile_number: string | null;
    date_hired: string | null;
}

export interface Department { id: number; name: string }
export interface Position { id: number; title: string; department_id: number | null }
export interface Role { id: number; role_name: string }

export interface EmployeeDocument {
    id: number;
    employee_id: number;
    doc_type: DocType;
    original_filename: string;
    stored_filename: string;
    file_path: string;
    file_size: number;
    uploaded_at: string;
    uploaded_by_username: string | null;
}
export type DocType = 'resume' | 'contract' | 'certificate' | 'valid_id';

export interface Profile {
    user_id: number;
    username: string;
    account_email: string;
    role_name: string;
    employee_id: number | null;
    employee_no: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    department: string | null;
    position: string | null;
    work_email: string | null;
    mobile_number: string | null;
    employment_status: string | null;
    contract_type: string | null;
    date_hired: string | null;
    years_of_service: number | null;
    // Locked (verified) information and recruitment history.
    middle_name?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    applicant_no?: string | null;
    applied_at?: string | null;
    position_applied?: string | null;
}

export type InfoField = 'first_name' | 'middle_name' | 'last_name' | 'date_of_birth' | 'gender' | 'date_hired';

/** A request to correct an employee's locked information (Information Change Request). */
export interface InfoChangeRequest {
    id: number;
    request_no: string;
    employee_id: number;
    employee_no: string;
    full_name: string;
    department: string;
    position: string;
    field_name: InfoField;
    field_label: string;
    current_value: string | null;
    requested_value: string | null;
    current_label: string;
    requested_label: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
    requested_by: number | null;
    requested_by_name: string | null;
    requested_by_role: string | null;
    self_requested: boolean;
    reviewed_by_name: string | null;
    reviewed_by_role: string | null;
    reviewed_at: string | null;
    review_remarks: string | null;
    created_at: string;
    updated_at: string;
}

export interface AuditLog {
    id: number;
    user_id: number | null;
    username: string | null;
    action: string;
    module: string | null;
    description: string | null;
    status: string | null;
    ip_address: string | null;
    created_at: string;
}

export interface AiDetail {
    available: boolean;
    education: { highest_attainment: string; school: string; course: string } | null;
    experience: { years_experience: string; current_position: string; previous_company: string } | null;
    screening: { extracted_skills: string[]; ai_summary: string | null; job_evaluation?: JobEvaluation | null } | null;
    recommendation: { job_title: string; match_score: string; ai_reason: string | null } | null;
}

/** The applicant's AI-screened resume checked against their Job Posting's requirements (HR only). */
export interface JobEvaluation {
    job_posting_no: string;
    job_title: string;
    score: number;
    required_skills_matched: string[];
    required_skills_missing: string[];
    preferred_skills_matched: string[];
    experience_required: string;
    applicant_years: number | null;
    meets_experience: boolean | null;
    meets_education: boolean | null;
    summary: string;
}

export type JobPostingStatus = 'Draft' | 'Published' | 'Closed' | 'Archived';

/** Recruitment Management > Job Posting (HR view: form values, history and counts). */
export interface JobPosting {
    id: number;
    posting_no: string;
    title: string;
    department: string;
    department_linked: boolean;
    position: string;
    employment_type: string;
    work_setup: string;
    location: string;
    vacancies: number | null;
    description: string;
    responsibilities: string;
    qualifications: string;
    experience_required: string;
    required_skills: string;
    preferred_skills: string;
    salary_min: string | null;
    salary_max: string | null;
    benefits: string;
    opening_date: string | null;
    deadline: string | null;
    status: JobPostingStatus;
    /** Published and between its opening date and deadline. */
    accepting: boolean;
    created_at: string;
    updated_at: string | null;
    published_at: string | null;
    closed_at: string | null;
    archived_at: string | null;
    created_by_name: string | null;
    updated_by_name: string | null;
    published_by_name: string | null;
    applicant_count: number;
    hired_count: number;
    /** The approved vacancy request this posting fills (null for postings made before requests existed). */
    vacancy_request_id: number | null;
    vacancy_request_no: string | null;
    approved_vacancies: number | null;
}

/** An applicant listed under a Job Posting. */
export interface JobPostingApplicant {
    id: number;
    applicant_no: string | null;
    full_name: string;
    email: string | null;
    stage: string;
    status: string;
    match_score: string | null;
    applied_at: string;
    source_application_no: string | null;
}

/** Applicant View (Applicant Validation / Pre-Interview / Final Interview). The name is read-only. */
export interface ApplicantDetail {
    applicant: {
        id: number;
        applicant_no: string | null;
        full_name: string;
        email: string | null;
        mobile_number: string | null;
        date_of_birth: string | null;
        gender: string | null;
        address: string | null;
        applied_at: string;
        status: string;
        stage: string;
        position: string;
        application_no: string | null;
        resume_path: string | null;
        pre_interview_at: string | null;
        interview_type: string | null;
        interview_location: string | null;
        interviewer: string | null;
        final_interview_at: string | null;
        final_interview_type: string | null;
        final_interview_location: string | null;
        final_interviewer: string | null;
    };
    job_posting: { posting_no: string; title: string; position: string | null; department: string; employment_type: string | null } | null;
    rejection: { stage: string | null; category?: string | null; reason: string | null; rejected_at: string | null; rejected_by: string | null } | null;
    resume_available: boolean;
    history: { action: string; description: string; created_at: string; username: string | null }[];
    /** Future opportunities / Talent Pool / archive. */
    talent?: {
        display_status: string;
        future_pref: string | null;
        future_pref_at: string | null;
        talent_pool_status: string | null;
        last_contacted_at: string | null;
        archived_at: string | null;
        archive_reason: string | null;
        origin_applicant_id: number | null;
        source: string | null;
    };
}

export type VacancyRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

/** Department Vacancy (Manpower) Request -> Super Admin approval -> Job Posting. */
export interface VacancyRequest {
    id: number;
    request_no: string;
    department_id: number;
    department: string;
    position_id: number;
    position: string;
    vacancies: number;
    /** Applicants hired through its job posting. */
    filled: number;
    employment_type: string;
    justification: string;
    required_skills: string;
    qualifications: string;
    requested_date: string;
    notes: string;
    status: VacancyRequestStatus;
    requested_by: number | null;
    requested_by_name: string | null;
    reviewed_by_name: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    cancelled_at: string | null;
    created_at: string;
    job_posting_id: number | null;
    job_posting_no: string | null;
    job_posting_status: string | null;
}

/** A workflow notification in the header bell (vacancy requests, job postings). */
export interface WorkflowNotification {
    id: number;
    title: string;
    message: string;
    link: string | null;
    created_at: string;
    is_read: boolean;
}

/** The applicant's confirmation of a scheduled interview (3-day response period). Interview status is separate. */
export type ConfirmationStatus = 'Pending Confirmation' | 'Confirmed' | 'Declined' | 'Expired' | 'Superseded';

export interface InterviewConfirmation {
    id: number;
    round: 'Pre-Interview' | 'Final Interview';
    interview_at: string;
    request_type: 'Scheduled' | 'Rescheduled' | 'Reminder';
    status: ConfirmationStatus;
    /** Awaiting Response / Will Attend / Will Not Attend / No Response */
    response: string;
    sent_at: string;
    deadline: string;
    seconds_left: number;
    email_status: 'Pending' | 'Sent' | 'Failed';
    email_error: string | null;
    auto_reminder_at: string | null;
    responded_at: string | null;
    response_channel: 'Email' | 'Portal' | null;
    response_reason: string | null;
    expired_at: string | null;
    created_by_name?: string | null;
}
