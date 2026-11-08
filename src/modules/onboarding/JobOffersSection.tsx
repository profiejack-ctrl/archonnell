import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban, CheckCircle2, Eye, FilePlus2, FileText, Handshake, Mail, Pencil, Save, Send, UserCheck, UserRound, XCircle } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { LockedTag } from '../../components/LockedInfo';
import { Badge, EmptyRow, InfoItem, PageState, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { usePageData } from '../../hooks/usePageData';
import { jobOfferService, type JobOffer, type OfferCandidate, type OfferForm, type OfferStatus } from '../../services/jobOfferService';
import { ArchonAlert, confirmDialog, esc, promptText } from '../../utils/alerts';
import { isoDateFromToday, phpFjY, phpMjY, phpMjYgiA } from '../../utils/format';
import { ApplicantViewModal } from '../applicants/ApplicantActions';
import ResumeModal, { type ResumeTarget } from '../applicants/ResumeModal';
import { shiftTimes } from '../attendance/shared';

export const OFFER_BADGE: Record<OfferStatus, string> = {
    Draft: 'badge-secondary', Extended: 'badge-info', Accepted: 'badge-success', Declined: 'badge-danger', Expired: 'badge-warning', Withdrawn: 'badge-secondary',
};
const req = <span style={{ color: 'var(--danger)' }}>*</span>;
const hint = { fontSize: '0.75rem', color: 'var(--text-muted)' } as const;
const peso = (n: number) => `PHP ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A response / withdrawal note: 5-500 characters, no < or >. */
const noteError = (min: number) => (v: string) => {
    const t = v.replace(/\s+/g, ' ').trim();
    if (t.length < min) return `Please enter at least ${min} characters.`;
    if (t.length > 500) return 'Please keep it to 500 characters.';
    return /[<>]/.test(t) ? 'Please do not use < or > characters.' : '';
};

/** The day before a Y-m-d date (the latest allowed offer expiration date). */
function dayBefore(ymd: string): string {
    if (!ymd) return '';
    const d = new Date(`${ymd}T00:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
}

/** Accepted by the applicant (portal / e-mail link): waiting for HR to confirm the hire. */
const applicantAccepted = (o: JobOffer) => o.status === 'Extended' && o.applicant_response === 'Accepted';
const CHANNEL = { Portal: 'Applicant Portal', Email: 'e-mail link' } as const;

/** Same checks as the server (jo_terms); '' when the form can be saved. */
function formError(f: OfferForm, today: string): string {
    if (!f.employment_type) return 'Please choose the employment type.';
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(f.salary.replace(/,/g, '')) || Number(f.salary.replace(/,/g, '')) <= 0) return 'Please enter the proposed monthly salary.';
    if (!f.start_date) return 'Please select the start date.';
    if (!f.expires_on) return 'Please select the offer expiration date.';
    if (f.start_date < today) return 'The start date cannot be in the past.';
    if (f.expires_on < today) return 'The offer expiration date cannot be in the past.';
    if (f.expires_on > dayBefore(f.start_date)) return 'The offer must expire at least 1 day before the start date, so the applicant answers before their first day of work.';
    if ([f.work_schedule, f.benefits, f.terms].some(v => /[<>]/.test(v))) return 'Please do not use < or > characters.';
    return '';
}

/**
 * Onboarding Management > Job Offers: applicants who passed the Final
 * Interview get an offer (Draft -> Extended); the applicant's answer is
 * recorded here. Accepting hires them (employee + onboarding record).
 */
export default function JobOffersSection({ onHired }: { onHired: () => void }) {
    const { data, loading, error, retry, reload } = usePageData(jobOfferService.page);
    const [params, setParams] = useSearchParams();
    const [form, setForm] = useState<(OfferForm & { name: string; position: string; department: string }) | null>(null);
    const [viewing, setViewing] = useState<JobOffer | null>(null);
    const [applicantView, setApplicantView] = useState<number | null>(null);
    const [resume, setResume] = useState<ResumeTarget | null>(null);
    const filters = useFilters({ search: '', status: '', department: '', position: '', type: '', from: '', to: '' });
    const f = filters.values;
    const [busy, setBusy] = useState(false);
    const today = data?.today ?? isoDateFromToday();

    const openCreate = (c: OfferCandidate) => setForm({
        applicant_id: c.id, name: c.full_name, position: c.position, department: c.department, employment_type: 'Probationary',
        salary: '', start_date: '', expires_on: '', work_schedule: '', benefits: '', terms: '',
    });
    const openEdit = (o: JobOffer) => {
        setViewing(null);
        setForm({
            id: o.id, name: o.full_name, position: o.position, department: o.department, employment_type: o.employment_type, salary: String(o.salary),
            start_date: o.start_date, expires_on: o.expires_on, work_schedule: o.work_schedule ?? '', benefits: o.benefits ?? '', terms: o.terms ?? '',
        });
    };

    // From Final Interview: #/new-hire-onboarding?tab=offers&applicant=ID opens the offer form for that applicant.
    useEffect(() => {
        const id = Number(params.get('applicant'));
        if (!data || !id) return;
        const c = data.candidates.find(x => x.id === id);
        const o = data.offers.find(x => x.applicant_id === id && ['Draft', 'Extended', 'Accepted'].includes(x.status));
        if (c) openCreate(c);
        else if (o) setViewing(o);
        setParams({ tab: 'offers' }, { replace: true });
    }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    const run = async (fn: () => Promise<{ message: string; warning?: string | null }>, fail: string, after?: () => void) => {
        setBusy(true);
        try {
            const res = await fn();
            setViewing(null);
            // e.g. hired, but the hired e-mail could not be sent
            if (res.warning) await ArchonAlert.warning(res.warning, { title: 'Hired - E-mail Not Sent' });
            else await ArchonAlert.success(res.message, { timer: 2600 });
            after?.();
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : fail);
        } finally {
            setBusy(false);
            await reload();
        }
    };

    const save = async () => {
        if (!form) return;
        const invalid = formError(form, today);
        if (invalid) { await ArchonAlert.warning(invalid, { title: 'Check the Job Offer' }); return; }
        const { name: _n, position: _p, department: _d, ...payload } = form;
        await run(async () => { const r = await jobOfferService.save({ ...payload, salary: payload.salary.replace(/,/g, '') }); setForm(null); return r; }, 'The job offer could not be saved.');
    };
    const extend = async (o: JobOffer) => {
        const ok = await confirmDialog({
            title: 'Extend Job Offer',
            paragraphs: [`Extend ${o.offer_no} to ${o.full_name}? The applicant is e-mailed the offer and can accept or decline it in the e-mail or the Applicant Portal until the expiration date; the offer can no longer be edited.`],
            details: [
                { label: 'Position', value: `${o.position} (${o.department})` },
                { label: 'Employment Type', value: o.employment_type },
                { label: 'Proposed Salary', value: `${peso(o.salary)} a month` },
                { label: 'Start Date', value: phpMjY(o.start_date) },
                { label: 'Offer Expires', value: phpMjY(o.expires_on) },
            ],
            icon: 'question', confirmText: 'Extend Offer',
        });
        if (ok) await run(() => jobOfferService.extend(o.id), 'The job offer could not be extended.');
    };
    const accept = async (o: JobOffer) => {
        const byApplicant = applicantAccepted(o);
        const note = await promptText({
            title: byApplicant ? 'Confirm & Hire' : 'Offer Accepted',
            html: (byApplicant
                ? `<p><strong>${esc(o.full_name)}</strong> accepted ${esc(o.offer_no)} on ${esc(phpMjYgiA(o.applicant_responded_at))} (${esc(CHANNEL[o.applicant_response_channel ?? 'Portal'])}). Confirm the hire?</p>`
                : `<p>Record that <strong>${esc(o.full_name)}</strong> accepted ${esc(o.offer_no)} (answer given outside the system)?</p>`)
                + `<p>This hires the applicant: the employee record (Employee ID) and the onboarding record are created, with ${esc(o.employment_type)} employment starting ${esc(phpMjY(o.start_date))}.</p>`,
            label: 'Note (optional)', placeholder: 'e.g., Signed offer letter received on October 3.', confirmText: byApplicant ? 'Confirm & Hire' : 'Accept & Hire', icon: 'question',
            validate: v => (/[<>]/.test(v) ? 'Please do not use < or > characters.' : ''),
        });
        if (note !== null) await run(() => jobOfferService.accept(o.id, note), 'The acceptance could not be recorded.', onHired);
    };
    const canResend = (o: JobOffer) => o.status === 'Accepted' && !!o.employee_id && o.applicant_stage === 'Hired';
    const resendHired = async (o: JobOffer) => {
        const ok = await confirmDialog({
            title: 'Resend Hired Email',
            paragraphs: [`Send the congratulations (hired) e-mail to ${o.full_name} again?`],
            details: [
                { label: 'E-mail', value: o.email ?? '—' },
                { label: 'Last Attempt', value: o.hired_email_status ? `${o.hired_email_status}${o.hired_email_at ? ` · ${phpMjYgiA(o.hired_email_at)}` : ''}` : 'None' },
            ],
            icon: 'question', confirmText: 'Resend Email',
        });
        if (ok) await run(() => jobOfferService.resendHiredEmail(o.id), 'The hired e-mail could not be sent.');
    };
    const resendOffer = async (o: JobOffer) => {
        const ok = await confirmDialog({
            title: 'Resend Offer Email', paragraphs: [`E-mail job offer ${o.offer_no} to ${o.full_name} again? The new e-mail has new Accept / Decline links; the previous links stop working.`],
            details: [{ label: 'E-mail', value: o.email ?? '—' }, { label: 'Answer By', value: phpMjY(o.expires_on) }],
            icon: 'question', confirmText: 'Resend Offer',
        });
        if (ok) await run(() => jobOfferService.resendOffer(o.id), 'The offer e-mail could not be sent.');
    };
    const decline = async (o: JobOffer) => {
        const note = await promptText({
            title: 'Offer Declined', html: `<p>Record that <strong>${esc(o.full_name)}</strong> declined ${esc(o.offer_no)}?</p><p>The applicant stays in Final Interview with their recruitment history.</p>`,
            label: 'Reason given by the applicant', placeholder: 'e.g., Accepted another offer.', confirmText: 'Record Decline', danger: true, validate: noteError(5),
        });
        if (note !== null) await run(() => jobOfferService.decline(o.id, note), 'The decline could not be recorded.');
    };
    const withdraw = async (o: JobOffer) => {
        const note = await promptText({
            title: 'Withdraw Job Offer', html: `<p>Withdraw ${esc(o.offer_no)} (${esc(o.status)}) for <strong>${esc(o.full_name)}</strong>?</p>`,
            label: 'Reason for withdrawing', placeholder: 'e.g., The position was put on hold.', confirmText: 'Withdraw Offer', danger: true, validate: noteError(5),
        });
        if (note !== null) await run(() => jobOfferService.withdraw(o.id, note), 'The job offer could not be withdrawn.');
    };

    const offerView = useTableView(data?.offers, o => is(f.status, o.status) && is(f.department, o.department) && is(f.position, o.position) && is(f.type, o.employment_type)
        && inDateRange(o.offer_date, f.from, f.to) && matchesText(f.search, o.offer_no, o.full_name, o.employee_no, o.position, o.department), {
        no: o => o.offer_no, name: o => o.full_name, position: o => o.position, department: o => o.department, type: o => o.employment_type,
        salary: o => Number(o.salary), start: o => o.start_date, offered: o => o.offer_date, expires: o => o.expires_on, status: o => o.status,
    });
    const offers = offerView.rows;
    const candidateView = useTableView(data?.candidates, () => true, {
        name: c => c.full_name, position: c => c.position, department: c => c.department, interview: c => c.final_interview_at,
        match: c => (c.match_score === null ? null : Number(c.match_score)),
    });
    const count = (s: OfferStatus) => (data?.offers ?? []).filter(o => o.status === s).length;
    const resumeOf = (x: { id?: number; applicant_id?: number; applicant_no: string | null; full_name: string; position: string; email: string | null; resume_path: string | null }) =>
        setResume({ dbId: x.applicant_id ?? x.id ?? 0, applicantNo: x.applicant_no ?? '', name: x.full_name, position: x.position, email: x.email ?? '', resumePath: x.resume_path ?? '' });

    const actions = (o: JobOffer) => (
        <>
            <button className="table-action-btn btn-jo-view" title="View" onClick={() => setViewing(o)}><Icon as={Eye} /></button>
            {o.status === 'Draft' && <>
                <button className="table-action-btn btn-jo-edit" title="Edit" onClick={() => openEdit(o)}><Icon as={Pencil} /></button>
                <button className="table-action-btn btn-jo-extend" title="Extend Offer" style={{ color: 'var(--accent)' }} disabled={busy} onClick={() => void extend(o)}><Icon as={Send} /></button>
            </>}
            {o.status === 'Extended' && <>
                <button className="table-action-btn btn-jo-accept" title={applicantAccepted(o) ? 'Confirm & Hire (accepted by the applicant)' : 'Offer Accepted (answer given outside the system)'}
                    style={{ color: 'var(--success)' }} disabled={busy} onClick={() => void accept(o)}><Icon as={applicantAccepted(o) ? UserCheck : CheckCircle2} /></button>
                {!o.applicant_response && <button className="table-action-btn btn-jo-resend-offer" title="Resend Offer Email" disabled={busy} onClick={() => void resendOffer(o)}><Icon as={Send} /></button>}
                <button className="table-action-btn btn-jo-decline" title="Offer Declined" style={{ color: 'var(--danger)' }} disabled={busy} onClick={() => void decline(o)}><Icon as={XCircle} /></button>
            </>}
            {canResend(o) && <button className="table-action-btn btn-jo-resend" title="Resend Hired Email" disabled={busy} onClick={() => void resendHired(o)}><Icon as={Mail} /></button>}
            {(o.status === 'Draft' || o.status === 'Extended') && <button className="table-action-btn btn-jo-withdraw" title="Withdraw Offer" disabled={busy} onClick={() => void withdraw(o)}><Icon as={Ban} /></button>}
        </>
    );

    return (
        <>
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <StatsGrid>
                        <StatCard icon={UserRound} gradient={['#60a5fa', '#3b82f6']} value={data.candidates.length} label="Ready for Job Offer" />
                        <StatCard icon={FileText} gradient={['#94a3b8', '#64748b']} value={count('Draft')} label="Draft Offers" />
                        <StatCard icon={Send} gradient={['#a78bfa', '#7c3aed']} value={count('Extended')} label="Extended (Awaiting Answer)" />
                        <StatCard icon={UserCheck} gradient={['#34d399', '#10b981']} value={count('Accepted')} label="Accepted" />
                    </StatsGrid>

                    <div className="card hover-card" id="offerCandidatesCard">
                        <div className="card-header">
                            <div>
                                <h3 className="card-title"><Icon as={Handshake} /> Ready for Job Offer</h3>
                                <p className="card-subtitle">Applicants in the Final Interview stage without an open offer</p>
                            </div>
                        </div>
                        <div className="card-body no-padding">
                            <table className="data-table" id="offerCandidatesTable">
                                <thead><tr><SortTh view={candidateView} k="name">Applicant</SortTh><SortTh view={candidateView} k="position">Position</SortTh><SortTh view={candidateView} k="department">Department</SortTh><SortTh view={candidateView} k="interview">Final Interview</SortTh><SortTh view={candidateView} k="match">AI Match</SortTh><th>Actions</th></tr></thead>
                                <tbody>
                                    {!data.candidates.length ? <EmptyRow colSpan={6}>No applicants are waiting for a job offer. Applicants appear here after their Final Interview.</EmptyRow>
                                        : candidateView.rows.map(c => (
                                            <tr className="hover-row" key={c.id} data-applicant={c.id}>
                                                <td><strong>{c.full_name}</strong><div style={hint}>{c.applicant_no ?? '—'}{c.posting_no ? ` · ${c.posting_no}` : ''}</div></td>
                                                <td>{c.position}</td>
                                                <td>{c.department}</td>
                                                <td>{c.final_interview_at ? phpMjYgiA(c.final_interview_at) : '—'}{c.final_interviewer && <div style={hint}>{c.final_interviewer}</div>}</td>
                                                <td>{c.match_score !== null ? `${Math.round(Number(c.match_score))}%` : '—'}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    <button className="table-action-btn" title="View Applicant" onClick={() => setApplicantView(c.id)}><Icon as={Eye} /></button>
                                                    <button className="table-action-btn" title="View Resume" disabled={!c.has_resume} onClick={() => resumeOf(c)}><Icon as={FileText} /></button>
                                                    <button className="btn btn-sm btn-primary btn-jo-create" onClick={() => openCreate(c)}><Icon as={FilePlus2} /> Create Job Offer</button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="card hover-card" id="jobOffersCard" style={{ marginTop: '1.5rem' }}>
                        <div className="card-header">
                            <div>
                                <h3 className="card-title"><Icon as={FileText} /> Job Offers</h3>
                                <p className="card-subtitle">Draft &rarr; Extended &rarr; Accepted (hired, moves to onboarding) / Declined / Expired / Withdrawn</p>
                            </div>
                        </div>
                        <div className="card-body" style={{ paddingBottom: 0 }}>
                            <div className="toolbar-left" style={{ marginBottom: '1rem' }}>
                                <SearchBox id="joSearch" value={f.search} onChange={filters.set('search')} placeholder="Search offer no., applicant..." />
                                <FilterSelect id="joStatusFilter" label="Statuses" value={f.status} onChange={filters.set('status')}
                                    options={['Draft', 'Extended', 'Accepted', 'Declined', 'Expired', 'Withdrawn'] as OfferStatus[]} />
                                <FilterSelect id="joDeptFilter" label="Departments" value={f.department} onChange={filters.set('department')} options={distinct(data.offers, o => o.department)} />
                                <FilterSelect id="joPositionFilter" label="Positions" value={f.position} onChange={filters.set('position')} options={distinct(data.offers, o => o.position)} />
                                <FilterSelect id="joTypeFilter" label="Employment Types" value={f.type} onChange={filters.set('type')} options={distinct(data.offers, o => o.employment_type)} />
                                <DateRangeFilter id="joOffered" label="Offer Date" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                                <ClearFilters id="joClear" active={filters.active} onClear={filters.clear} />
                                <FilterCount shown={offers.length} total={offerView.total} />
                            </div>
                        </div>
                        <div className="card-body no-padding">
                            <table className="data-table" id="jobOffersTable">
                                <thead>
                                    <tr><SortTh view={offerView} k="no">Offer No.</SortTh><SortTh view={offerView} k="name">Applicant</SortTh><SortTh view={offerView} k="position">Position</SortTh><SortTh view={offerView} k="department">Department</SortTh><SortTh view={offerView} k="type">Employment Type</SortTh><SortTh view={offerView} k="salary">Proposed Salary</SortTh>
                                        <SortTh view={offerView} k="start">Start Date</SortTh><SortTh view={offerView} k="offered">Offer Date</SortTh><SortTh view={offerView} k="expires">Expires</SortTh><SortTh view={offerView} k="status">Status</SortTh><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {!offers.length ? <EmptyRow colSpan={11}>{data.offers.length ? 'No records found. Try other filters or clear them.' : 'No job offers yet. Use Create Job Offer above.'}</EmptyRow>
                                        : offers.map(o => (
                                            <tr className="hover-row" key={o.id} data-id={o.id} data-status={o.status}>
                                                <td style={{ whiteSpace: 'nowrap' }}><strong>{o.offer_no}</strong></td>
                                                <td>{o.full_name}{o.employee_no && <div style={hint}>Employee {o.employee_no}</div>}</td>
                                                <td>{o.position}</td>
                                                <td>{o.department}</td>
                                                <td>{o.employment_type}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{peso(o.salary)}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{phpMjY(o.start_date)}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{o.offer_date ? phpMjY(o.offer_date) : '—'}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{phpMjY(o.expires_on)}</td>
                                                <td><Badge variant={OFFER_BADGE[o.status]}>{o.status}</Badge>
                                                    {applicantAccepted(o) && <div style={{ marginTop: 4 }}><Badge variant="badge-success">Accepted by Applicant</Badge><div style={hint}>Awaiting HR confirmation</div></div>}
                                                    {o.status === 'Extended' && !o.applicant_response && <div style={hint}>Awaiting the applicant{o.offer_email_status === 'Failed' ? ' · e-mail not sent' : ''}</div>}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{actions(o)}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Create / edit (Draft only) */}
            <Modal open={!!form} onClose={() => setForm(null)} size="lg" title={<><Icon as={Handshake} /> {form?.id ? 'Edit Job Offer' : 'Create Job Offer'}</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
                    <button className="btn btn-primary" id="joSaveBtn" disabled={busy} onClick={() => void save()}><Icon as={Save} /> Save as Draft</button>
                </>}>
                {form && (
                    <form className="modal-form-grid" id="jobOfferForm" onSubmit={e => e.preventDefault()}>
                        <div className="form-group">
                            <label>Applicant Name</label>
                            <input className="form-input locked-input" id="joApplicant" readOnly value={form.name} /><LockedTag title="The verified applicant name is carried into the offer and the employee record." />
                        </div>
                        <div className="form-group">
                            <label>Position</label>
                            <input className="form-input locked-input" id="joPosition" readOnly value={form.position} /><LockedTag title="The position the applicant applied for." />
                        </div>
                        <div className="form-group">
                            <label>Department</label>
                            <input className="form-input locked-input" id="joDepartment" readOnly value={form.department} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="joType">Employment Type {req}</label>
                            <select className="form-input" id="joType" value={form.employment_type} onChange={e => setForm({ ...form, employment_type: e.target.value })}>
                                {data?.employment_types.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <span style={hint}>New hires start as Probationary or Contractual.</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="joSalary">Proposed Monthly Salary (PHP) {req}</label>
                            <input type="text" inputMode="decimal" className="form-input" id="joSalary" value={form.salary} placeholder="e.g., 25000" onChange={e => setForm({ ...form, salary: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="joStart">Start Date {req}</label>
                            <input type="date" className="form-input" id="joStart" min={today} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                            <span style={hint}>Becomes the date hired when the offer is accepted.</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="joExpires">Offer Expiration Date {req}</label>
                            <input type="date" className="form-input" id="joExpires" min={today} max={dayBefore(form.start_date) || undefined} value={form.expires_on} onChange={e => setForm({ ...form, expires_on: e.target.value })} />
                            {form.expires_on && form.start_date && form.expires_on > dayBefore(form.start_date)
                                ? <span id="joExpiresError" style={{ ...hint, color: 'var(--danger)' }}>Must be at least 1 day before the start date ({phpMjY(form.start_date)}).</span>
                                : <span style={hint}>Last day the applicant can accept; at least 1 day before the start date.</span>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="joSchedule">Work Schedule</label>
                            <input type="text" className="form-input" id="joSchedule" maxLength={200} value={form.work_schedule} onChange={e => setForm({ ...form, work_schedule: e.target.value })} placeholder="e.g., Mon - Fri, 8:00 AM - 5:00 PM" />
                            {!!data?.shifts.length && (
                                <select className="form-input" style={{ marginTop: '0.4rem' }} aria-label="Use a configured shift" value=""
                                    onChange={e => { const s = data.shifts.find(x => String(x.id) === e.target.value); if (s) setForm({ ...form, work_schedule: `${s.shift_name}, Mon - Fri, ${shiftTimes(s.start_time, s.end_time, s.overnight)}` }); }}>
                                    <option value="">Use a configured shift&hellip;</option>
                                    {data.shifts.filter(s => s.status === 'Active').map(s => <option key={s.id} value={s.id}>{s.shift_name} ({shiftTimes(s.start_time, s.end_time)})</option>)}
                                </select>
                            )}
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="joBenefits">Benefits</label>
                            <textarea className="form-input" id="joBenefits" maxLength={2000} style={{ minHeight: 70, resize: 'vertical' }} value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} placeholder="e.g., HMO coverage after regularization, 13th month pay" />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="joTerms">Additional Terms / Notes</label>
                            <textarea className="form-input" id="joTerms" maxLength={2000} style={{ minHeight: 70, resize: 'vertical' }} value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} />
                        </div>
                    </form>
                )}
            </Modal>

            {/* View */}
            <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" title={<><Icon as={Handshake} /> Job Offer {viewing?.offer_no}</>}
                footer={viewing && <>
                    <button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>
                    <button className="btn btn-outline" disabled={!viewing.has_resume} onClick={() => resumeOf(viewing)}><Icon as={FileText} /> View Resume</button>
                    {viewing.status === 'Draft' && <>
                        <button className="btn btn-outline" onClick={() => openEdit(viewing)}><Icon as={Pencil} /> Edit</button>
                        <button className="btn btn-primary" id="joViewExtend" disabled={busy} onClick={() => void extend(viewing)}><Icon as={Send} /> Extend Offer</button>
                    </>}
                    {viewing.status === 'Extended' && <>
                        <button className="btn btn-danger" id="joViewDecline" disabled={busy} onClick={() => void decline(viewing)}><Icon as={XCircle} /> Declined</button>
                        {!viewing.applicant_response && <button className="btn btn-outline" id="joViewResendOffer" disabled={busy} onClick={() => void resendOffer(viewing)}><Icon as={Send} /> Resend Offer Email</button>}
                        <button className="btn btn-success" id="joViewAccept" disabled={busy} onClick={() => void accept(viewing)}>
                            <Icon as={applicantAccepted(viewing) ? UserCheck : CheckCircle2} /> {applicantAccepted(viewing) ? 'Confirm & Hire' : 'Accepted'}
                        </button>
                    </>}
                    {canResend(viewing) && <button className="btn btn-primary" id="joViewResendHired" disabled={busy} onClick={() => void resendHired(viewing)}><Icon as={Mail} /> Resend Hired Email</button>}
                </>}>
                {viewing && (
                    <>
                        <div className="modal-section">
                            <h4 className="modal-section-title"><Icon as={UserRound} /> Applicant</h4>
                            <div className="modal-info-grid">
                                <InfoItem label="Applicant Name"><span id="joViewName">{viewing.full_name}</span> <LockedTag /></InfoItem>
                                <InfoItem label="Applicant No.">{viewing.applicant_no ?? '—'}</InfoItem>
                                <InfoItem label="Email">{viewing.email ?? '—'}</InfoItem>
                                <InfoItem label="Date Applied">{phpFjY(viewing.applied_at)}</InfoItem>
                                <InfoItem label="Pre-Interview">{viewing.pre_interview_at ? `${phpMjYgiA(viewing.pre_interview_at)}${viewing.interviewer ? ` · ${viewing.interviewer}` : ''}` : '—'}</InfoItem>
                                <InfoItem label="Final Interview">{viewing.final_interview_at ? `${phpMjYgiA(viewing.final_interview_at)}${viewing.final_interviewer ? ` · ${viewing.final_interviewer}` : ''}${viewing.final_interview_type ? ` (${viewing.final_interview_type})` : ''}` : '—'}</InfoItem>
                            </div>
                        </div>
                        <div className="modal-section">
                            <h4 className="modal-section-title"><Icon as={Handshake} /> Offer</h4>
                            <div className="modal-info-grid">
                                <InfoItem label="Offer Status"><Badge variant={OFFER_BADGE[viewing.status]}>{viewing.status}</Badge>{applicantAccepted(viewing) && <> <Badge variant="badge-success">Accepted by Applicant</Badge></>}</InfoItem>
                                <InfoItem label="Applicant's Answer"><span id="joViewApplicantAnswer">{viewing.applicant_response
                                    ? `${viewing.applicant_response} · ${phpMjYgiA(viewing.applicant_responded_at)} (${CHANNEL[viewing.applicant_response_channel ?? 'Portal']})`
                                    : viewing.status === 'Extended' ? 'Awaiting answer' : '—'}</span></InfoItem>
                                {viewing.applicant_response_reason && <InfoItem label="Applicant's Reason for Declining" full>{viewing.applicant_response_reason}</InfoItem>}
                                {viewing.offer_email_status && <InfoItem label="Offer E-mail">{viewing.offer_email_status === 'Sent'
                                    ? `Sent${viewing.offer_emailed_at ? ` · ${phpMjYgiA(viewing.offer_emailed_at)}` : ''}`
                                    : <span style={{ color: 'var(--danger)' }}>Not sent: {viewing.offer_email_error}</span>}</InfoItem>}
                                <InfoItem label="Position">{viewing.position}{viewing.posting_no ? ` (${viewing.posting_no})` : ''}</InfoItem>
                                <InfoItem label="Department">{viewing.department}</InfoItem>
                                <InfoItem label="Employment Type">{viewing.employment_type}</InfoItem>
                                <InfoItem label="Proposed Salary">{peso(viewing.salary)} a month</InfoItem>
                                <InfoItem label="Start Date">{phpFjY(viewing.start_date)}</InfoItem>
                                <InfoItem label="Work Schedule">{viewing.work_schedule ?? '—'}</InfoItem>
                                <InfoItem label="Offer Date">{viewing.offer_date ? phpFjY(viewing.offer_date) : 'Not yet extended'}</InfoItem>
                                <InfoItem label="Offer Expiration Date">{phpFjY(viewing.expires_on)}</InfoItem>
                                <InfoItem label="Benefits" full><span style={{ whiteSpace: 'pre-line' }}>{viewing.benefits ?? '—'}</span></InfoItem>
                                <InfoItem label="Additional Terms / Notes" full><span style={{ whiteSpace: 'pre-line' }}>{viewing.terms ?? '—'}</span></InfoItem>
                            </div>
                        </div>
                        <div className="modal-section">
                            <h4 className="modal-section-title"><Icon as={CheckCircle2} /> Status History</h4>
                            <div className="modal-info-grid">
                                <InfoItem label="Created">{phpMjYgiA(viewing.created_at)}{viewing.created_by_name ? ` by ${viewing.created_by_name}` : ''}</InfoItem>
                                {viewing.extended_at && <InfoItem label="Extended">{phpMjYgiA(viewing.extended_at)}{viewing.extended_by_name ? ` by ${viewing.extended_by_name}` : ''}</InfoItem>}
                                {viewing.responded_at && <InfoItem label={viewing.status}>{phpMjYgiA(viewing.responded_at)}{viewing.closed_by_name ? ` (recorded by ${viewing.closed_by_name})` : ''}</InfoItem>}
                                {viewing.response_note && <InfoItem label="Note" full>{viewing.response_note}</InfoItem>}
                                {viewing.employee_no && <InfoItem label="Employee Record">Hired as {viewing.employee_no}; onboarding record created.</InfoItem>}
                                {viewing.status === 'Accepted' && (
                                    <InfoItem label="Hired E-mail"><span id="joViewHiredEmail">
                                        {viewing.hired_email_status
                                            ? <><Badge variant={viewing.hired_email_status === 'Sent' ? 'badge-success' : viewing.hired_email_status === 'Failed' ? 'badge-danger' : 'badge-warning'}>{viewing.hired_email_status}</Badge>
                                                {' '}{viewing.hired_email_to ?? ''}{viewing.hired_email_at ? ` · ${phpMjYgiA(viewing.hired_email_at)}` : ''}
                                                {viewing.hired_email_error && <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{viewing.hired_email_error}</div>}</>
                                            : 'Not sent'}
                                    </span></InfoItem>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </Modal>

            <ApplicantViewModal applicantId={applicantView} stage="Final Interview" onClose={() => setApplicantView(null)} onRejected={() => void reload()} />
            <ResumeModal target={resume} onClose={() => setResume(null)} />
        </>
    );
}
