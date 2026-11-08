import { useEffect, useState } from 'react';
import { CalendarClock, Ban, BellRing, MailCheck, Phone } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, EmptyRow, InfoItem } from '../../components/ui';
import { recruitmentService } from '../../services/recruitmentService';
import { ArchonAlert, confirmDialog, esc, promptText } from '../../utils/alerts';
import { applicantNo, parseDbDate, phpFjY, phpMjYgiA } from '../../utils/format';
import type { Applicant, ConfirmationStatus, InterviewConfirmation } from '../../types';

export type InterviewRound = 'Pre-Interview' | 'Final Interview';

export const CONFIRMATION_BADGE: Record<ConfirmationStatus, string> = {
    'Pending Confirmation': 'badge-warning',
    Confirmed: 'badge-success',
    Declined: 'badge-danger',
    Expired: 'badge-secondary',
    Superseded: 'badge-secondary',
};

/** Interview status (kept separate from the applicant's confirmation). */
export function interviewStatus(at: string | null | undefined, c?: InterviewConfirmation | null): string {
    const t = parseDbDate(at);
    if (!t) return 'To be scheduled';
    if (t < new Date()) return 'Awaiting Result';
    return c?.request_type === 'Rescheduled' ? 'Rescheduled' : 'Scheduled';
}

const muted = { fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.25rem' } as const;

/** Confirmation column: status + deadline / response. */
export function ConfirmationCell({ c }: { c: InterviewConfirmation | null | undefined }) {
    if (!c) return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Not requested</span>;
    return (
        <div className="ic-cell" data-confirmation-status={c.status}>
            <Badge variant={CONFIRMATION_BADGE[c.status]}>{c.status}</Badge>
            {c.status === 'Pending Confirmation' && <div style={muted}>Deadline {phpMjYgiA(c.deadline)}</div>}
            {(c.status === 'Confirmed' || c.status === 'Declined') && c.responded_at && <div style={muted}>{c.response} · {phpMjYgiA(c.responded_at)}</div>}
            {c.status === 'Expired' && <div style={{ ...muted, color: 'var(--danger)' }}>Response: No Response</div>}
            {c.email_status === 'Failed' && <div style={{ ...muted, color: 'var(--danger)' }}>E-mail not sent</div>}
        </div>
    );
}

/**
 * Interview confirmation details (Pre-Interview / Final Interview) with the
 * HR actions after the applicant answers or does not answer: Send Reminder,
 * Reschedule, Contact Applicant, Reject (with a reason; never automatic).
 */
export function ConfirmationModal({ applicant, round, department, onClose, onChanged, onReschedule, onReject }: {
    applicant: Applicant | null;
    round: InterviewRound;
    department: string;
    onClose: () => void;
    onChanged: () => unknown;
    onReschedule: (a: Applicant) => void;
    onReject: (a: Applicant) => void;
}) {
    const [history, setHistory] = useState<InterviewConfirmation[] | null>(null);
    const [busy, setBusy] = useState(false);
    const at = applicant ? (round === 'Pre-Interview' ? applicant.pre_interview_at : applicant.final_interview_at) : null;
    const c = applicant?.confirmation ?? null;

    useEffect(() => {
        setHistory(null);
        if (!applicant) return;
        recruitmentService.confirmationHistory(applicant.id)
            .then(r => setHistory(r.history.filter(h => h.round === round)))
            .catch(() => setHistory([]));
    }, [applicant, round]);

    if (!applicant) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
    const canRemind = !!c && (c.status === 'Expired' || (c.status === 'Pending Confirmation' && c.email_status === 'Failed'));

    const remind = async () => {
        const ok = await confirmDialog({
            title: 'Send Reminder',
            paragraphs: [`Send ${applicant.full_name} a new confirmation request for the ${round}? A new 3-day confirmation period starts when it is sent; the expired request is kept in the history.`],
            details: [{ label: 'E-mail', value: applicant.email ?? '—' }, { label: 'Interview', value: at ? phpMjYgiA(at) : '—' }],
            icon: 'question', confirmText: 'Send Reminder',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await recruitmentService.sendInterviewReminder(applicant.id, round);
            onClose();
            await ArchonAlert.success(res.message);
            await onChanged();
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'The reminder could not be sent.');
            await onChanged();
        } finally {
            setBusy(false);
        }
    };

    const contact = async () => {
        const html = `<p>Contact <strong>${esc(applicant.full_name)}</strong> about the ${esc(round)} outside the system, then record what was agreed.</p>`
            + `<div class="archon-swal-detail"><span>E-mail</span><strong>${applicant.email ? `<a href="mailto:${esc(applicant.email)}">${esc(applicant.email)}</a>` : '—'}</strong></div>`
            + `<div class="archon-swal-detail"><span>Mobile</span><strong>${applicant.mobile_number ? `<a href="tel:${esc(applicant.mobile_number)}">${esc(applicant.mobile_number)}</a>` : '—'}</strong></div>`;
        const note = await promptText({
            title: 'Contact Applicant', html, icon: 'info', label: 'Contact notes', confirmText: 'Record Contact',
            placeholder: 'e.g., Called on Oct 5; the applicant will attend and confirm by e-mail.',
            validate: v => {
                const t = v.replace(/\s+/g, ' ').trim();
                if (t.length < 5) return 'Please describe the contact (at least 5 characters).';
                return /[<>]/.test(t) ? 'Please do not use < or > characters.' : '';
            },
        });
        if (note === null) return;
        try {
            const res = await recruitmentService.recordContact(applicant.id, round, note);
            await ArchonAlert.success(res.message, { timer: 1800 });
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'The contact could not be recorded.');
        }
    };

    return (
        <Modal open onClose={onClose} size="lg" titleTag="div" title={<><Icon as={MailCheck} /> Interview Confirmation</>}
            footer={<>
                <button className="btn btn-outline" onClick={onClose}>Close</button>
                <button className="btn btn-outline" id="icContact" onClick={() => void contact()}><Icon as={Phone} /> Contact Applicant</button>
                <button className="btn btn-outline" id="icReschedule" onClick={() => { onClose(); onReschedule(applicant); }}><Icon as={CalendarClock} /> Reschedule</button>
                {canRemind && <button className="btn btn-primary" id="icRemind" disabled={busy} onClick={() => void remind()}><Icon as={BellRing} /> Send Reminder</button>}
                <button className="btn btn-danger" id="icReject" onClick={() => { onClose(); onReject(applicant); }}><Icon as={Ban} /> Reject</button>
            </>}>
            <div className="modal-section">
                <div className="modal-info-grid" id="icDetails">
                    <InfoItem label="Applicant Name">{applicant.full_name} ({applicantNo(applicant)})</InfoItem>
                    <InfoItem label="Position">{applicant.position}</InfoItem>
                    <InfoItem label="Department">{department || '—'}</InfoItem>
                    <InfoItem label="Interview">{round}</InfoItem>
                    <InfoItem label="Interview Date">{at ? phpFjY(at) : 'To be scheduled'}</InfoItem>
                    <InfoItem label="Interview Time">{at ? phpMjYgiA(at).replace(/^.*?(\d{1,2}:\d{2}\s?[AP]M)$/i, '$1') : '—'}</InfoItem>
                    <InfoItem label="Schedule Status">{interviewStatus(at, c)}</InfoItem>
                    <InfoItem label="Confirmation Status">{c ? <Badge variant={CONFIRMATION_BADGE[c.status]}>{c.status}</Badge> : 'Not requested'}</InfoItem>
                    <InfoItem label="Confirmation Deadline">{c ? phpMjYgiA(c.deadline) : '—'}</InfoItem>
                    <InfoItem label="Applicant Response">{c ? c.response : '—'}</InfoItem>
                    <InfoItem label="Response Date">{c?.responded_at ? `${phpMjYgiA(c.responded_at)}${c.response_channel ? ` (${c.response_channel === 'Portal' ? 'Applicant Portal' : 'e-mail link'})` : ''}` : '—'}</InfoItem>
                    {c?.status === 'Declined' && <InfoItem label="Reason for Declining" full><span id="icDeclineReason">{c.response_reason}</span></InfoItem>}
                    {c?.email_status === 'Failed' && <InfoItem label="E-mail" full><span style={{ color: 'var(--danger)' }}>Not sent: {c.email_error}</span></InfoItem>}
                </div>
                {c?.status === 'Expired' && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                        The applicant did not answer within 3 days. The applicant is <strong>not</strong> rejected automatically: send a reminder, reschedule, contact the applicant, or reject with a reason.
                    </p>
                )}
            </div>
            <div className="modal-section">
                <h4 className="modal-section-title">Confirmation History</h4>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" id="icHistory">
                        <thead><tr><th>Sent</th><th>Request</th><th>Interview</th><th>Deadline</th><th>Status</th><th>Response</th><th>E-mail</th></tr></thead>
                        <tbody>
                            {!history ? <EmptyRow colSpan={7}>Loading&hellip;</EmptyRow> : !history.length ? <EmptyRow colSpan={7}>No confirmation requests yet.</EmptyRow> : history.map(h => (
                                <tr key={h.id}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{phpMjYgiA(h.sent_at)}{h.created_by_name ? <div style={muted}>{h.created_by_name}</div> : null}</td>
                                    <td>{h.request_type}{h.auto_reminder_at && <div style={muted}>Auto reminder {phpMjYgiA(h.auto_reminder_at)}</div>}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{phpMjYgiA(h.interview_at)}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{phpMjYgiA(h.deadline)}</td>
                                    <td><Badge variant={CONFIRMATION_BADGE[h.status]}>{h.status === 'Superseded' ? 'Replaced' : h.status}</Badge></td>
                                    <td>{h.response}{h.responded_at && <div style={muted}>{phpMjYgiA(h.responded_at)}</div>}{h.response_reason && <div style={muted}>{h.response_reason}</div>}</td>
                                    <td>{h.email_status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
}
