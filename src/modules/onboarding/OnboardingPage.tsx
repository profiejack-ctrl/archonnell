import { useState } from 'react';
import { Circle, CircleCheck, Eye, ListChecks, Pencil, Save, UserRound, UserX } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { assignmentError, DepartmentOptions, positionAfterDepartmentChange, PositionOptions } from '../../components/assignment';
import { Badge, Page, PageHeader, PageState, PersonCell, SearchBox } from '../../components/ui';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { ChartWrapper, DepartmentBarChart, HiresLineChart } from '../../components/charts';
import { usePageData } from '../../hooks/usePageData';
import { onboardingService } from '../../services/onboardingService';
import { ArchonAlert } from '../../utils/alerts';
import { LockedTag } from '../../components/LockedInfo';
import { useSearchParams } from 'react-router-dom';
import { Handshake } from 'lucide-react';
import { Tabs } from '../attendance/shared';
import JobOffersSection from './JobOffersSection';
import type { OnboardingRow } from '../../types';

const CONTRACT_BADGE: Record<string, string> = {
    Probationary: 'badge-warning', Contractual: 'badge-info', Regular: 'badge-success', 'Full-time': 'badge-info', 'Part-time': 'badge-secondary',
};

/** The fixed onboarding checklist the legacy "View Onboarding Details" modal displayed. */
const VIEW_CHECKLIST = [
    { label: 'Signed Offer Letter', done: true, width: 100, text: 'Done', color: 'var(--success)' },
    { label: 'Tax Forms & Government IDs', done: true, width: 75, text: '75%', color: 'var(--success)' },
    { label: 'IT Equipment & Access', done: false, width: 40, text: '40%', color: 'var(--warning)' },
    { label: 'Team Introduction & Training', done: false, width: 10, text: '10%', color: 'var(--warning)' },
];

const contractOf = (o: OnboardingRow) => (o.ctr || 'Full-time').trim();

/** Onboarding > New Hire Onboarding. */
export default function OnboardingPage() {
    // Final Interview -> Job Offer -> Accepted -> Onboarding: both live in this module.
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'offers' ? 'offers' : 'onboarding';
    const { data, loading, error, retry, reload } = usePageData(onboardingService.page);
    const filters = useFilters({ search: '', contract: '', department: '', position: '', status: '', from: '', to: '' });
    const f = filters.values;
    const [viewing, setViewing] = useState<OnboardingRow | null>(null);
    const [editing, setEditing] = useState<OnboardingRow | null>(null);
    const [form, setForm] = useState({ name: '', contract: 'Full-time', dept: '', pos: '', date: '' });
    const [saving, setSaving] = useState(false);

    const view = useTableView(data?.rows, o => matchesText(f.search, o.eno, o.fname, contractOf(o), o.dep, o.pos, o.dh)
        && is(f.contract, contractOf(o)) && is(f.department, o.dep) && is(f.position, o.pos) && is(f.status, o.status) && inDateRange(o.dh, f.from, f.to), {
        no: o => o.eno, name: o => o.fname, contract: o => contractOf(o), department: o => o.dep, position: o => o.pos, hired: o => o.dh,
    });

    const openEdit = (o: OnboardingRow) => {
        setForm({
            name: o.fname ?? '',
            contract: contractOf(o).replace(/[^\w-]/g, '') || 'Full-time',
            dept: o.dep ?? '',
            pos: o.pos ?? '',
            date: o.dh ?? '',
        });
        setEditing(o);
    };

    const save = async () => {
        if (!editing) return;
        const invalid = assignmentError(data?.departments ?? [], data?.positions ?? [], form.dept, form.pos,
            { department: editing.dep ?? '', position: editing.pos ?? '' });
        if (invalid) { await ArchonAlert.warning(invalid, { title: 'Invalid Department / Position' }); return; }
        setSaving(true);
        try {
            await onboardingService.update({
                onboarding_id: editing.id,
                full_name: form.name.trim(),
                contract_type: form.contract,
                department: form.dept.trim(),
                position: form.pos.trim(),
                date_hired: form.date,
                status: editing.status || '',
                progress: editing.progress ?? '',
            });
            setEditing(null);
            await ArchonAlert.success('Onboarding record updated successfully.', { timer: 1800 });
            await reload();
        } catch (err) {
            await ArchonAlert.error('Could not update onboarding record: ' + (err instanceof Error ? err.message : ''));
        } finally {
            setSaving(false);
        }
    };

    const rows = data?.rows ?? [];
    const noneVisible = rows.length > 0 && view.rows.length === 0;

    return (
        <Page id="new-hire-onboarding">
            <PageHeader title="New Hire Onboarding" subtitle="Seamlessly integrate new team members" />
            <Tabs id="onbTabs" active={tab} onChange={t => setParams(t === 'offers' ? { tab: 'offers' } : {}, { replace: true })} tabs={[
                { key: 'onboarding', label: <><Icon as={UserRound} /> New Hire Onboarding</> },
                { key: 'offers', label: <><Icon as={Handshake} /> Job Offers</> },
            ]} />
            {tab === 'offers' && <JobOffersSection onHired={() => void reload()} />}
            {tab === 'onboarding' && <PageState loading={loading} error={error} onRetry={retry} />}
            {tab === 'onboarding' && data && (
                <>
                    <div className="analytics-grid">
                        <div className="card analytics-card hover-card onboarding-chart-card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Department New Hires</h3>
                                    <p className="card-subtitle">Number of newly hired employees per department</p>
                                </div>
                                <div className="card-actions">
                                    <Badge variant="badge-info"><span id="deptNewHiresTotalBadge">{data.charts.total_new_hires} Total Hires</span></Badge>
                                </div>
                            </div>
                            <div className="card-body">
                                <ChartWrapper id="onboardingDeptBarChart" type="bar" label="Department New Hires Bar Chart">
                                    {ref => <DepartmentBarChart items={data.charts.department_hires} wrapperRef={ref} />}
                                </ChartWrapper>
                            </div>
                        </div>
                        <div className="card analytics-card hover-card onboarding-chart-card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">New Hires Over Time</h3>
                                    <p className="card-subtitle">Monthly hiring volume in chronological order</p>
                                </div>
                                <div className="card-actions">
                                    <Badge variant="badge-success">Chronological</Badge>
                                </div>
                            </div>
                            <div className="card-body">
                                <ChartWrapper id="onboardingHiresLineChart" type="line" label="New Hires Over Time Line Chart">
                                    {ref => <HiresLineChart items={data.charts.hires_over_time} wrapperRef={ref} />}
                                </ChartWrapper>
                            </div>
                        </div>
                    </div>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <SearchBox id="onboardingSearch" value={f.search} onChange={filters.set('search')} placeholder="Search name, employee ID..." />
                            <FilterSelect id="onboardingContractFilter" label="Contract Statuses" value={f.contract} onChange={filters.set('contract')} options={data.contract_statuses} />
                            <FilterSelect id="onboardingDeptFilter" label="Departments" value={f.department} onChange={filters.set('department')} options={distinct(rows, o => o.dep)} />
                            <FilterSelect id="onboardingPositionFilter" label="Positions" value={f.position} onChange={filters.set('position')} options={distinct(rows, o => o.pos)} />
                            <FilterSelect id="onboardingStatusFilter" label="Onboarding Statuses" value={f.status} onChange={filters.set('status')} options={distinct(rows, o => o.status)} />
                            <DateRangeFilter id="onboardingHired" label="Hired" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                            <ClearFilters id="onboardingClear" active={filters.active} onClear={filters.clear} />
                            <FilterCount shown={view.rows.length} total={rows.length} />
                        </div>
                    </div>
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="onboardingTable">
                                <thead>
                                    <tr><SortTh view={view} k="no">Employee ID</SortTh><SortTh view={view} k="name">Name</SortTh><SortTh view={view} k="contract">Contract</SortTh><SortTh view={view} k="department">Department</SortTh><SortTh view={view} k="position">Position</SortTh><SortTh view={view} k="hired">Date Hired</SortTh><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {!rows.length && (
                                        <tr className="onboarding-no-records">
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
                                                <Icon as={UserX} style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem', opacity: 0.6 }} />
                                                No onboarding records yet. An onboarding record is created automatically when an applicant is hired from Final Interview.
                                            </td>
                                        </tr>
                                    )}
                                    {view.rows.map((o, i) => (
                                        <tr className="hover-row" key={o.id} data-onboarding-id={o.id}>
                                            <td><strong>{o.eno}</strong></td>
                                            <td><PersonCell index={i} name={o.fname} /></td>
                                            <td><Badge variant={CONTRACT_BADGE[contractOf(o)] ?? 'badge-secondary'}>{contractOf(o)}</Badge></td>
                                            <td>{o.dep}</td>
                                            <td>{o.pos}</td>
                                            <td>{o.dh}</td>
                                            <td>
                                                <button className="table-action-btn" title="View" onClick={() => setViewing(o)}><Icon as={Eye} /></button>
                                                <button className="table-action-btn" title="Edit" onClick={() => openEdit(o)}><Icon as={Pencil} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {noneVisible && (
                                        <tr className="onboarding-no-records">
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Icon as={UserX} style={{ fontSize: '2rem', opacity: 0.6 }} />
                                                    <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>No employees found</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" zIndex={9999} title={<><Icon as={Eye} /> View Onboarding Details</>}
                footer={<button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>}>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={UserRound} /> New Hire Information</h4>
                    <div className="info-grid">
                        <div className="info-item"><label>Employee ID</label><div className="info-value"><strong>{viewing?.eno}</strong></div></div>
                        <div className="info-item"><label>Full Name</label><div className="info-value">{viewing?.fname}</div></div>
                        <div className="info-item"><label>Contract</label><div className="info-value">{viewing ? contractOf(viewing) : ''}</div></div>
                        <div className="info-item"><label>Department</label><div className="info-value">{viewing?.dep}</div></div>
                        <div className="info-item"><label>Position</label><div className="info-value">{viewing?.pos}</div></div>
                        <div className="info-item"><label>Date Hired</label><div className="info-value">{viewing?.dh}</div></div>
                    </div>
                </div>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={ListChecks} /> Onboarding Progress</h4>
                    <div className="leave-bars" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {VIEW_CHECKLIST.map(item => (
                            <div className="leave-item hover-item" key={item.label}>
                                <div className="leave-label">
                                    <Icon as={item.done ? CircleCheck : Circle} style={{ color: item.done ? '#10b981' : '#9ca3af' }} /> {item.label}
                                </div>
                                <div className="progress-container">
                                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${item.width}%`, background: item.color }}></div></div>
                                    <span className="progress-text">{item.text}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            <Modal open={!!editing} onClose={() => setEditing(null)} size="lg" zIndex={9999} title={<><Icon as={Pencil} /> Edit Onboarding Record</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="btn btn-primary" id="onbSaveBtn" disabled={saving} onClick={() => void save()}><Icon as={Save} /> Save Changes</button>
                </>}>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={UserRound} /> New Hire Information</h4>
                    <div className="info-grid">
                        <div className="info-item"><label>Employee ID</label><input className="form-input locked-input" id="onbEdit_id" value={editing?.eno ?? ''} readOnly /><LockedTag /></div>
                        <div className="info-item"><label>Full Name</label><input className="form-input locked-input" id="onbEdit_name" value={form.name} readOnly /><LockedTag /></div>
                        <div className="info-item"><label>Contract</label>
                            <select className="form-input" id="onbEdit_contract" value={form.contract} onChange={e => setForm({ ...form, contract: e.target.value })}>
                                <option>Full-time</option><option>Part-time</option><option>Probationary</option><option>Contractual</option><option>Regular</option>
                            </select>
                        </div>
                        <div className="info-item"><label>Department</label>
                            <select className="form-input" id="onbEdit_dept" value={form.dept}
                                onChange={e => setForm({ ...form, dept: e.target.value, pos: positionAfterDepartmentChange(data?.departments ?? [], data?.positions ?? [], e.target.value, form.pos) })}>
                                <option value="">-- Select Department --</option>
                                <DepartmentOptions departments={data?.departments ?? []} value={form.dept} />
                            </select>
                        </div>
                        <div className="info-item"><label>Position</label>
                            <select className="form-input" id="onbEdit_pos" value={form.pos} onChange={e => setForm({ ...form, pos: e.target.value })}>
                                <option value="">{form.dept ? '-- Select Position --' : '-- Select a department first --'}</option>
                                <PositionOptions departments={data?.departments ?? []} positions={data?.positions ?? []} department={form.dept} value={form.pos} />
                            </select>
                        </div>
                        <div className="info-item"><label>Date Hired</label><input type="date" className={`form-input${editing?.dh ? ' locked-input' : ''}`} id="onbEdit_date" value={form.date} readOnly={!!editing?.dh} onChange={e => setForm({ ...form, date: e.target.value })} />{editing?.dh && <LockedTag />}</div>
                    </div>
                </div>
            </Modal>
        </Page>
    );
}
