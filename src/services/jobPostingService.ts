import { api } from './http';
import type { Department, JobPosting, JobPostingApplicant, Position, VacancyRequest } from '../types';
import type { JobPostingPublic } from '../types/portal';

export interface JobPostingsPage {
    postings: JobPosting[];
    departments: Department[];
    positions: Position[];
    employment_types: string[];
    work_setups: string[];
    default_location: string;
    /** Approved vacancy requests that still need their job posting. */
    approved_requests: VacancyRequest[];
}

/** The Create / Edit form (names match config/job_postings.php jp_input). */
export interface JobPostingForm {
    title: string;
    department: string;
    position: string;
    employment_type: string;
    work_setup: string;
    location: string;
    vacancies: string;
    description: string;
    responsibilities: string;
    qualifications: string;
    experience_required: string;
    required_skills: string;
    preferred_skills: string;
    salary_min: string;
    salary_max: string;
    benefits: string;
    opening_date: string;
    deadline: string;
}

/** draft: save as Draft; publish: save and publish; save: edit a Published posting. */
export type SaveIntent = 'draft' | 'publish' | 'save';

type Saved = { posting: JobPosting; message: string };

/** Recruitment Management > Job Posting. */
export const jobPostingService = {
    page: () => api.get<JobPostingsPage>('page_job_postings'),
    detail: (id: number) => api.get<{ posting: JobPosting; applicants: JobPostingApplicant[]; vacancy_request: VacancyRequest | null }>('job_posting_detail', { id }),
    /** The form rendered exactly as the public job page will show it. */
    preview: (form: JobPostingForm, postingNo = '') =>
        api.post<{ preview: JobPostingPublic }>('preview_job_posting', { ...form, posting_no: postingNo }),
    /** A new posting is created from an approved vacancy request (vacancyRequestId). */
    save: (id: number, form: JobPostingForm, intent: SaveIntent, vacancyRequestId: number | null = null) =>
        api.post<Saved>('save_job_posting', { ...form, id, intent, vacancy_request_id: vacancyRequestId ?? '' }),
    publish: (id: number) => api.post<Saved>('publish_job_posting', { id }),
    close: (id: number) => api.post<Saved>('close_job_posting', { id }),
    archive: (id: number) => api.post<Saved>('archive_job_posting', { id }),
    restore: (id: number) => api.post<Saved>('restore_job_posting', { id }),
    remove: (id: number) => api.post<{ message: string }>('delete_job_posting', { id }),
};
