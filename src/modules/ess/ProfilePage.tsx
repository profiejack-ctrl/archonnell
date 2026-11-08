import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, CalendarDays, Clock, FileText, IdCard, Mail, Medal, Pencil, Receipt, ShieldCheck, SquarePen, User, UserRound, type LucideIcon } from 'lucide-react';
import { InfoChangeRequestModal, InfoRequestsTable, LockedValue } from '../../components/LockedInfo';
import Icon from '../../components/Icon';
import { Badge, PageHeader, Page, PageState } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { useAuth } from '../../hooks/AuthContext';
import { employeeService } from '../../services/employeeService';
import { ArchonAlert, confirmDialog } from '../../utils/alerts';
import { phpFjY } from '../../utils/format';
import { STATUS_BADGE } from '../hcm/EmployeeDirectoryPage';

// `path`: opens that page (Leave / Attendance are connected); the others still show their placeholder message.
const QUICK_ACTIONS: { label: string; icon: LucideIcon; message: string; path?: string }[] = [
    { label: 'Request PTO', icon: Calendar, message: '', path: '/leave-management?view=mine' },
    { label: 'View Payslips', icon: FileText, message: 'Payslip archive viewer — connect to payroll module.' },
    { label: 'Benefits', icon: Medal, message: 'Benefits enrollment dashboard — connect to benefits provider.' },
    { label: 'Training', icon: BookOpen, message: 'Learning & Development tracker — connect to LMS.' },
    { label: 'Timesheet', icon: Clock, message: '', path: '/attendance-schedule?view=mine' },
    { label: 'Reimbursement', icon: Receipt, message: 'Expense reimbursement form — connect to finance module.' },
];

/** Profile (formerly ESS Portal) - Personal & Account Information. */
export default function ProfilePage() {
    const { session } = useAuth();
    const navigate = useNavigate();
    const { data, loading, error, retry, setData, reload } = usePageData(employeeService.profilePage);
    const balances = data?.leave_balances ?? [];
    const [requesting, setRequesting] = useState(false);

    // Withdraw one of my pending Information Change Requests.
    const cancelRequest = async (id: number, no: string) => {
        const ok = await confirmDialog({ title: 'Cancel Request', paragraphs: [`Cancel information change request ${no}?`], icon: 'warning', confirmText: 'Cancel Request', danger: true });
        if (!ok) return;
        try {
            const res = await employeeService.cancelInfoChange(id);
            await ArchonAlert.success(res.message, { timer: 1600 });
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The request could not be cancelled.');
        }
    };
    const [editing, setEditing] = useState(false);
    const [mobile, setMobile] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    if (!session) return null;
    const p = data?.profile ?? null;
    const u = session.user;
    const name = p?.full_name ?? u.full_name;
    const dept = p?.department ?? '';
    const pos = p?.position ?? '';
    const empStatus = p?.employment_status ?? '';
    const empNo = p?.employee_no ?? '';
    const workEmail = p?.work_email || (p?.account_email ?? u.email);

    const startEdit = () => {
        setMobile(p?.mobile_number ?? '');
        setEditing(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
    };

    const saveMobile = async () => {
        const val = mobile.trim();
        if (!/^[0-9+()\-\s]{7,20}$/.test(val)) {
            await ArchonAlert.error('Enter a valid contact number (7-20 chars: digits, + ( ) - and spaces).');
            return;
        }
        setSaving(true);
        try {
            const res = await employeeService.updateMyContact(val);
            setData(d => (d && d.profile ? { ...d, profile: { ...d.profile, mobile_number: res.mobile_number || val } } : d));
            setEditing(false);
            await ArchonAlert.success('Contact number updated.');
        } catch (err) {
            await ArchonAlert.error(err instanceof Error && err.message ? err.message : 'Could not update your contact number.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Page id="employee-self-service">
            <PageHeader title="Profile" subtitle="Personal employee dashboard and self-management tools" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <div className="profile-container">
                    <div className="profile-sidebar hover-card">
                        <div className="profile-avatar" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
                            <Icon as={UserRound} style={{ color: 'white' }} />
                        </div>
                        <h3 className="profile-name">{name}</h3>
                        <div className="profile-role">{u.role_name}</div>
                        <div className="profile-department">{dept !== '' ? dept + (pos !== '' ? ' · ' + pos : '') : u.email}</div>
                        {empStatus !== '' && (
                            <div style={{ marginTop: '0.5rem' }}>
                                <span className={`badge ${STATUS_BADGE[empStatus] ?? 'badge-info'}`} id="profileStatusBadge">{empStatus}</span>
                            </div>
                        )}
                        <div className="profile-stats">
                            <div className="profile-stat">
                                <div className="stat-num" style={{ color: '#10b981' }}>{p?.years_of_service ?? '—'}</div>
                                <div className="stat-label">Years of Service</div>
                            </div>
                            {empNo !== '' && (
                                <div className="profile-stat">
                                    <div className="stat-num" style={{ color: '#2563eb', fontSize: '0.95rem' }}>{empNo}</div>
                                    <div className="stat-label">Employee ID</div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="profile-content">
                        <div className="card hover-card" id="personalDetailsCard">
                            <div className="card-header">
                                <h3 className="card-title"><Icon as={IdCard} /> Personal &amp; Account Information</h3>
                            </div>
                            <div className="card-body">
                                {!p || empNo === '' ? (
                                    <p style={{ color: 'var(--text-secondary)' }}>Your account is not linked to an employee record. Please contact HR.</p>
                                ) : (
                                    <>
                                        <div className="locked-field-head" style={{ marginBottom: '0.75rem' }}>
                                            <div className="modal-section-title" style={{ margin: 0 }}><Icon as={User} /> Identity</div>
                                            <button type="button" className="btn btn-sm btn-outline" id="pfRequestChangeBtn" onClick={() => setRequesting(true)}><Icon as={SquarePen} /> Request Information Change</button>
                                        </div>
                                        <div className="modal-info-grid" id="pfIdentity">
                                            <div className="info-item"><div className="info-label">Full Name</div><div className="info-value"><LockedValue id="pfFullName">{p.full_name ?? u.full_name}</LockedValue></div></div>
                                            <div className="info-item"><div className="info-label">Employee ID</div><div className="info-value"><LockedValue id="pfEmployeeNo">{empNo}</LockedValue></div></div>
                                            <div className="info-item"><div className="info-label">First Name</div><div className="info-value"><LockedValue>{p.first_name || '—'}</LockedValue></div></div>
                                            <div className="info-item"><div className="info-label">Middle Name</div><div className="info-value"><LockedValue>{p.middle_name || '—'}</LockedValue></div></div>
                                            <div className="info-item"><div className="info-label">Last Name</div><div className="info-value"><LockedValue>{p.last_name || '—'}</LockedValue></div></div>
                                            <div className="info-item"><div className="info-label">Date of Birth</div><div className="info-value"><LockedValue id="pfDob">{p.date_of_birth ? phpFjY(p.date_of_birth) : '—'}</LockedValue></div></div>
                                            <div className="info-item"><div className="info-label">Gender</div><div className="info-value"><LockedValue>{p.gender || '—'}</LockedValue></div></div>
                                            <div className="info-item"><div className="info-label">Date Hired</div><div className="info-value"><LockedValue id="pfDateHired">{p.date_hired ? phpFjY(p.date_hired) : '—'}</LockedValue></div></div>
                                            <div className="info-item"><div className="info-label">Assigned Position</div><div className="info-value">{pos}</div></div>
                                            <div className="info-item"><div className="info-label">Department</div><div className="info-value">{dept}</div></div>
                                            <div className="info-item"><div className="info-label">Employment / Contract Status</div><div className="info-value">{p.contract_type || '—'}</div></div>
                                            {p.applicant_no && <>
                                                <div className="info-item"><div className="info-label">Date of Application</div><div className="info-value"><LockedValue>{p.applied_at ? phpFjY(p.applied_at) : '—'}</LockedValue></div></div>
                                                <div className="info-item"><div className="info-label">Position Applied For</div><div className="info-value"><LockedValue>{p.position_applied || '—'}</LockedValue></div></div>
                                            </>}
                                        </div>
                                        {(data?.info_requests?.length ?? 0) > 0 && (
                                            <>
                                                <div className="modal-section-title" style={{ margin: '1.25rem 0 0.75rem' }}><Icon as={SquarePen} /> My Information Change Requests</div>
                                                <div style={{ overflowX: 'auto' }}>
                                                    <InfoRequestsTable rows={data?.info_requests ?? []} showEmployee={false} id="pfInfoRequests" empty="No requests."
                                                        actions={r => r.status === 'Pending' && r.self_requested
                                                            ? <button className="btn btn-sm btn-outline btn-icr-cancel" onClick={() => void cancelRequest(r.id, r.request_no)}>Cancel</button>
                                                            : <span className="locked-muted">—</span>} />
                                                </div>
                                            </>
                                        )}
                                        <div className="modal-section-title" style={{ margin: '1.25rem 0 0.75rem' }}><Icon as={Mail} /> Contact Information</div>
                                        <div className="modal-info-grid">
                                            <div className="info-item">
                                                <div className="info-label">Employee Email Address</div>
                                                <div className="info-value">{workEmail}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">Contact Number</div>
                                                <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <span id="pfMobileText">{p.mobile_number ? p.mobile_number : <span style={{ color: 'var(--text-muted)' }}>Not set</span>}</span>
                                                    <button type="button" className="btn btn-sm btn-outline" id="pfMobileEditBtn" hidden={editing} onClick={startEdit}><Icon as={Pencil} /> Edit</button>
                                                </div>
                                                <div id="pfMobileEditRow" hidden={!editing} style={{ marginTop: '0.5rem', display: editing ? 'flex' : 'none', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <input type="text" className="form-input" id="pfMobileInput" ref={inputRef} style={{ maxWidth: 220 }} value={mobile}
                                                        onChange={e => setMobile(e.target.value)} placeholder="e.g., +63 917 123 4567" />
                                                    <button type="button" className="btn btn-sm btn-primary" id="pfMobileSaveBtn" disabled={saving} onClick={() => void saveMobile()}>Save</button>
                                                    <button type="button" className="btn btn-sm btn-outline" id="pfMobileCancelBtn" onClick={() => setEditing(false)}>Cancel</button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="modal-section-title" style={{ margin: '1.25rem 0 0.75rem' }}><Icon as={ShieldCheck} /> Account Status</div>
                                        <div className="modal-info-grid">
                                            <div className="info-item">
                                                <div className="info-label">Current Status</div>
                                                <div className="info-value"><Badge variant={STATUS_BADGE[empStatus] ?? 'badge-info'}>{empStatus}</Badge></div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="card hover-card">
                            <div className="card-header">
                                <h3 className="card-title">Leave Balance Summary</h3>
                                <button className="btn btn-sm btn-outline" onClick={() => navigate('/leave-management?view=mine')}>View History</button>
                            </div>
                            <div className="card-body">
                                <div className="leave-bars" id="profileLeaveBalances">
                                    {!balances.length ? (
                                        <div className="empty-state" style={{ padding: '1.5rem 1rem', minHeight: 0 }}>
                                            <Icon as={CalendarDays} style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }} />
                                            <p>No leave credits have been set for you this year. HR sets them in Leave Management.</p>
                                        </div>
                                    ) : balances.map(b => (
                                        <div key={b.id} style={{ marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                                <span style={{ fontWeight: 600 }}>{b.leave_type}</span>
                                                <span style={{ color: 'var(--text-secondary)' }}>{b.remaining} of {b.days} days left</span>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 9999, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${b.days > 0 ? Math.min(100, ((b.used + b.pending) / b.days) * 100) : 0}%`, background: 'var(--accent)' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="card hover-card">
                            <div className="card-header"><h3 className="card-title">Quick Actions</h3></div>
                            <div className="card-body">
                                <div className="quick-actions">
                                    {QUICK_ACTIONS.map(a => (
                                        <button className="action-btn hover-card" key={a.label} onClick={() => (a.path ? navigate(a.path) : void ArchonAlert.info(a.message, { title: a.label }))}>
                                            <Icon as={a.icon} />
                                            <span>{a.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {p && empNo !== '' && (
                <InfoChangeRequestModal open={requesting} onClose={() => setRequesting(false)} onDone={() => void reload()}
                    current={{ first_name: p.first_name, middle_name: p.middle_name, last_name: p.last_name, date_of_birth: p.date_of_birth, gender: p.gender, date_hired: p.date_hired }} />
            )}
        </Page>
    );
}
