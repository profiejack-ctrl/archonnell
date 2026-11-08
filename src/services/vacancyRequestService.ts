import { api } from './http';
import type { Position, VacancyRequest } from '../types';

export interface VacancyRequestsPage {
    requests: VacancyRequest[];
    /** Set when the signed-in user manages a department (may request employees for it). */
    manager: { department_id: number; department: string; position: string } | null;
    is_admin: boolean;
    can_recruit: boolean;
    /** The manager's department positions. */
    positions: Position[];
    employment_types: string[];
}

export interface VacancyRequestForm {
    department_id: number;
    position_id: string;
    vacancies: string;
    employment_type: string;
    justification: string;
    required_skills: string;
    qualifications: string;
    requested_date: string;
    notes: string;
}

type Result = { request: VacancyRequest; message: string };

/** Department Vacancy Request -> Super Admin approval -> Recruitment job posting. */
export const vacancyRequestService = {
    page: () => api.get<VacancyRequestsPage>('page_vacancy_requests'),
    create: (form: VacancyRequestForm) => api.post<Result>('create_vacancy_request', { ...form }),
    approve: (id: number) => api.post<Result>('review_vacancy_request', { id, decision: 'approve' }),
    reject: (id: number, reason: string) => api.post<Result>('review_vacancy_request', { id, decision: 'reject', reason }),
    cancel: (id: number) => api.post<Result>('cancel_vacancy_request', { id }),
};
