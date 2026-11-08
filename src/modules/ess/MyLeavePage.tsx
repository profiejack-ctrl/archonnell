import { useEffect, useRef, useState } from 'react';
import { Ban, CalendarCheck, CalendarPlus, Eye, Info, Send } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, Card, EmptyRow, PageState, SearchBox } from '../../components/ui';
import { ClearFilters, DateRangeFilter, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { usePageData } from '../../hooks/usePageData';
import { leaveService, type LeavePreview, type LeaveRequest } from '../../services/leaveService';
import { ArchonAlert, confirmDialog } from '../../utils/alerts';
import { isoDateFromToday, phpMjY } from '../../utils/format';
import { fmtDay } from '../attendance/shared';
import LeaveDetails, { LEAVE_BADGE, dayCount } from '../leave/LeaveDetails';

const req = <span style={{ color: 'var(--danger)' }}>*</span>;
const hint = { fontSize: '0.75rem', color: 'var(--text-muted)' } as const;
const EMPTY = { leave_type_id: '', start_date: '', end_date: '', reason: '' };

/** The reviewer's word on a request: rejection / cancellation reason, or who approved it. */
function leaveRemarks(r: LeaveRequest): string {
    if (r.status === 'Rejected') return r.rejection_reason ?? '';
    if (r.status === 'Cancelled') return r.cancel_reason ? `Cancelled: ${r.cancel_reason}` : 'Cancelled';
    if (r.status === 'Approved') return r.reviewed_by_name ? `Approved by ${r.reviewed_by_name}` : 'Approved';
    return 'Awaiting approval';
}

/** Profile > My Leave: balances, file a leave request, and the status of your own requests. */
export default function MyLeavePage() {
    const { data, loading, error, retry, reload } = usePageData(leaveService.myPage);
    const [form, setForm] = useState<typeof EMPTY | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<LeavePreview | null>(null);
    const [previewError, setPreviewError] = useState('');
    const [viewing, setViewing] = useState<LeaveRequest | null>(null);
    const [busy, setBusy] = useState(false);
    const filters = useFilters({ search: '', type: '', status: '', from: '', to: '' });
    const f = filters.values;
    const view = useTableView(data?.requests, r => matchesText(f.search, r.request_no, r.leave_type, r.reason) && is(f.type, r.leave_type)
        && is(f.status, r.status) && inDateRange(r.created_at, f.from, f.to), {
        no: r => r.request_no, type: r => r.leave_type, start: r => r.start_date, end: r => r.end_date, days: r => Number(r.days),
        reason: r => r.reason, submitted: r => r.created_at, status: r => r.status,
    });
    const fileRef = useRef<HTMLInputElement>(null);

    const types = data?.types ?? [];
    const balances = data?.balances ?? [];
    const today = data?.today ?? isoDateFromToday();
    const type = types.find(t => String(t.id) === form?.leave_type_id);
    const balanceOf = (typeId: number, year: number) => balances.find(b => b.leave_type_id === typeId && b.year === year);

    // Days of the chosen range, from the schedule (same checks as submitting).
    useEffect(() => {
        setPreview(null);
        setPreviewError('');
        if (!form?.leave_type_id || !form.start_date || !form.end_date) return;
        if (form.end_date < form.start_date) { setPreviewError('The end date cannot be earlier than the start date.'); return; }
        let live = true;
        const t = window.setTimeout(() => {
            leaveService.preview(form.leave_type_id, form.start_date, form.end_date)
                .then(p => { if (live) setPreview(p); })
                .catch(err => { if (live) setPreviewError(err instanceof Error ? err.message : 'These dates cannot be filed.'); });
        }, 250);
        return () => { live = false; window.clearTimeout(t); };
    }, [form?.leave_type_id, form?.start_date, form?.end_date]);

    const open = () => { setForm({ ...EMPTY }); setFile(null); if (fileRef.current) fileRef.current.value = ''; };

    const submit = async () => {
        if (!form) return;
        let invalid = '';
        if (!form.leave_type_id) invalid = 'Please select the leave type.';
        else if (!form.start_date || !form.end_date) invalid = 'Please select the start and end dates.';
        else if (previewError) invalid = previewError;
        else if (form.reason.replace(/\s+/g, ' ').trim().length < 10) invalid = 'Please explain the reason in at least 10 characters.';
        else if (/[<>]/.test(form.reason)) invalid = 'Please do not use < or > characters.';
        else if (type?.requires_document && !file) invalid = `${type.name} requires a supporting document.`;
        else if (file && file.size > 5 * 1024 * 1024) invalid = 'The supporting document is too large (maximum 5 MB).';
        if (invalid) { await ArchonAlert.warning(invalid, { title: 'Check Your Leave Request' }); return; }
        const ok = await confirmDialog({
            title: 'Submit Leave Request',
            paragraphs: ['Send this leave request to HR for approval?'],
            details: [
                { label: 'Leave Type', value: type?.name ?? '' },
                { label: 'Dates', value: `${phpMjY(form.start_date)} - ${phpMjY(form.end_date)}` },
                { label: 'Days', value: preview ? dayCount(preview.days) : '' },
            ],
            icon: 'question', confirmText: 'Submit',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await leaveService.submit(form, file);
            setForm(null);
            await ArchonAlert.success(res.message, { timer: 2200 });
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'Your leave request could not be submitted.');
        } finally {
            setBusy(false);
        }
    };

    const canCancel = (r: LeaveRequest) => r.status === 'Pending' || (r.status === 'Approved' && r.start_date > today);
    const cancel = async (r: LeaveRequest) => {
        const ok = await confirmDialog({
            title: 'Cancel Leave Request', paragraphs: [`Cancel ${r.request_no} (${r.leave_type}, ${phpMjY(r.start_date)} - ${phpMjY(r.end_date)})?`],
            icon: 'warning', confirmText: 'Cancel Request', danger: true,
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await leaveService.cancel(r.id);
            setViewing(null);
            await ArchonAlert.success(res.message, { timer: 1800 });
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The leave request could not be cancelled.');
        } finally {
            setBusy(false);
            await reload();
        }
    };

    return (
        <>
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && !data.employee && (
                <Card><p style={{ color: 'var(--text-secondary)', margin: 0 }}><Icon as={Info} /> Your account is not linked to an employee record. Please contact HR.</p></Card>
            )}
            {data?.employee && (
                <>
                    <Card title={<><Icon as={CalendarCheck} /> Leave Balances</>} id="myBalancesCard"
                        actions={<button className="btn btn-primary" id="btnNewLeave" onClick={open}><Icon as={CalendarPlus} /> New Leave Request</button>}>
                        {!balances.length ? (
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>HR has not set any leave credits for you yet. Leave types without credits can still be requested.</p>
                        ) : (
                            <div className="att-balances">
                                {balances.map(b => (
                                    <div className="att-balance" key={b.id} data-type={b.code}>
                                        <div className="att-balance-name">{b.leave_type} · {b.year}</div>
                                        <div className="att-balance-value">{b.remaining}<span className="att-balance-sub"> / {b.days} days left</span></div>
                                        <div className="att-balance-bar"><span style={{ width: `${b.days > 0 ? Math.min(100, ((b.used + b.pending) / b.days) * 100) : 0}%` }} /></div>
                                        <div className="att-balance-sub">{b.used} used · {b.pending} pending</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                    <Card title="My Leave Requests" bodyClass="no-padding" id="myLeaveCard">
                        {!!data.requests?.length && (
                            <div className="toolbar-left" style={{ padding: '1rem 1.5rem 0.25rem' }}>
                                <SearchBox id="myLeaveSearch" value={f.search} onChange={filters.set('search')} placeholder="Search request ID, reason..." />
                                <FilterSelect id="myLeaveTypeFilter" label="Leave Types" value={f.type} onChange={filters.set('type')} options={distinct(data.requests, r => r.leave_type)} />
                                <FilterSelect id="myLeaveStatusFilter" label="Statuses" value={f.status} onChange={filters.set('status')} options={distinct(data.requests, r => r.status)} />
                                <DateRangeFilter id="myLeaveDate" label="Submitted" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                                <ClearFilters id="myLeaveClear" active={filters.active} onClear={filters.clear} />
                            </div>
                        )}
                        <table className="data-table" id="myLeaveTable">
                            <thead><tr><SortTh view={view} k="no">Leave Request ID</SortTh><SortTh view={view} k="type">Leave Type</SortTh><SortTh view={view} k="start">Start Date</SortTh><SortTh view={view} k="end">End Date</SortTh><SortTh view={view} k="days">No. of Days</SortTh><SortTh view={view} k="reason">Reason</SortTh><SortTh view={view} k="submitted">Date Submitted</SortTh><SortTh view={view} k="status">Status</SortTh><th>Remarks</th><th>Actions</th></tr></thead>
                            <tbody>
                                {!data.requests?.length ? <EmptyRow colSpan={10}>You have no leave requests yet.</EmptyRow> : !view.rows.length ? <EmptyRow colSpan={10}>No records found. Try other filters or clear them.</EmptyRow> : view.rows.map(r => (
                                    <tr className="hover-row" key={r.id} data-id={r.id} data-status={r.status}>
                                        <td><strong>{r.request_no}</strong></td>
                                        <td>{r.leave_type}</td>
                                        <td className="att-nowrap">{phpMjY(r.start_date)}</td>
                                        <td className="att-nowrap">{phpMjY(r.end_date)}</td>
                                        <td>{r.days}</td>
                                        <td style={{ maxWidth: 220 }} title={r.reason}><span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.reason}</span></td>
                                        <td className="att-nowrap">{phpMjY(r.created_at)}</td>
                                        <td><Badge variant={LEAVE_BADGE[r.status]}>{r.status}</Badge></td>
                                        <td style={{ minWidth: 170, maxWidth: 260 }}>{leaveRemarks(r) || <span className="att-muted">—</span>}</td>
                                        <td className="att-nowrap">
                                            <button className="table-action-btn btn-mylv-view" title="View" onClick={() => setViewing(r)}><Icon as={Eye} /></button>
                                            {canCancel(r) && <button className="table-action-btn btn-mylv-cancel" title="Cancel" disabled={busy} onClick={() => void cancel(r)}><Icon as={Ban} /></button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}

            <Modal open={!!form} onClose={() => setForm(null)} size="lg" title={<><Icon as={CalendarPlus} /> New Leave Request</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
                    <button type="button" className="btn btn-primary" id="lvSubmitBtn" disabled={busy} onClick={() => void submit()}><Icon as={Send} /> Submit Request</button>
                </>}>
                {form && (
                    <form id="leaveRequestForm" className="modal-form-grid" onSubmit={e => e.preventDefault()}>
                        <div className="form-group full-width">
                            <label htmlFor="lvType">Leave Type {req}</label>
                            <select className="form-input" id="lvType" value={form.leave_type_id} onChange={e => setForm({ ...form, leave_type_id: e.target.value })}>
                                <option value="">Select leave type&hellip;</option>
                                {types.map(t => {
                                    const b = balanceOf(t.id, Number((form.start_date || today).slice(0, 4)));
                                    return <option key={t.id} value={t.id}>{t.name}{t.with_credits ? (b ? ` (${b.remaining} days left)` : ' (no credits set)') : ''}</option>;
                                })}
                            </select>
                            {type?.description && <span style={hint}>{type.description}</span>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="lvStart">Start Date {req}</label>
                            <input type="date" className="form-input" id="lvStart" value={form.start_date}
                                onChange={e => setForm({ ...form, start_date: e.target.value, end_date: form.end_date && form.end_date >= e.target.value ? form.end_date : e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="lvEnd">End Date {req}</label>
                            <input type="date" className="form-input" id="lvEnd" min={form.start_date} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                        </div>
                        <div className="form-group full-width" id="lvPreview" aria-live="polite">
                            {previewError ? <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{previewError}</span>
                                : preview ? <span style={{ fontSize: '0.85rem' }}>
                                    <strong>{dayCount(preview.days)}</strong> of leave (your scheduled work days).
                                    {preview.excluded.length > 0 && <span className="att-muted"> Not counted: {preview.excluded.map(x => `${fmtDay(x.date)} (${x.reason})`).join(', ')}.</span>}
                                </span> : <span style={hint}>The number of days is counted from your work schedule: rest days and holidays are not counted.</span>}
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="lvReason">Reason {req}</label>
                            <textarea className="form-input" id="lvReason" maxLength={1000} style={{ minHeight: 90, resize: 'vertical' }} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="lvFile">Supporting Document {type?.requires_document ? req : <span style={hint}>(optional)</span>}</label>
                            <input type="file" className="form-input" id="lvFile" ref={fileRef} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                            <span style={hint}>PDF, JPG, PNG, DOC or DOCX, up to 5 MB.</span>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" title={<><Icon as={CalendarCheck} /> Leave Request {viewing?.request_no}</>}
                footer={viewing && <>
                    <button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>
                    {canCancel(viewing) && <button className="btn btn-danger" id="myLvViewCancel" disabled={busy} onClick={() => void cancel(viewing)}><Icon as={Ban} /> Cancel Request</button>}
                </>}>
                {viewing && <LeaveDetails request={viewing} showEmployee={false} />}
            </Modal>
        </>
    );
}
