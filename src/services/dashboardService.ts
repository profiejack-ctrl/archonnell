import { api } from './http';
import type { DashboardAnnouncement, Distribution } from '../types';

export interface DashboardStats {
    applicants: number;
    applicants_trend: number;
    onboarding: number;
    onboarding_trend: number;
    employees: number;
    employees_active: number;
    employees_trend: number;
    jobs: number;
}

export interface DashboardData {
    announcements: DashboardAnnouncement[];
    show_analytics: boolean;
    stats?: DashboardStats;
    recruitment_trend?: { items: { label: string; count: number }[]; max: number };
    dept_distribution?: Distribution;
    recent_applicants?: { full_name: string; position: string; status: string; applied_at: string }[];
    onboarding_progress?: { id: number; fname: string | null; pos: string | null; progress: number; dh: string | null }[];
}

export const dashboardService = {
    page: () => api.get<DashboardData>('page_dashboard'),
};
