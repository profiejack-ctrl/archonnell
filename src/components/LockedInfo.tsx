import { useEffect, useState, type ReactNode } from 'react';
import { Lock, Send, SquarePen } from 'lucide-react';
import Icon from './Icon';
import Modal from './Modal';
import { Badge, EmptyRow } from './ui';
import { SortTh, useTableView } from './TableControls';
import { employeeService } from '../services/employeeService';
import { ArchonAlert, confirmDialog } from '../utils/alerts';
import { isoDateFromToday, phpFjY, phpMjY } from '../utils/format';
import type { InfoChangeRequest, InfoField } from '../types';
import '../styles/locked-info.css';

/** "Verified / Fixed" mark next to locked (verified) employee information. */
export function LockedTag({ title = 'Verified information: it can only be changed through an approved Information Change Request.' }: { title?: string }) {
    return <span className="locked-tag" title={title}><Icon as={Lock} /> Verified / Fixed</span>;
}

/** A locked value with its mark. */
export function LockedValue({ children, id }: { children: ReactNode; id?: string }) {
    return <span className="locked-value"><span id={id}>{children}</span> <LockedTag /></span>;
}

export const INFO_FIELDS: { key: InfoField; label: string }[] = [
    { key: 'first_name', label: 'First Name' }, { key: 'middle_name', label: 'Middle Name' }, { key: 'last_name', label: 'Last Name' },
    { key: 'date_of_birth', label: 'Date of Birth' }, { key: 'gender', label: 'Gender' }, { key: 'date_hired', label: 'Date Hired' },
];

export const INFO_STATUS_BADGE: Record<InfoChangeRequest['status'], string> = {
    Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger', Cancelled: 'badge-secondary',
};

/** The employee's current locked values (keyed like INFO_FIELDS). */
export type LockedValues = Partial<Record<InfoField, string | null>>;

const label = (field: InfoField, v: string | null | undefined) =>
    !v ? '(none)' : field === 'date_of_birth' || field === 'date_hired' ? phpFjY(v) : v;

/** Same checks as the server (eir_normalise / reason); '' when the form can be sent. */
function requestError(field: InfoField | '', value: string, reason: string, current: string): string {
    if (!field) return 'Please choose the information you want to change.';
    const v = value.trim();
    if (field !== 'middle_name' && !v) return 'Please enter the requested value.';
    if (['first_name', 'middle_name', 'last_name'].includes(field) && v && !/^\p{L}[\p{L} .'-]{0,99}$/u.test(v)) {
        return 'Names may contain letters, spaces, periods, apostrophes and dashes only.';
    }
    if (v === (current ?? '')) return 'The requested value is the same as the current one.';
    if (reason.replace(/\s+/g, ' ').trim().length < 10) return 'Please explain the reason in at least 10 characters.';
    if (/[<>]/.test(reason)) return 'Please do not use < or > characters.';
    return '';
}

/**
 * Request Information Change: pick a locked field, see its current value,
 * enter the requested value and a reason. Nothing changes until HR approves.
 * employeeId: filed by HR on the employee's behalf.
 */
export function InfoChangeRequestModal({ open, onClose, current, employeeName, employeeId, onDone }: {
    open: boolean; onClose: () => void; current: LockedValues; employeeName?: string; employeeId?: number; onDone: () => void;
}) {
    const [field, setField] = useState<InfoField | ''>('');
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (open) { setField(''); setValue(''); setReason(''); } }, [open]);
    const cur = field ? (current[field] ?? '') : '';

    const submit = async () => {
        const err = requestError(field, value, reason, cur ?? '');
        if (err || !field) { await ArchonAlert.warning(err, { title: 'Check Your Request' }); return; }
        const ok = await confirmDialog({
            title: 'Request Information Change',
            paragraphs: [`Send this request to HR for review${employeeName ? ` (for ${employeeName})` : ''}? The current information stays until it is approved.`],
            details: [
                { label: 'Information', value: INFO_FIELDS.find(f => f.key === field)?.label ?? field },
                { label: 'Current Value', value: label(field, cur) },
                { label: 'Requested Value', value: label(field, value.trim()) },
            ],
            icon: 'question', confirmText: 'Send Request',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await employeeService.requestInfoChange(field, value.trim(), reason.trim(), employeeId);
            onClose();
            await ArchonAlert.success(res.message, { timer: 2600 });
            onDone();
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'The request could not be sent.');
        } finally {
            setBusy(false);
        }
    };

    const input = () => {
        if (field === 'gender') {
            return (
                <select className="form-input" id="icrValue" value={value} onChange={e => setValue(e.target.value)}>
                    <option value="">Select&hellip;</option>
                    {['Male', 'Female', 'Other', 'Prefer not to say'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
            );
        }
        if (field === 'date_of_birth' || field === 'date_hired') {
            return <input type="date" className="form-input" id="icrValue" max={field === 'date_of_birth' ? isoDateFromToday() : undefined} value={value} onChange={e => setValue(e.target.value)} />;
        }
        return <input type="text" className="form-input" id="icrValue" maxLength={100} value={value} onChange={e => setValue(e.target.value)}
            placeholder={field === 'middle_name' ? 'Leave empty to remove the middle name' : ''} />;
    };

    return (
        <Modal open={open} onClose={onClose} size="lg" title={<><Icon as={SquarePen} /> Request Information Change</>}
            footer={<>
                <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" id="icrSubmit" disabled={busy} onClick={() => void submit()}><Icon as={Send} /> Send Request</button>
            </>}>
            <p className="locked-note"><Icon as={Lock} /> Your name, date of birth, gender and date hired are verified information. They cannot be edited directly:
                HR reviews this request, and only an approved request changes the record. The Employee ID never changes.</p>
            <form className="modal-form-grid" id="infoChangeForm" onSubmit={e => e.preventDefault()}>
                <div className="form-group">
                    <label htmlFor="icrField">Information to Change <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select className="form-input" id="icrField" value={field} onChange={e => { setField(e.target.value as InfoField | ''); setValue(''); }}>
                        <option value="">Select&hellip;</option>
                        {INFO_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Current Value</label>
                    <input type="text" className="form-input" id="icrCurrent" readOnly value={field ? label(field, cur) : ''} style={{ background: 'var(--bg-secondary)' }} />
                </div>
                <div className="form-group full-width">
                    <label htmlFor="icrValue">Requested Value {field !== 'middle_name' && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                    {field ? input() : <input type="text" className="form-input" disabled placeholder="Choose the information first" />}
                </div>
                <div className="form-group full-width">
                    <label htmlFor="icrReason">Reason <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea className="form-input" id="icrReason" maxLength={500} style={{ minHeight: 80, resize: 'vertical' }} value={reason}
                        onChange={e => setReason(e.target.value)} placeholder="e.g., Incorrect date recorded during application." />
                </div>
            </form>
        </Modal>
    );
}

/** Information Change Requests table (HR review, or the employee's own list). */
export function InfoRequestsTable({ rows, actions, showEmployee = true, id, empty }: {
    rows: InfoChangeRequest[]; actions: (r: InfoChangeRequest) => ReactNode; showEmployee?: boolean; id?: string; empty: ReactNode;
}) {
    const cols = showEmployee ? 10 : 8;
    const view = useTableView(rows, () => true, {
        no: r => r.request_no, employee: r => r.full_name, by: r => r.requested_by_name, field: r => r.field_label,
        current: r => r.current_label, requested: r => r.requested_label, date: r => r.created_at, status: r => r.status,
    });
    return (
        <table className="data-table" id={id}>
            <thead>
                <tr>
                    <SortTh view={view} k="no">Request No.</SortTh>{showEmployee && <><SortTh view={view} k="employee">Employee</SortTh><SortTh view={view} k="by">Requested By</SortTh></>}<SortTh view={view} k="field">Information</SortTh><SortTh view={view} k="current">Current Value</SortTh>
                    <SortTh view={view} k="requested">Requested Value</SortTh><th>Reason</th><SortTh view={view} k="date">Date Requested</SortTh><SortTh view={view} k="status">Status</SortTh><th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {!rows.length ? <EmptyRow colSpan={cols}>{empty}</EmptyRow> : view.rows.map(r => (
                    <tr className="hover-row" key={r.id} data-id={r.id} data-status={r.status}>
                        <td className="locked-nowrap"><strong>{r.request_no}</strong></td>
                        {showEmployee && <>
                            <td><strong>{r.full_name}</strong><div className="locked-muted">{r.employee_no} · {r.department}</div></td>
                            <td>{r.requested_by_name ?? '—'}<div className="locked-muted">{r.self_requested ? 'Employee' : r.requested_by_role ?? ''}</div></td>
                        </>}
                        <td>{r.field_label}</td>
                        <td>{r.current_label}</td>
                        <td><strong>{r.requested_label}</strong></td>
                        <td style={{ maxWidth: 240 }}>{r.reason}</td>
                        <td className="locked-nowrap">{phpMjY(r.created_at)}</td>
                        <td><Badge variant={INFO_STATUS_BADGE[r.status]}>{r.status}</Badge>
                            {r.reviewed_by_name && <div className="locked-muted">by {r.reviewed_by_name}</div>}
                            {r.review_remarks && <div className="locked-muted" style={{ maxWidth: 200 }}>{r.review_remarks}</div>}</td>
                        <td className="locked-nowrap">{actions(r)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
