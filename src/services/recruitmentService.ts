import { api } from './http';
import type { Applicant, InterviewConfirmation } from '../types';

export interface PreInterviewPage {
    applicants: Applicant[];
    rejected: Applicant[];
    stats: { scheduled_today: number; total: number; proceeded_to_final: number };
}

export interface FinalInterviewPage {
    applicants: Applicant[];
    rejected: Applicant[];
    stats: { pending: number; hired_this_month: number; rejected_this_month: number };
    /** The applicant's latest job offer (Onboarding Management > Job Offer), keyed by applicant id. */
    offers: Record<number, { id: number; offer_no: string; status: string }>;
}

/** Recruitment Management: Pre-Interview -> Final Interview -> Hire / Reject. */
export const recruitmentService = {
    preInterviewPage: async (): Promise<PreInterviewPage> => {
        const res = await api.get<any>('page_pre_interview');
        const applicants: Applicant[] = res?.applicants || (Array.isArray(res?.data) ? res.data : []);
        const rejected: Applicant[] = res?.rejected || [];
        const stats = {
            scheduled_today: res?.stats?.scheduled_today ?? 0,
            total: res?.stats?.total ?? applicants.length,
            proceeded_to_final: res?.stats?.proceeded_to_final ?? 0,
        };
        return { applicants, rejected, stats };
    },
    finalInterviewPage: async (): Promise<FinalInterviewPage> => {
        const res = await api.get<any>('page_final_interview');
        const applicants: Applicant[] = res?.applicants || (Array.isArray(res?.data) ? res.data : []);
        const rejected: Applicant[] = res?.rejected || [];
        const stats = {
            pending: res?.stats?.pending ?? applicants.length,
            hired_this_month: res?.stats?.hired_this_month ?? 0,
            rejected_this_month: res?.stats?.rejected_this_month ?? rejected.length,
        };
        const offers = res?.offers || {};
        return { applicants, rejected, stats, offers };
    },
    proceedToFinal: (applicantId: number) => api.post<{ message: string }>('proceed_final_interview', { applicant_id: applicantId, datetime: '' }),
    hire: (applicantId: number, contractType: string) =>
        api.post<{ message: string; employee_no: string; employee_id: number; onboarding_id: number }>('hire_applicant', {
            applicant_id: applicantId, contract_type: contractType,
        }),
    /** Schedule (or reschedule) the final interview; the applicant is e-mailed the details. */
    scheduleFinal: (input: { applicant_id: number; datetime: string; interview_type: string; interview_location: string; interviewer: string }) =>
        api.post<{ message: string; email_sent: boolean; email_error: string | null; confirmation_deadline: string | null }>('schedule_final_interview', { ...input }),
    /** Attendance confirmation requests of one applicant, newest first. */
    confirmationHistory: (applicantId: number) => api.get<{ history: InterviewConfirmation[] }>('interview_confirmation_history', { applicant_id: applicantId }),
    /** After No Response (or a failed e-mail): new request, new 3-day deadline, e-mail. */
    sendInterviewReminder: (applicantId: number, round: string) =>
        api.post<{ message: string; confirmation: InterviewConfirmation }>('send_interview_reminder', { applicant_id: applicantId, round }),
    /** Record that HR contacted the applicant outside the system. */
    recordContact: (applicantId: number, round: string, note: string) =>
        api.post<{ message: string }>('record_applicant_contact', { applicant_id: applicantId, round, note }),
    extendOffer: (applicantId: number) => api.post<{ message: string }>('extend_job_offer', { applicant_id: applicantId }),
};
