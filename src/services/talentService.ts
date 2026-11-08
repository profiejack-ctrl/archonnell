import { api } from './http';

/** A rejected / Talent Pool / archived application (Applicant Management lists). */
export interface TalentRow {
    id: number;
    applicant_no: string | null;
    full_name: string;
    email: string | null;
    position: string;
    department: string | null;
    stage: string;
    status: string;
    applied_at: string;
    rejection_stage: string | null;
    rejection_category: string | null;
    rejection_reason: string | null;
    rejected_at: string | null;
    rejected_by_name: string | null;
    future_pref: 'Pending Response' | 'Agreed' | 'Declined' | null;
    future_pref_at: string | null;
    future_invited_at: string | null;
    talent_pool_status: 'Active' | 'Contacted' | 'Re-applied' | 'Removed' | null;
    talent_pool_since: string | null;
    last_contacted_at: string | null;
    archived_at: string | null;
    archive_reason: string | null;
    archived_by_name: string | null;
    source_application_no: string | null;
    resume_path: string | null;
    job_posting_no: string | null;
    origin_applicant_id: number | null;
    hr_feedback_count: number;
    applicant_feedback: boolean;
    display_status: string;
    final_status: string;
    feedback_status: string;
    // Talent Pool only
    skills?: string;
    experience?: string;
    qualifications?: string;
    last_opportunity?: { opportunity_no: string; status: string; sent_at: string; posting_no: string; title: string } | null;
}

export interface TalentMatch extends TalentRow {
    match_score: number | null;
    match_summary: string;
    skills_matched: string[];
    skills_missing: string[];
    invitation_status: string | null;
    applied_for_posting: boolean;
}

export interface PostingOption { id: number; posting_no: string; title: string; department: string }

export interface ApplicantHistory {
    applications: TalentRow[];
    opportunities: { id: number; opportunity_no: string; status: string; sent_at: string; responded_at: string | null; match_score: string | null;
        new_applicant_id: number | null; applicant_id: number; posting_no: string; title: string }[];
    hr_feedback: ({ id: number; created_at: string; created_by_name: string | null } & Record<string, string | null>)[];
    applicant_feedback: (Record<string, string | number | null> & { comments: string | null; submitted_at: string }) | null;
    hr_feedback_fields: Record<string, string>;
    ratings: Record<string, string>;
}

type Msg = { message: string };

/** Rejected Applicants, Talent Pool, Future Opportunities, Feedback, Archived Applicants. */
export const talentService = {
    rejectedPage: () => api.get<{ applicants: TalentRow[]; categories: string[] }>('page_rejected_applicants'),
    archivedPage: () => api.get<{ applicants: TalentRow[] }>('page_archived_applicants'),
    poolPage: () => api.get<{ applicants: TalentRow[]; postings: PostingOption[] }>('page_talent_pool'),
    matches: (postingId: number) => api.get<{ posting: PostingOption & { position: string }; candidates: TalentMatch[] }>('talent_pool_matches', { job_posting_id: postingId }),
    history: (id: number) => api.get<ApplicantHistory>('applicant_history', { id }),
    addHrFeedback: (id: number, fields: Record<string, string>) => api.post<Msg>('add_hr_feedback', { applicant_id: id, ...fields }),
    archive: (id: number, reason: string) => api.post<Msg>('archive_applicant', { applicant_id: id, reason }),
    restore: (id: number) => api.post<Msg>('restore_applicant', { applicant_id: id }),
    removeFromPool: (id: number, reason: string) => api.post<Msg>('remove_from_talent_pool', { applicant_id: id, reason }),
    addToPool: (id: number) => api.post<Msg & { email_sent?: boolean }>('add_to_talent_pool', { applicant_id: id }),
    contact: (id: number, postingId: number, message: string) => api.post<Msg>('contact_talent', { applicant_id: id, job_posting_id: postingId, message }),
    withdrawOpportunity: (id: number) => api.post<Msg>('withdraw_opportunity', { id }),
};

export const REJECTION_CATEGORIES = [
    'Does not meet qualifications', 'Insufficient work experience', 'Skills do not match the position', 'Failed initial screening',
    'Failed interview', 'Failed assessment', 'Position filled', 'Position requirements changed', 'Applicant withdrew', 'Other',
];

export const HR_FEEDBACK_FIELDS: [string, string][] = [
    ['interview_feedback', 'Interview Feedback'], ['skills_assessment', 'Skills Assessment'], ['strengths', 'Strengths'],
    ['improvements', 'Areas for Improvement'], ['recruiter_notes', 'Recruiter Notes'], ['decision_notes', 'Hiring Decision Notes'], ['remarks', 'Additional Remarks'],
];

/** Badge colour of an application status shown in these lists. */
export function talentBadge(status: string): string {
    if (status === 'Talent Pool' || status === 'Future Opportunity Accepted' || status === 'Hired') return 'badge-success';
    if (status === 'Future Opportunity Offered' || status.startsWith('Rejected (Future')) return 'badge-info';
    if (status === 'Archived' || status.includes('Removed')) return 'badge-secondary';
    if (status.includes('No Future Contact') || status === 'Rejected') return 'badge-danger';
    return 'badge-warning';
}

export const PREF_BADGE: Record<string, string> = { 'Pending Response': 'badge-warning', Agreed: 'badge-success', Declined: 'badge-danger' };
