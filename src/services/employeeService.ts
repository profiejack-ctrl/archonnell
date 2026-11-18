import { api, httpUpload } from './http';
import type { Department, DocType, Distribution, Employee, EmployeeDocument, InfoChangeRequest, Position, Profile, WorkforceStats } from '../types';
import type { LeaveBalance } from './leaveService';

export interface HcmPage {
    employees: Employee[];
    workforce: WorkforceStats;
    dept_distribution: Distribution;
    departments: Department[];
    positions: Position[];
    info_requests: InfoChangeRequest[];
    info_fields: Record<string, string>;
    my_employee_id: number | null;
}

export interface RecordsPage {
    employees: Employee[];
    doc_counts: Record<string, Partial<Record<DocType, number>>>;
}

export interface EmployeeUpdate {
    employee_id: number;
    full_name: string;
    position: string;
    department: string;
    contract_type: string;
    employment_status: string;
    email: string;
    mobile_number: string;
    date_hired: string;
    gender: string;
    date_of_birth: string;
    address: string;
}

const DEPT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6'];

function mapDistribution(dist: unknown): Distribution {
    if (dist && typeof dist === 'object' && Array.isArray((dist as Distribution).items)) {
        return dist as Distribution;
    }
    if (dist && typeof dist === 'object') {
        const entries = Object.entries(dist).filter(([k]) => k !== 'items' && k !== 'total');
        const total = entries.reduce((acc, [, val]) => acc + (Number(val) || 0), 0);
        const items = entries.map(([name, val], i) => {
            const count = Number(val) || 0;
            return {
                name,
                count,
                pct: total > 0 ? Math.round((count / total) * 100) : 0,
                color: DEPT_COLORS[i % DEPT_COLORS.length],
            };
        });
        return { items, total };
    }
    return { items: [], total: 0 };
}

function mapWorkforceStats(w: any, emps: Employee[] = [], depts: Department[] = []): WorkforceStats {
    const total = w?.total ?? emps.length ?? 0;
    const active = w?.active ?? emps.filter(e => e.employment_status === 'Active' || e.employment_status === 'Regular').length;
    const on_leave = w?.on_leave ?? emps.filter(e => e.employment_status === 'On Leave').length;
    const inactive = w?.inactive ?? emps.filter(e => e.employment_status === 'Inactive' || e.employment_status === 'Resigned').length;
    const deptCount = w?.depts ?? (Array.isArray(depts) ? depts.length : 0);

    let statuses = w?.statuses;
    if (!Array.isArray(statuses)) {
        const activePct = total > 0 ? Math.round((active / total) * 100) : 100;
        const leavePct = total > 0 ? Math.round((on_leave / total) * 100) : 0;
        const inactPct = total > 0 ? Math.round((inactive / total) * 100) : 0;
        statuses = [
            { name: 'Active', count: active, pct: activePct, pct_label: activePct, color: '#10b981' },
            { name: 'On Leave', count: on_leave, pct: leavePct, pct_label: leavePct, color: '#f59e0b' },
            { name: 'Inactive', count: inactive, pct: inactPct, pct_label: inactPct, color: '#ef4444' },
        ];
    }
    return {
        total,
        active,
        on_leave,
        inactive,
        depts: deptCount,
        statuses,
    };
}

/** Core Human Capital, Employee Records and Employee Self-Service (own profile). */
export const employeeService = {
    hcmPage: async (): Promise<HcmPage> => {
        const res = await api.get<any>('page_hcm');
        const employees: Employee[] = res?.employees || [];
        const departments: Department[] = res?.departments || [];
        const positions: Position[] = res?.positions || [];
        const workforce = mapWorkforceStats(res?.workforce, employees, departments);
        const dept_distribution = mapDistribution(res?.dept_distribution);
        return {
            employees,
            workforce,
            dept_distribution,
            departments,
            positions,
            info_requests: res?.info_requests || [],
            info_fields: res?.info_fields || {},
            my_employee_id: res?.my_employee_id ?? null,
        };
    },
    hcmStats: async (passive = false) => {
        const res = await api.get<{ stats: any }>('hcm_stats', {}, { passive });
        return { stats: mapWorkforceStats(res?.stats) };
    },
    update: (input: EmployeeUpdate) => api.post<{ message: string }>('update_employee', { ...input }),
    archive: (employeeId: number) => api.post<{ message: string }>('archive_employee', { employee_id: employeeId }),

    recordsPage: () => api.get<RecordsPage>('page_records'),
    documents: (employeeId: number) =>
        api.get<{ documents: Record<DocType, EmployeeDocument[]> }>('employee_documents', { employee_id: employeeId }),
    uploadDocument: (employeeId: number, docType: DocType, file: File) =>
        httpUpload<{ message: string; document_id: number }>('upload-employee-document.php', {
            employee_id: String(employeeId), doc_type: docType, file,
        }),

    profilePage: () => api.get<{ profile: Profile | null; leave_balances?: LeaveBalance[]; info_requests?: InfoChangeRequest[]; info_fields?: Record<string, string> }>('page_profile'),
    /** Locked information: request a correction (employeeId = filed by HR on the employee's behalf). */
    requestInfoChange: (field: string, value: string, reason: string, employeeId?: number) =>
        api.post<{ message: string; request: InfoChangeRequest }>('submit_info_change', { field_name: field, requested_value: value, reason, employee_id: employeeId }),
    approveInfoChange: (id: number, remarks = '') => api.post<{ message: string }>('review_info_change', { id, decision: 'approve', remarks }),
    rejectInfoChange: (id: number, remarks: string) => api.post<{ message: string }>('review_info_change', { id, decision: 'reject', remarks }),
    cancelInfoChange: (id: number) => api.post<{ message: string }>('cancel_info_change', { id }),
    updateMyContact: (mobile: string) => api.post<{ message: string; mobile_number: string }>('update_my_contact', { mobile_number: mobile }),
    changePassword: (current: string, next: string, confirm: string) =>
        api.post<{ message: string }>('change_password', { current_password: current, new_password: next, confirm_password: confirm }),
};
