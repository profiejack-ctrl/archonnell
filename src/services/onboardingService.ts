import { api } from './http';
import type { Department, OnboardingCharts, OnboardingRow, Position } from '../types';

export interface OnboardingPage {
    rows: OnboardingRow[];
    contract_statuses: string[];
    charts: OnboardingCharts;
    departments: Department[];
    positions: Position[];
}

export interface OnboardingUpdate {
    onboarding_id: number;
    full_name: string;
    contract_type: string;
    department: string;
    position: string;
    date_hired: string;
    status: string;
    progress: string | number;
}

export const onboardingService = {
    page: () => api.get<OnboardingPage>('page_onboarding'),
    charts: () => api.get<{ data: OnboardingCharts }>('onboarding_charts'),
    update: (input: OnboardingUpdate) => api.post<{ message: string }>('update_onboarding', { ...input }),
};
