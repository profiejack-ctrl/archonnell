import { api } from './http';
import type { AuditLog } from '../types';

export interface AuditLogPage {
    logs: AuditLog[];
    total: number;
    page: number;
    total_pages: number;
    actions: string[];
    modules: string[];
    statuses: string[];
}

/** Audit Logs filters + sort: applied by the database (the log is paged on the server). */
export interface AuditLogQuery {
    action: string;
    module: string;
    status: string;
    search: string;
    from: string;
    to: string;
    sort: string;
    dir: 'asc' | 'desc' | '';
}

export const auditLogService = {
    page: (page: number, q: AuditLogQuery) => api.get<AuditLogPage>('page_audit_logs', {
        page, filter_action: q.action, module: q.module, status: q.status, search: q.search, from: q.from, to: q.to, sort: q.sort, dir: q.dir,
    }),
};
