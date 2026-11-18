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
    page: async (): Promise<DashboardData> => {
        const res = await api.get<any>('page_dashboard');
        if (res) {
            if (res.stats) {
                res.stats.applicants = res.stats.applicants ?? res.stats.active_applicants ?? 0;
                res.stats.employees = res.stats.employees ?? res.stats.total_employees ?? 0;
                res.stats.onboarding = res.stats.onboarding ?? 0;
            }
            if (Array.isArray(res.recruitment_trend)) {
                const items = res.recruitment_trend.map((t: any) => ({
                    label: t.label || t.month || '',
                    count: t.count ?? t.applicants ?? 0,
                }));
                const max = Math.max(1, ...items.map((i: any) => i.count));
                res.recruitment_trend = { items, max };
            }
        }
        return res as DashboardData;
    },
};
