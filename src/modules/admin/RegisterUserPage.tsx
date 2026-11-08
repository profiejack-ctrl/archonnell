import { useState, type FormEvent } from 'react';
import { Info, UserPlus } from 'lucide-react';
import Icon from '../../components/Icon';
import { assignmentError, DepartmentOptions, positionAfterDepartmentChange, PositionOptions } from '../../components/assignment';
import { Page, PageHeader, PageState } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { userService } from '../../services/userService';
import { ArchonAlert, esc } from '../../utils/alerts';
import { LockedTag } from '../../components/LockedInfo';

const EMPTY = { employee: '', first: '', last: '', middle: '', empNo: '', email: '', mobile: '', dept: '', pos: '', role: '', nameLocked: false };

/** First / middle / last from a full name (for employees recorded with the full name only). */
function splitName(full: string): [string, string, string] {
    const p = full.trim().split(/\s+/).filter(Boolean);
    if (p.length < 2) return [p[0] ?? '', '', ''];
    return [p[0], p.slice(1, -1).join(' '), p[p.length - 1]];
}

/** User Management > Register New System User. */
export default function RegisterUserPage() {
    const { data, loading, error, retry, reload } = usePageData(userService.registerPage);
    const [f, setF] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    const set = (k: Exclude<keyof typeof EMPTY, 'nameLocked'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

    const pickEmployee = (id: string) => {
        const emp = data?.employees.find(e => String(e.id) === id);
        if (!emp) { setF({ ...f, employee: '', empNo: '' }); return; }
        // Employee ID was generated at hiring - just retrieve it, never regenerate. Username IS the Employee ID.
        // A recorded name is verified and locked: shown read-only (only an Information Change Request changes it).
        const nameLocked = !!(emp.full_name || '').trim();
        const [sFirst, sMiddle, sLast] = splitName(emp.full_name || '');
        setF({
            ...f,
            employee: id,
            empNo: emp.employee_no || '',
            nameLocked,
            first: emp.first_name || (nameLocked ? sFirst : ''),
            last: emp.last_name || (nameLocked ? sLast : ''),
            middle: emp.middle_name || (nameLocked ? sMiddle : ''),
            email: emp.email || '',
            mobile: emp.mobile_number || '',
            dept: emp.department || f.dept,
            pos: emp.position || f.pos,
        });
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!f.employee) { await ArchonAlert.warning('Please select the hired employee this account is for.', { title: 'Missing Information' }); return; }
        const emp = data?.employees.find(x => String(x.id) === f.employee);
        const invalid = assignmentError(data?.departments ?? [], data?.positions ?? [], f.dept, f.pos,
            { department: emp?.department || '', position: emp?.position || '' });
        if (invalid) { await ArchonAlert.warning(invalid, { title: 'Invalid Department / Position' }); return; }
        setBusy(true);
        try {
            const res = await userService.register({
                employee_id: f.employee, first_name: f.first.trim(), last_name: f.last.trim(), middle_name: f.middle.trim(),
                email: f.email.trim(), mobile_number: f.mobile.trim(), department: f.dept, position: f.pos, role_id: f.role,
            });
            const emailLine = res.email_sent
                ? `<div style="margin-top:0.35rem;">Credentials emailed to <strong>${esc(f.email.trim())}</strong>.</div>`
                : `<div style="margin-top:0.35rem;color:#b45309;">Account created, but the credentials email could not be sent${res.email_error ? ': ' + esc(res.email_error) : ''}.</div>`;
            const html = `Account created for Employee ID <strong>${esc(res.employee_no)}</strong>.<br>`
                + `Username: <strong>${esc(res.username)}</strong><br>`
                + `Default password: <strong>${esc(res.default_password || '')}</strong>${emailLine}`;
            setF(EMPTY);
            await ArchonAlert.success('', { title: 'Account Created', html });
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : '', { title: 'Account Not Created' });
        } finally {
            setBusy(false);
        }
    };

    const ro = { background: 'var(--bg-secondary)' };
    const req = <span style={{ color: 'var(--danger)' }}>*</span>;

    return (
        <Page id="register-system-user">
            <PageHeader title="Register New System User" subtitle="Create a system account for an employee and link it to their record" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <form id="registerSystemUserForm" onSubmit={e => void submit(e)}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: '1.5rem', alignItems: 'start' }}>
                        <div className="card hover-card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Personal &amp; Contact Information</h3>
                                    <p className="card-subtitle">Employee ID is generated automatically at hiring and cannot be edited</p>
                                </div>
                            </div>
                            <div className="card-body">
                                <div className="form-group">
                                    <label>Hired Employee (source of Employee ID)</label>
                                    <select className="form-input" id="rsuEmployee" required value={f.employee} onChange={e => pickEmployee(e.target.value)}>
                                        <option value="">Select a hired employee...</option>
                                        {data.employees.map(he => <option value={he.id} key={he.id}>{`${he.employee_no} — ${he.full_name}`}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group"><label>First Name {req}</label><input type="text" className="form-input" id="rsuFirstName" required readOnly={f.nameLocked} style={f.nameLocked ? ro : undefined} value={f.first} onChange={set('first')} />{f.nameLocked && <LockedTag />}</div>
                                    <div className="form-group"><label>Last Name {req}</label><input type="text" className="form-input" id="rsuLastName" required readOnly={f.nameLocked} style={f.nameLocked ? ro : undefined} value={f.last} onChange={set('last')} />{f.nameLocked && <LockedTag />}</div>
                                    <div className="form-group"><label>Middle Name</label><input type="text" className="form-input" id="rsuMiddleName" readOnly={f.nameLocked} style={f.nameLocked ? ro : undefined} value={f.middle} onChange={set('middle')} />{f.nameLocked && <LockedTag />}</div>
                                    <div className="form-group"><label>Employee ID</label><input type="text" className="form-input" id="rsuEmployeeId" readOnly placeholder="Retrieved from the hired employee" style={ro} value={f.empNo} /></div>
                                    <div className="form-group"><label>Username</label><input type="text" className="form-input" id="rsuUsername" readOnly placeholder="Same as Employee ID" style={ro} value={f.empNo} /></div>
                                    <div className="form-group"><label>Professional Email {req}</label><input type="email" className="form-input" id="rsuEmail" required value={f.email} onChange={set('email')} /></div>
                                    <div className="form-group"><label>Mobile Contact Number {req}</label><input type="tel" className="form-input" id="rsuMobile" required placeholder="e.g. 09XX XXX XXXX" value={f.mobile} onChange={set('mobile')} /></div>
                                </div>
                                <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <Icon as={Info} /> The username is the Employee ID. A default password is generated automatically
                                    (first two letters of the last name + hiring month + year) and emailed to the professional email address.
                                </p>
                            </div>
                        </div>
                        <div className="card hover-card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Assignment &amp; Role Settings</h3>
                                    <p className="card-subtitle">Department, designation and access level</p>
                                </div>
                            </div>
                            <div className="card-body">
                                <div className="form-group">
                                    <label>Assign Department</label>
                                    <select className="form-input" id="rsuDepartment" value={f.dept}
                                        onChange={e => setF({ ...f, dept: e.target.value, pos: positionAfterDepartmentChange(data.departments, data.positions, e.target.value, f.pos) })}>
                                        <option value="">Select department...</option>
                                        <DepartmentOptions departments={data.departments} value={f.dept} />
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Assign Designation / Position</label>
                                    <select className="form-input" id="rsuPosition" value={f.pos} onChange={set('pos')}>
                                        <option value="">{f.dept ? 'Select designation...' : 'Select a department first...'}</option>
                                        <PositionOptions departments={data.departments} positions={data.positions} department={f.dept} value={f.pos} />
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>System Access Role {req}</label>
                                    <select className="form-input" id="rsuRole" required value={f.role} onChange={set('role')}>
                                        <option value="">Select access role...</option>
                                        {data.roles.map(r => <option value={r.id} key={r.id}>{r.role_name}</option>)}
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-primary" id="btnRegisterSystemUser" style={{ width: '100%', marginTop: '0.5rem' }} disabled={busy}>
                                    <Icon as={UserPlus} /> Create System Account
                                </button>
                                <div id="rsuResult" style={{ marginTop: '1rem' }}></div>
                            </div>
                        </div>
                    </div>
                </form>
            )}
        </Page>
    );
}
