import { CalendarDays, Download, Eye, FileText, History, User } from 'lucide-react';
import Icon from '../../components/Icon';
import { Badge, InfoItem } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { backendUrl } from '../../services/http';
import { leaveService, type LeaveRequest, type LeaveStatus } from '../../services/leaveService';
import { phpMjYgiA } from '../../utils/format';
import { fmtDay } from '../attendance/shared';

export const LEAVE_BADGE: Record<LeaveStatus, string> = {
    Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger', Cancelled: 'badge-secondary',
};

export const dayCount = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** Leave request details: employee, leave, supporting document, status and approval history. */
export default function LeaveDetails({ request: r, showEmployee = true }: { request: LeaveRequest; showEmployee?: boolean }) {
    const { data, loading } = usePageData(() => leaveService.detail(r.id), [r.id, r.status]);
    const history = data?.history ?? [];
    const docUrl = backendUrl(`download-leave-document.php?id=${r.id}`);
    return (
        <>
            {showEmployee && (
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={User} /> Employee</h4>
                    <div className="modal-info-grid">
                        <InfoItem label="Employee ID">{r.employee_no}</InfoItem>
                        <InfoItem label="Employee Name">{r.full_name}</InfoItem>
                        <InfoItem label="Department">{r.department}</InfoItem>
                        <InfoItem label="Position">{r.position}</InfoItem>
                    </div>
                </div>
            )}
            <div className="modal-section">
                <h4 className="modal-section-title"><Icon as={CalendarDays} /> Leave · {r.request_no}</h4>
                <div className="modal-info-grid">
                    <InfoItem label="Current Status"><Badge variant={LEAVE_BADGE[r.status]}>{r.status}</Badge></InfoItem>
                    <InfoItem label="Leave Type">{r.leave_type} ({r.leave_code}){r.is_paid ? '' : ' · unpaid'}</InfoItem>
                    <InfoItem label="Leave Dates">{fmtDay(r.start_date)}{r.end_date !== r.start_date ? ` to ${fmtDay(r.end_date)}` : ''}</InfoItem>
                    <InfoItem label="Number of Days">{dayCount(r.days)} <span className="att-muted">(scheduled work days only)</span></InfoItem>
                    <InfoItem label="Date Submitted">{phpMjYgiA(r.created_at)}</InfoItem>
                    <InfoItem label="Supporting Document">
                        {r.has_attachment ? (
                            <span className="att-doc-links" style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <Icon as={FileText} /> {r.attachment_name}
                                <a className="btn btn-sm btn-outline" id="lvDocView" href={docUrl} target="_blank" rel="noopener"><Icon as={Eye} /> View</a>
                                <a className="btn btn-sm btn-outline" id="lvDocDownload" href={`${docUrl}&download=1`}><Icon as={Download} /> Download</a>
                            </span>
                        ) : 'None'}
                    </InfoItem>
                    <InfoItem label="Reason" full><span style={{ whiteSpace: 'pre-line' }}>{r.reason}</span></InfoItem>
                    {r.rejection_reason && <InfoItem label="Reason for Rejection" full>{r.rejection_reason}</InfoItem>}
                    {r.cancel_reason && <InfoItem label="Reason for Cancellation" full>{r.cancel_reason}</InfoItem>}
                </div>
            </div>
            <div className="modal-section">
                <h4 className="modal-section-title"><Icon as={History} /> Approval / Rejection History</h4>
                {loading && !data ? <p className="att-muted">Loading&hellip;</p> : (
                    <ul className="att-history" id="lvHistory">
                        {history.map(h => (
                            <li key={h.id} data-action={h.action}>
                                <strong>{h.action}</strong>{h.acted_by_name ? ` by ${h.acted_by_name}` : ''}
                                <div className="h-when">{phpMjYgiA(h.created_at)}</div>
                                {h.remarks && <div>{h.remarks}</div>}
                            </li>
                        ))}
                        {!history.length && <li>No history yet.</li>}
                    </ul>
                )}
            </div>
        </>
    );
}
