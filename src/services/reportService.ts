import { api, backendUrl } from './http';
import type { Department, Position } from '../types';

export interface ReportType {
    key: string;
    label: string;
    date_label: string;
    statuses: string[] | null;
    status_label: string;
    all_dates: boolean;
    default_sort: [string, 'asc' | 'desc'];
    sorts: { key: string; label: string }[];
}

export interface ReportOptions {
    types: ReportType[];
    periods: { key: string; label: string }[];
    departments: Department[];
    positions: Position[];
}

export interface ReportFilters {
    type: string;
    period: string;
    from: string;
    to: string;
    department: string;
    position: string;
    status: string;
    sort: string;
    order: 'asc' | 'desc';
}

export interface ReportPreview {
    type: string;
    title: string;
    type_label: string;
    period_label: string;
    from: string | null;
    to: string | null;
    filters: Record<string, string>;
    sort_label: string;
    columns: { key: string; label: string; kind: string }[];
    /** Formatted cell text, keyed by column. */
    rows: Record<string, string>[];
    count: number;
    generated_by: string;
    generated_at: string;
}

/** A report generated earlier, kept as it was generated (Reports > Generated Reports). */
export interface GeneratedReport {
    id: number;
    report_no: string;
    report_type: string;
    title: string;
    period_label: string;
    format: 'pdf' | 'xlsx';
    record_count: number;
    file_size: number;
    generated_by_name: string | null;
    created_at: string;
}

const params = (f: ReportFilters): Record<string, string> => ({ ...f });

/** Reports: live database reports, previewed here and generated as PDF / Excel by export-report.php. */
export const reportService = {
    options: () => api.get<ReportOptions>('report_options'),
    preview: (f: ReportFilters) => api.get<{ report: ReportPreview }>('report_preview', params(f)),
    fileUrl: (f: ReportFilters, format: 'pdf' | 'xlsx') => backendUrl(`export-report.php?${new URLSearchParams({ ...params(f), format })}`),
    history: () => api.get<{ reports: GeneratedReport[] }>('report_history'),
    storedUrl: (id: number, inline = false) => backendUrl(`download-report.php?id=${id}${inline ? '&inline=1' : ''}`),
};
