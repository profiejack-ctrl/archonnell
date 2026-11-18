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
    rankingPage: async (): Promise<RankingPage> => {
        const res = await api.get<any>('page_candidate_ranking');
        const rawCandidates = res?.candidates || [];
        const candidates: RankedCandidate[] = rawCandidates.map((c: any) => {
            const scoreNum = Number(c.overall_score ?? c.ai_score ?? parseInt(String(c.match_score), 10) ?? 80);
            return {
                ...c,
                overall_score: scoreNum,
                role_fit: Number(c.role_fit ?? scoreNum),
                resume_score: c.resume_score != null ? Number(c.resume_score) : Math.max(0, scoreNum - 4),
                quality_of_hire: c.quality_of_hire != null ? Number(c.quality_of_hire) : Math.min(100, scoreNum + 2),
                job_posting_title: c.job_posting_title ?? c.position,
                job_posting_no: c.job_posting_no ?? (c.job_posting_id ? `JOB-${c.job_posting_id}` : 'JOB-GEN'),
                applied_at: c.applied_at || '2026-11-07T13:46:58.684Z',
            };
        });
        const top_tier = candidates.filter(c => c.overall_score >= 70).length;
        const mid_tier = candidates.filter(c => c.overall_score >= 45 && c.overall_score < 70).length;
        const avg_fit = candidates.length > 0 ? Math.round(candidates.reduce((acc, c) => acc + c.role_fit, 0) / candidates.length) : 0;
        return {
            candidates,
            stats: {
                top_tier: res?.stats?.top_tier ?? top_tier,
                mid_tier: res?.stats?.mid_tier ?? mid_tier,
                avg_fit: res?.stats?.avg_fit ?? avg_fit,
            },
        };
    },
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
