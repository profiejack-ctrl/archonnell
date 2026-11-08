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

/** Core Human Capital, Employee Records and Employee Self-Service (own profile). */
export const employeeService = {
    hcmPage: () => api.get<HcmPage>('page_hcm'),
    hcmStats: (passive = false) => api.get<{ stats: WorkforceStats }>('hcm_stats', {}, { passive }),
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
