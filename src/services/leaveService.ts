import { api, httpUpload } from './http';
import type { Department } from '../types';
import type { AttEmployee } from './attendanceService';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeaveType {
    id: number;
    code: string;
    name: string;
    description: string | null;
    /** Needs an entitlement (leave_entitlements) for the year before it can be used. */
    with_credits: boolean;
    is_paid: boolean;
    requires_document: boolean;
    status: 'Active' | 'Inactive';
    request_count: number;
}

export interface LeaveBalance {
    id: number;
    employee_id: number;
    employee_no: string;
    full_name: string;
    department: string;
    position: string;
    leave_type_id: number;
    code: string;
    leave_type: string;
    type_status: string;
    year: number;
    days: number;
    used: number;
    pending: number;
    remaining: number;
    updated_at: string;
}

export interface LeaveRequest {
    id: number;
    request_no: string;
    employee_id: number;
    employee_no: string;
    full_name: string;
    department: string;
    position: string;
    leave_type_id: number;
    leave_code: string;
    leave_type: string;
    is_paid: boolean;
    with_credits: boolean;
    start_date: string;
    end_date: string;
    days: number;
    reason: string;
    has_attachment: boolean;
    attachment_name: string | null;
    status: LeaveStatus;
    requested_by_name: string | null;
    reviewed_by_name: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    cancelled_by_name: string | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface LeaveHistoryEntry {
    id: number;
    action: 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled';
    remarks: string | null;
    created_at: string;
    acted_by_name: string | null;
}

export interface LeaveManagementPage {
    today: string;
    year: number;
    requests: LeaveRequest[];
    types: LeaveType[];
    balances: LeaveBalance[];
    employees: AttEmployee[];
    departments: Department[];
    my_employee_id: number | null;
}

export interface MyLeavePage {
    employee: { id: number; employee_no: string; full_name: string; department: string; position: string } | null;
    today?: string;
    types?: LeaveType[];
    requests?: LeaveRequest[];
    balances?: LeaveBalance[];
}

export interface LeavePreview {
    days: number;
    dates: string[];
    excluded: { date: string; reason: string }[];
}

export interface LeaveTypeForm {
    id?: number;
    code: string;
    name: string;
    description: string;
    with_credits: boolean;
    is_paid: boolean;
    requires_document: boolean;
    status: string;
}

type Msg = { message: string };

/** Leave Management (HR) and the employee's own leave requests. */
export const leaveService = {
    page: (year: number) => api.get<LeaveManagementPage>('page_leave_management', { year }),
    detail: (id: number) => api.get<{ request: LeaveRequest; history: LeaveHistoryEntry[] }>('leave_request_detail', { id }),
    approve: (id: number) => api.post<Msg>('review_leave_request', { id, decision: 'approve' }),
    reject: (id: number, reason: string) => api.post<Msg>('review_leave_request', { id, decision: 'reject', reason }),
    cancel: (id: number, reason = '') => api.post<Msg>('cancel_leave_request', { id, reason }),
    saveType: (f: LeaveTypeForm) => api.post<Msg>('save_leave_type', { ...f }),
    saveEntitlement: (f: { employee_id: string; leave_type_id: string; year: string; days: string }) => api.post<Msg>('save_leave_entitlement', { ...f }),

    myPage: () => api.get<MyLeavePage>('page_my_leave'),
    preview: (leaveTypeId: string, start: string, end: string) =>
        api.get<LeavePreview>('leave_preview', { leave_type_id: leaveTypeId, start_date: start, end_date: end }),
    submit: (f: { leave_type_id: string; start_date: string; end_date: string; reason: string }, file: File | null) =>
        httpUpload<Msg>('api.php', { action: 'submit_leave_request', ...f, ...(file ? { attachment: file } : {}) }),
};
