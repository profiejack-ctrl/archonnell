import { useEffect, useState } from 'react';
import { Briefcase, CalendarCheck, Contact, Eye, History, Pencil, Save, SquarePen, UserRound } from 'lucide-react';
import { LockedTag } from '../../components/LockedInfo';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import { isoDateFromToday } from '../../utils/format';
import { DepartmentOptions, positionAfterDepartmentChange, PositionOptions } from '../../components/assignment';
import type { Department, Employee, Position } from '../../types';

/** The employee JSON the legacy tables embedded per row (index.php employee_json). */
export interface EmployeeView {
    dbId: number;
    employeeNo: string;
    name: string;
    position: string;
    department: string;
    status: string;
    email: string;
    phone: string;
    address: string;
    joinDate: string;
    dob: string;
    gender: string;
    contract: string;
    /** Recruitment history (hired through the careers portal). */
    applicationNo: string;
    appliedAt: string;
    jobPosting: string;
}

export function toEmployeeView(e: Employee): EmployeeView {
    return {
        dbId: e.id,
        employeeNo: e.employee_no,
        name: e.full_name,
        position: e.position,
        department: e.department,
        status: e.employment_status,
        email: e.email ?? '',
        phone: e.mobile_number ?? '',
        address: e.address ?? '',
        joinDate: e.date_hired ?? '',
        dob: e.date_of_birth ?? '',
        gender: e.gender ?? '',
        contract: e.contract_type ?? 'Full-time',
        applicationNo: e.application_no ?? '',
        appliedAt: e.applied_at ? e.applied_at.slice(0, 10) : '',
        jobPosting: [e.job_posting_no, e.job_posting_title].filter(Boolean).join(' · '),
    };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="info-item"><label>{label}</label>{children}</div>;
}

export function ViewEmployeeModal({ employee, onClose, onRequestChange }: { employee: EmployeeView | null; onClose: () => void; onRequestChange?: (e: EmployeeView) => void }) {
    const [shown, setShown] = useState<EmployeeView | null>(null);
    useEffect(() => { if (employee) setShown(employee); }, [employee]);
    const d = employee ?? shown;
    const v = (x: string | undefined) => x || '-';
    return (
        <Modal open={!!employee} onClose={onClose} size="lg" title={<><Icon as={Eye} /> View Employee Information</>}
            footer={<>
                <button className="btn btn-outline" onClick={onClose}>Close</button>
                {onRequestChange && d && <button className="btn btn-outline" id="viewEmpRequestChange" onClick={() => onRequestChange(d)}><Icon as={SquarePen} /> Request Information Change</button>}
            </>}>
            <div className="modal-section">
                <h4 className="modal-section-title"><Icon as={UserRound} /> Personal Information</h4>
                <div className="info-grid">
                    <Field label="Full Name"><div className="info-value"><span id="viewEmpName">{v(d?.name)}</span> <LockedTag /></div></Field>
                    <Field label="Date of Birth"><div className="info-value"><span id="viewEmpDob">{v(d?.dob)}</span> {d?.dob && <LockedTag />}</div></Field>
                    <Field label="Gender"><div className="info-value"><span id="viewEmpGender">{v(d?.gender)}</span> {d?.gender && <LockedTag />}</div></Field>
                    <Field label="Home Address"><div className="info-value" id="viewEmpAddress">{v(d?.address)}</div></Field>
                </div>
            </div>
            <div className="modal-section">
                <h4 className="modal-section-title"><Icon as={Briefcase} /> Employment Information</h4>
                <div className="info-grid">
                    <Field label="Employee ID"><div className="info-value"><strong id="viewEmpId">{v(d?.employeeNo)}</strong> <LockedTag /></div></Field>
                    <Field label="Position"><div className="info-value" id="viewEmpPosition">{v(d?.position)}</div></Field>
                    <Field label="Department"><div className="info-value" id="viewEmpDept">{v(d?.department)}</div></Field>
                    <Field label="Employment Contract"><div className="info-value" id="viewEmpContract">{v(d?.contract)}</div></Field>
                    <Field label="Status">
                        <div className="info-value" id="viewEmpStatus">
                            <span className={`badge ${d?.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>{v(d?.status)}</span>
                        </div>
                    </Field>
                </div>
            </div>
            <div className="modal-section">
                <h4 className="modal-section-title"><Icon as={Contact} /> Contacts</h4>
                <div className="info-grid">
                    <Field label="Email Address"><div className="info-value" id="viewEmpEmail">{v(d?.email)}</div></Field>
                    <Field label="Phone Number"><div className="info-value" id="viewEmpPhone">{v(d?.phone)}</div></Field>
                </div>
            </div>
            <div className="modal-section">
                <h4 className="modal-section-title"><Icon as={CalendarCheck} /> Join Date</h4>
                <div className="info-grid">
                    <Field label="Date Hired"><div className="info-value"><strong id="viewEmpJoinDate">{v(d?.joinDate)}</strong> {d?.joinDate && <LockedTag />}</div></Field>
                </div>
            </div>
            {(d?.applicationNo || d?.jobPosting) && (
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={History} /> Recruitment History</h4>
                    <div className="info-grid">
                        <Field label="Job Posting"><div className="info-value" id="viewEmpJobPosting">{v(d?.jobPosting)}</div></Field>
                        <Field label="Application ID"><div className="info-value" id="viewEmpApplicationNo">{v(d?.applicationNo)}</div></Field>
                        <Field label="Date Applied"><div className="info-value" id="viewEmpAppliedAt">{v(d?.appliedAt)}</div></Field>
                    </div>
                </div>
            )}
        </Modal>
    );
}

export interface EmployeeForm {
    name: string; dob: string; gender: string; address: string; position: string; department: string;
    contract: string; status: string; email: string; phone: string; joinDate: string;
}

export function UpdateEmployeeModal({ employee, departments, positions, onClose, onSave, saving }: {
    employee: EmployeeView | null;
    departments: Department[];
    positions: Position[];
    onClose: () => void;
    onSave: (form: EmployeeForm) => void;
    saving: boolean;
}) {
    const [f, setF] = useState<EmployeeForm>({ name: '', dob: '', gender: '', address: '', position: '', department: '', contract: 'Full-time', status: 'Active', email: '', phone: '', joinDate: '' });
    useEffect(() => {
        if (!employee) return;
        setF({
            name: employee.name || '', dob: employee.dob || '', gender: employee.gender || '', address: employee.address || '',
            position: employee.position || '', department: employee.department || '', contract: employee.contract || 'Full-time',
            status: employee.status || 'Active', email: employee.email || '', phone: employee.phone || '', joinDate: employee.joinDate || '',
        });
    }, [employee]);
    const set = (k: keyof EmployeeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
    // Verified information stays as recorded (an empty value may still be filled in once).
    const lockedDob = !!employee?.dob;
    const lockedGender = !!employee?.gender;
    const lockedHired = !!employee?.joinDate;

    return (
        <Modal open={!!employee} onClose={onClose} size="lg" title={<><Icon as={Pencil} /> Update Employee Information</>}
            footer={<>
                <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" id="saveEmployeeChanges" disabled={saving} onClick={() => onSave(f)}><Icon as={Save} /> Save Changes</button>
            </>}>
            <form id="updateEmployeeForm" onSubmit={e => e.preventDefault()}>
                <p className="locked-note">The name, date of birth, gender, Employee ID and date hired are verified information and cannot be edited here. Corrections go through an Information Change Request (View &gt; Request Information Change).</p>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={UserRound} /> Personal Information</h4>
                    <div className="info-grid">
                        <Field label="Full Name"><input type="text" className="form-input locked-input" id="updEmpName" value={f.name} readOnly /><LockedTag /></Field>
                        <Field label="Date of Birth"><input type="date" className={`form-input${lockedDob ? ' locked-input' : ''}`} id="updEmpDob" max={isoDateFromToday()} value={f.dob} readOnly={lockedDob} onChange={set('dob')} />{lockedDob && <LockedTag />}</Field>
                        <Field label="Gender">
                            <select className={`form-input${lockedGender ? ' locked-input' : ''}`} id="updEmpGender" value={f.gender} disabled={lockedGender} onChange={set('gender')}>
                                <option value="">-- Select Gender --</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>{lockedGender && <LockedTag />}
                        </Field>
                        <Field label="Home Address"><input type="text" className="form-input" id="updEmpAddress" value={f.address} onChange={set('address')} /></Field>
                    </div>
                </div>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={Briefcase} /> Employment Information</h4>
                    <div className="info-grid">
                        <Field label="Employee ID"><input type="text" className="form-input locked-input" id="updEmpId" value={employee?.employeeNo ?? ''} readOnly /><LockedTag /></Field>
                        <Field label="Department">
                            <select className="form-input" id="updEmpDept" value={f.department}
                                onChange={e => setF({ ...f, department: e.target.value, position: positionAfterDepartmentChange(departments, positions, e.target.value, f.position) })}>
                                <option value="">-- Select Department --</option>
                                <DepartmentOptions departments={departments} value={f.department} />
                            </select>
                        </Field>
                        <Field label="Position">
                            <select className="form-input" id="updEmpPosition" value={f.position} onChange={set('position')}>
                                <option value="">{f.department ? '-- Select Position --' : '-- Select a department first --'}</option>
                                <PositionOptions departments={departments} positions={positions} department={f.department} value={f.position} />
                            </select>
                        </Field>
                        <Field label="Employment Contract">
                            <select className="form-input" id="updEmpContract" value={f.contract} onChange={set('contract')}>
                                <option value="Full-time">Full-time</option>
                                <option value="Part-time">Part-time</option>
                                <option value="Probationary">Probationary</option>
                                <option value="Contractual">Contractual</option>
                            </select>
                        </Field>
                        <Field label="Status">
                            <select className="form-input" id="updEmpStatus" value={f.status} onChange={set('status')}>
                                <option value="Active">Active</option>
                                <option value="On Leave">On Leave</option>
                                <option value="Suspended">Suspended</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </Field>
                    </div>
                </div>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={Contact} /> Contacts</h4>
                    <div className="info-grid">
                        <Field label="Email Address"><input type="email" className="form-input" id="updEmpEmail" value={f.email} onChange={set('email')} /></Field>
                        <Field label="Phone Number"><input type="tel" className="form-input" id="updEmpPhone" value={f.phone} onChange={set('phone')} /></Field>
                    </div>
                </div>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={CalendarCheck} /> Join Date</h4>
                    <div className="info-grid">
                        <Field label="Date Hired"><input type="date" className={`form-input${lockedHired ? ' locked-input' : ''}`} id="updEmpJoinDate" value={f.joinDate} readOnly={lockedHired} onChange={set('joinDate')} />{lockedHired && <LockedTag />}</Field>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
