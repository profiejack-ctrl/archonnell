import { useEffect, useState } from 'react';
import { Banknote, Briefcase, CalendarDays, ClipboardCheck, Eye, FilePen, FileText, Save, Send } from 'lucide-react';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import { assignmentError, DepartmentOptions, positionAfterDepartmentChange, PositionOptions } from '../../components/assignment';
import { jobPostingService, type JobPostingForm, type JobPostingsPage, type SaveIntent } from '../../services/jobPostingService';
import { ArchonAlert, confirmDialog } from '../../utils/alerts';
import { isoDateFromToday } from '../../utils/format';
import type { JobPosting, VacancyRequest } from '../../types';
import type { JobPostingPublic } from '../../types/portal';

const EMPTY: JobPostingForm = {
    title: '', department: '', position: '', employment_type: '', work_setup: '', location: '', vacancies: '1',
    description: '', responsibilities: '', qualifications: '', experience_required: '', required_skills: '',
    preferred_skills: '', salary_min: '', salary_max: '', benefits: '', opening_date: '', deadline: '',
};

/** The fields a posting needs before it can be published (the server checks the same). */
const REQUIRED_TO_PUBLISH: [keyof JobPostingForm, string][] = [
    ['title', 'Job Title'], ['department', 'Department'], ['position', 'Position'], ['employment_type', 'Employment Type'],
    ['work_setup', 'Work Setup'], ['location', 'Location'], ['vacancies', 'Number of Vacancies'],
    ['description', 'Job Description'], ['responsibilities', 'Job Responsibilities'], ['qualifications', 'Qualifications'],
    ['required_skills', 'Required Skills'], ['opening_date', 'Application Opening Date'], ['deadline', 'Application Deadline'],
];

export function missingForPublish(f: JobPostingForm): string[] {
    const missing = REQUIRED_TO_PUBLISH.filter(([k]) => !String(f[k] ?? '').trim()).map(([, label]) => label);
    if (f.deadline && f.deadline < isoDateFromToday()) missing.push('an Application Deadline that has not passed');
    return missing;
}

export function toForm(p: JobPosting): JobPostingForm {
    return {
        title: p.title, department: p.department, position: p.position, employment_type: p.employment_type,
        work_setup: p.work_setup, location: p.location, vacancies: p.vacancies ? String(p.vacancies) : '',
        description: p.description, responsibilities: p.responsibilities, qualifications: p.qualifications,
        experience_required: p.experience_required, required_skills: p.required_skills, preferred_skills: p.preferred_skills,
        salary_min: p.salary_min ?? '', salary_max: p.salary_max ?? '', benefits: p.benefits,
        opening_date: p.opening_date ?? '', deadline: p.deadline ?? '',
    };
}

const req = <span style={{ color: 'var(--danger)' }}>*</span>;
const hint = { fontSize: '0.75rem', color: 'var(--text-muted)' } as const;

interface Props {
    open: boolean;
    editing: JobPosting | null;
    lookups: JobPostingsPage | null;
    onClose: () => void;
    onSaved: (message: string) => void;
    onPreview: (preview: JobPostingPublic) => void;
    /** Creating: the approved vacancy request the posting is made from (pre-fills and locks department / position). */
    fromRequest?: VacancyRequest | null;
}

/** Create / Edit Job Posting. A Draft can be saved incomplete; publishing needs every required field. */
export default function JobPostingFormModal({ open, editing, lookups, onClose, onSaved, onPreview, fromRequest = null }: Props) {
    const [f, setF] = useState<JobPostingForm>(EMPTY);
    const [status, setStatus] = useState<'Draft' | 'Published'>('Draft');
    const [saving, setSaving] = useState(false);
    const departments = lookups?.departments ?? [];
    const positions = lookups?.positions ?? [];
    const isPublished = editing?.status === 'Published';
    // A draft made before vacancy requests existed must be linked to an approved request before it can be published.
    const [linkId, setLinkId] = useState('');
    const canLink = !!editing && !editing.vacancy_request_id && editing.status === 'Draft';
    const linked = canLink ? (lookups?.approved_requests ?? []).find(r => String(r.id) === linkId) ?? null : null;
    // The approved vacancy request behind this posting: its department / position cannot be changed.
    const source = editing ? linked : fromRequest;
    const request = editing?.vacancy_request_id
        ? { no: editing.vacancy_request_no ?? '', vacancies: editing.approved_vacancies ?? 0 }
        : (source ? { no: source.request_no, vacancies: source.vacancies - source.filled } : null);

    const onLink = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setLinkId(e.target.value);
        const r = (lookups?.approved_requests ?? []).find(x => String(x.id) === e.target.value);
        if (r) {
            const room = r.vacancies - r.filled;
            setF(prev => ({ ...prev, department: r.department, position: r.position,
                vacancies: !prev.vacancies || +prev.vacancies > room ? String(room) : prev.vacancies }));
        }
    };

    useEffect(() => {
        if (!open) return;
        const base = { ...EMPTY, location: lookups?.default_location ?? '', opening_date: isoDateFromToday() };
        setF(editing ? toForm(editing) : fromRequest ? {
            ...base,
            title: fromRequest.position, department: fromRequest.department, position: fromRequest.position,
            employment_type: (lookups?.employment_types ?? []).includes(fromRequest.employment_type) ? fromRequest.employment_type : '',
            vacancies: String(fromRequest.vacancies - fromRequest.filled),
            required_skills: fromRequest.required_skills, qualifications: fromRequest.qualifications,
        } : base);
        setStatus(isPublished ? 'Published' : 'Draft');
        setLinkId('');
    }, [open, editing, isPublished, lookups, fromRequest]);

    const set = (k: keyof JobPostingForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setF(prev => ({ ...prev, [k]: e.target.value }));

    const onDepartment = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const department = e.target.value;
        setF(prev => ({ ...prev, department, position: positionAfterDepartmentChange(departments, positions, department, prev.position) }));
    };

    const preview = async () => {
        try {
            const res = await jobPostingService.preview(f, editing?.posting_no ?? '');
            onPreview(res.preview);
        } catch (err) {
            await ArchonAlert.error('Could not build the preview: ' + (err instanceof Error ? err.message : ''));
        }
    };

    const submit = async () => {
        if (!f.title.trim()) {
            await ArchonAlert.warning('Job Title is required.', { title: 'Missing Information' });
            return;
        }
        const intent: SaveIntent = isPublished ? 'save' : (status === 'Published' ? 'publish' : 'draft');
        if (request && +f.vacancies > request.vacancies) {
            await ArchonAlert.warning(`Number of Vacancies cannot be more than the ${request.vacancies} approved in vacancy request ${request.no}.`, { title: 'Too Many Vacancies' });
            return;
        }
        if (f.department && f.position) {
            const invalid = assignmentError(departments, positions, f.department, f.position);
            if (invalid) {
                await ArchonAlert.warning(invalid, { title: 'Invalid Department / Position' });
                return;
            }
        }
        if (intent !== 'draft') {
            const missing = missingForPublish(f);
            if (missing.length) {
                await ArchonAlert.warning(`Please complete: ${missing.join(', ')}.`, { title: intent === 'publish' ? 'Not Ready to Publish' : 'Missing Information' });
                return;
            }
        }
        if (intent === 'publish') {
            const ok = await confirmDialog({
                title: 'Confirm Publish',
                paragraphs: ['Publish this job posting? It will appear on the careers page and applicants can apply to it until the application deadline.'],
                icon: 'question', confirmText: 'Publish',
            });
            if (!ok) return;
        }
        setSaving(true);
        try {
            const res = await jobPostingService.save(editing?.id ?? 0, f, intent, (editing ? linked?.id : fromRequest?.id) ?? null);
            onSaved(res.message);
        } catch (err) {
            await ArchonAlert.error(err instanceof Error && err.message ? err.message : 'Could not save the job posting.');
        } finally {
            setSaving(false);
        }
    };

    const saveLabel = isPublished ? <><Icon as={Save} /> Save Changes</>
        : status === 'Published' ? <><Icon as={Send} /> Save &amp; Publish</> : <><Icon as={FilePen} /> Save as Draft</>;

    return (
        <Modal open={open} onClose={onClose} size="lg"
            title={<><Icon as={Briefcase} /> {editing ? `Edit Job Posting · ${editing.posting_no}` : 'Create Job Posting'}</>}
            footer={<>
                <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button type="button" className="btn btn-outline" id="jpBtnFormPreview" onClick={() => void preview()}><Icon as={Eye} /> Preview</button>
                <button type="button" className="btn btn-primary" id="jpBtnSave" disabled={saving} onClick={() => void submit()}>{saveLabel}</button>
            </>}>
            <form id="jobPostingForm" onSubmit={e => e.preventDefault()}>
                {canLink && (
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label htmlFor="jpLinkRequest">Approved Vacancy Request</label>
                        <select className="form-input" id="jpLinkRequest" value={linkId} onChange={onLink}>
                            <option value="">{(lookups?.approved_requests ?? []).length ? 'Select the approved request this posting fills…' : 'No approved vacancy requests are waiting'}</option>
                            {(lookups?.approved_requests ?? []).map(r => (
                                <option key={r.id} value={r.id}>{`${r.request_no} · ${r.position} · ${r.department} · ${r.vacancies - r.filled} vacancies`}</option>
                            ))}
                        </select>
                        <span style={hint}>This draft was created before vacancy requests. It can be saved as a draft, but it needs an approved request before it can be published.</span>
                    </div>
                )}
                {request && (
                    <div id="jpFromRequest" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <Icon as={ClipboardCheck} style={{ color: 'var(--success)' }} />
                        <span>From approved vacancy request <strong>{request.no}</strong> &mdash; the department and position come from the request; up to {request.vacancies} {request.vacancies === 1 ? 'vacancy' : 'vacancies'}.</span>
                    </div>
                )}
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={Briefcase} /> Job Information</h4>
                    <div className="modal-form-grid">
                        <div className="form-group full-width">
                            <label htmlFor="jpTitle">Job Title {req}</label>
                            <input type="text" className="form-input" id="jpTitle" maxLength={150} placeholder="e.g., Sales Representative" value={f.title} onChange={set('title')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpDepartment">Department {req}</label>
                            <select className="form-input" id="jpDepartment" value={f.department} onChange={onDepartment} disabled={!!request}>
                                <option value="">Select department&hellip;</option>
                                <DepartmentOptions departments={departments} value={f.department} />
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpPosition">Position {req}</label>
                            <select className="form-input" id="jpPosition" value={f.position} onChange={set('position')} disabled={!f.department || !!request}>
                                <option value="">{f.department ? 'Select position…' : 'Select a department first'}</option>
                                <PositionOptions departments={departments} positions={positions} department={f.department} value={f.position} />
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpEmploymentType">Employment Type {req}</label>
                            <select className="form-input" id="jpEmploymentType" value={f.employment_type} onChange={set('employment_type')}>
                                <option value="">Select employment type&hellip;</option>
                                {(lookups?.employment_types ?? []).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpWorkSetup">Work Setup {req}</label>
                            <select className="form-input" id="jpWorkSetup" value={f.work_setup} onChange={set('work_setup')}>
                                <option value="">Select work setup&hellip;</option>
                                {(lookups?.work_setups ?? []).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpLocation">Location {req}</label>
                            <input type="text" className="form-input" id="jpLocation" maxLength={255} value={f.location} onChange={set('location')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpVacancies">Number of Vacancies {req}</label>
                            <input type="number" className="form-input" id="jpVacancies" min={1} max={request ? request.vacancies : 999} step={1} value={f.vacancies} onChange={set('vacancies')} />
                        </div>
                    </div>
                </div>

                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={FileText} /> Job Description</h4>
                    <div className="modal-form-grid">
                        <div className="form-group full-width">
                            <label htmlFor="jpDescription">Job Description {req}</label>
                            <textarea className="form-input" id="jpDescription" style={{ minHeight: 100, resize: 'vertical' }}
                                placeholder="What the role is about" value={f.description} onChange={set('description')} />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="jpResponsibilities">Job Responsibilities {req}</label>
                            <textarea className="form-input" id="jpResponsibilities" style={{ minHeight: 100, resize: 'vertical' }}
                                placeholder="One responsibility per line" value={f.responsibilities} onChange={set('responsibilities')} />
                            <span style={hint}>One per line; each line becomes a bullet on the job page.</span>
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="jpQualifications">Qualifications {req}</label>
                            <textarea className="form-input" id="jpQualifications" style={{ minHeight: 90, resize: 'vertical' }}
                                placeholder={"e.g., Bachelor's degree in Business Administration or related field"} value={f.qualifications} onChange={set('qualifications')} />
                            <span style={hint}>One per line. Degree, diploma and licence lines are also used by AI screening as education requirements.</span>
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="jpExperience">Experience Requirement</label>
                            <input type="text" className="form-input" id="jpExperience" maxLength={255} placeholder="e.g., 2+ years of experience in sales"
                                value={f.experience_required} onChange={set('experience_required')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpRequiredSkills">Required Skills {req}</label>
                            <textarea className="form-input" id="jpRequiredSkills" style={{ minHeight: 70, resize: 'vertical' }}
                                placeholder="Comma-separated, e.g., Negotiation, Customer Service" value={f.required_skills} onChange={set('required_skills')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpPreferredSkills">Preferred Skills</label>
                            <textarea className="form-input" id="jpPreferredSkills" style={{ minHeight: 70, resize: 'vertical' }}
                                placeholder="Comma-separated" value={f.preferred_skills} onChange={set('preferred_skills')} />
                        </div>
                    </div>
                </div>

                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={Banknote} /> Salary &amp; Benefits</h4>
                    <div className="modal-form-grid">
                        <div className="form-group">
                            <label htmlFor="jpSalaryMin">Salary Range (monthly, from)</label>
                            <input type="number" className="form-input" id="jpSalaryMin" min={0} step={500} placeholder="e.g., 20000" value={f.salary_min} onChange={set('salary_min')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpSalaryMax">Salary Range (monthly, to)</label>
                            <input type="number" className="form-input" id="jpSalaryMax" min={0} step={500} placeholder="e.g., 25000" value={f.salary_max} onChange={set('salary_max')} />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="jpBenefits">Benefits</label>
                            <textarea className="form-input" id="jpBenefits" style={{ minHeight: 70, resize: 'vertical' }}
                                placeholder="One per line, e.g., HMO coverage" value={f.benefits} onChange={set('benefits')} />
                        </div>
                    </div>
                </div>

                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={CalendarDays} /> Application Information</h4>
                    <div className="modal-form-grid">
                        <div className="form-group">
                            <label htmlFor="jpOpening">Application Opening Date {req}</label>
                            <input type="date" className="form-input" id="jpOpening" value={f.opening_date} onChange={set('opening_date')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpDeadline">Application Deadline {req}</label>
                            <input type="date" className="form-input" id="jpDeadline" min={f.opening_date || undefined} value={f.deadline} onChange={set('deadline')} />
                            <span style={hint}>Applications close automatically after this date.</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="jpStatus">Job Posting Status</label>
                            <select className="form-input" id="jpStatus" value={status} disabled={isPublished}
                                onChange={e => setStatus(e.target.value as 'Draft' | 'Published')}>
                                <option value="Draft">Draft (not visible to applicants)</option>
                                <option value="Published">Published (visible; applicants can apply)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
