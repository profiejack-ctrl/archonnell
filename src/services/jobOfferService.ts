import { api } from './http';
import type { Shift } from './attendanceService';

export type OfferStatus = 'Draft' | 'Extended' | 'Accepted' | 'Declined' | 'Expired' | 'Withdrawn';

export interface JobOffer {
    id: number;
    offer_no: string;
    applicant_id: number;
    applicant_no: string | null;
    full_name: string;
    email: string | null;
    mobile_number: string | null;
    resume_path: string | null;
    has_resume: boolean;
    applicant_stage: string;
    applicant_status: string;
    applied_at: string;
    match_score: string | null;
    posting_no: string | null;
    department: string;
    position: string;
    employment_type: string;
    salary: number;
    start_date: string;
    work_schedule: string | null;
    benefits: string | null;
    offer_date: string | null;
    expires_on: string;
    terms: string | null;
    status: OfferStatus;
    response_note: string | null;
    employee_id: number | null;
    employee_no: string | null;
    /** Latest hired e-mail attempt (Accepted offers). */
    /** The applicant's own answer (Applicant Portal / e-mailed link). Accepted -> HR confirms the hire. */
    applicant_response: 'Accepted' | 'Declined' | null;
    applicant_responded_at: string | null;
    applicant_response_channel: 'Email' | 'Portal' | null;
    applicant_response_reason: string | null;
    /** The offer e-mail sent when the offer was extended. */
    offer_email_status: 'Sent' | 'Failed' | null;
    offer_email_error: string | null;
    offer_emailed_at: string | null;
    hired_email_status: 'Pending' | 'Sent' | 'Failed' | null;
    hired_email_to: string | null;
    hired_email_error: string | null;
    hired_email_at: string | null;
    pre_interview_at: string | null;
    interview_type: string | null;
    interview_location: string | null;
    interviewer: string | null;
    final_interview_at: string | null;
    final_interview_type: string | null;
    final_interview_location: string | null;
    final_interviewer: string | null;
    created_by_name: string | null;
    extended_by_name: string | null;
    closed_by_name: string | null;
    extended_at: string | null;
    responded_at: string | null;
    created_at: string;
    updated_at: string;
}

/** An applicant in the Final Interview stage without an open offer. */
export interface OfferCandidate {
    id: number;
    applicant_no: string | null;
    full_name: string;
    email: string | null;
    position: string;
    department: string;
    posting_no: string | null;
    applied_at: string;
    match_score: string | null;
    final_interview_at: string | null;
    final_interviewer: string | null;
    has_resume: boolean;
    resume_path: string;
}

export interface JobOffersPage {
    today: string;
    offers: JobOffer[];
    candidates: OfferCandidate[];
    employment_types: string[];
    shifts: Shift[];
}

export interface OfferForm {
    id?: number;
    applicant_id?: number;
    employment_type: string;
    salary: string;
    start_date: string;
    expires_on: string;
    work_schedule: string;
    benefits: string;
    terms: string;
}

type Res = { message: string; offer: JobOffer };

/** Onboarding Management > Job Offer: Draft -> Extended -> Accepted (hired) / Declined / Expired / Withdrawn. */
export const jobOfferService = {
    page: () => api.get<JobOffersPage>('page_job_offers'),
    save: (f: OfferForm) => api.post<Res>('save_job_offer', { ...f }),
    extend: (id: number) => api.post<Res & { warning: string | null }>('extend_offer', { id }),
    /** E-mail an extended, unanswered offer again (new Accept / Decline links). */
    resendOffer: (id: number) => api.post<Res>('resend_offer_email', { id }),
    accept: (id: number, note: string) => api.post<Res & { employee_no: string; hired_email_sent: boolean; warning: string | null }>('accept_offer', { id, note }),
    /** Resend the congratulations e-mail to a hired applicant. */
    resendHiredEmail: (id: number) => api.post<Res>('resend_hired_email', { id }),
    decline: (id: number, note: string) => api.post<Res>('decline_offer', { id, note }),
    withdraw: (id: number, note: string) => api.post<Res>('withdraw_offer', { id, note }),
};
