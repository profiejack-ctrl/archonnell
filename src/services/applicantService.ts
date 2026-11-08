import { api } from './http';
import type { AiDetail, Applicant, ApplicantDetail, RankedCandidate } from '../types';

export interface ValidationPage {
    applicants: Applicant[];
    /** Rejected at Applicant Validation. */
    rejected: Applicant[];
    stats: { new: number; reviewing: number; scheduled: number };
}

export interface RankingPage {
    candidates: RankedCandidate[];
    stats: { top_tier: number; mid_tier: number; avg_fit: number };
}

export interface ScheduleInput {
    applicant_id: number;
    datetime: string;
    interview_type: string;
    interview_location: string;
    interviewer_id: number;
    /** 1 = reschedule an applicant already in Pre-Interview. */
    reschedule?: number;
}

/** A system user who can take an interview at the requested date and time. */
export interface Interviewer {
    id: number;
    name: string;
    role_name: string;
    employee_no: string | null;
    position: string | null;
}

/** The applicant stages an application can be rejected at. */
export type RejectionStage = 'Validation' | 'Pre-Interview' | 'Final Interview';

/** Applicant Management: validation, AI candidate ranking, AI screening detail. */
export const applicantService = {
    validationPage: () => api.get<ValidationPage>('page_applicant_validation'),
    rankingPage: () => api.get<RankingPage>('page_candidate_ranking'),
    aiDetail: (id: number) => api.get<{ detail: AiDetail }>('applicant_ai_detail', { id }),
    availableInterviewers: (datetime: string) => api.get<{ interviewers: Interviewer[] }>('available_interviewers', { datetime }),
    /** View: the applicant record, Job Posting, interviews, rejection and history. */
    detail: (id: number) => api.get<ApplicantDetail>('applicant_detail', { id }),
    /**
     * Reject one application at the stage the page shows it in, with a required reason.
     * The server validates the reason again and e-mails the applicant after saving.
     */
    reject: (applicantId: number, stage: RejectionStage, reason: string, extra: Record<string, string | boolean> = {}) =>
        api.post<{ message: string; rejection_stage: string; email_sent: boolean; email_error: string | null; future_invited?: boolean }>('reject_applicant', {
            applicant_id: applicantId, stage, reason, ...extra,
        }),
    schedulePreInterview: (input: ScheduleInput) =>
        api.post<{ message: string; email_sent: boolean; email_error: string | null; confirmation_deadline: string | null }>('schedule_pre_interview', { ...input }),
};
