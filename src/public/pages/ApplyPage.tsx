import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FocusEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CloudUpload, Paperclip } from 'lucide-react';
import { ApplicantPage } from '../layouts/SiteLayouts';
import { showToast, usePageMeta } from '../hooks';
import { getPortalCsrfToken, portalService } from '../../services/portalService';
import { isoDateFromToday, phpFjY } from '../../utils/format';
import { CITY_OPTIONS, PROVINCE_OPTIONS } from '../../utils/locations';
import type { ApplyJob } from '../../types/portal';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const REQUIRED_LABELS: Record<string, string> = {
    first_name: 'First Name', last_name: 'Last Name', date_of_birth: 'Date of Birth',
    gender: 'Gender', email: 'Email Address', mobile_number: 'Mobile Number',
    address: 'Address', city: 'City/Municipality', province: 'Province',
    highest_attainment: 'Highest Educational Attainment', school: 'School/University',
    course: 'Course/Degree', year_graduated: 'Year Graduated',
    years_experience: 'Years of Work Experience', current_position: 'Current/Previous Position',
    previous_company: 'Previous Company/Employer', skills: 'Skills',
    professional_summary: 'Professional Summary',
};

const ALLOWED_EXTS = ['pdf', 'doc', 'docx'];
const ALLOWED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_SIZE = 5 * 1024 * 1024;

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/** The same client-side checks as the former js/applicant.js (the server validates again). */
function fieldError(input: Field): string {
    const name = input.name || input.id;
    const value = input.value.trim();
    const type = input instanceof HTMLInputElement ? input.type : input.tagName.toLowerCase();

    if (input.required && !value) return (REQUIRED_LABELS[name] || name.replace(/_/g, ' ')) + ' is required.';
    if (value && name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.';
    if (value && type === 'tel' && !/^[+]?[\d\s\-()]{7,20}$/.test(value)) return 'Please enter a valid phone number.';
    if (value && type === 'date' && name === 'date_of_birth') {
        const dob = new Date(value);
        const now = new Date();
        // Compared as calendar dates: today is allowed, any later date is not.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > isoDateFromToday()) return 'Date of birth cannot be in the future.';
        if ((now.getFullYear() - dob.getFullYear()) < 15) return 'You must be at least 15 years old.';
        if ((now.getFullYear() - dob.getFullYear()) > 100) return 'Please enter a valid date of birth.';
    }
    if (value && name === 'city' && !CITY_OPTIONS.includes(value)) return 'Please select a valid City/Municipality.';
    if (value && name === 'province' && !PROVINCE_OPTIONS.includes(value)) return 'Please select a valid Province.';
    if (value && name === 'years_experience') {
        const n = parseFloat(value);
        if (Number.isNaN(n) || n < 0 || n > 60) return 'Years of experience must be between 0 and 60.';
    }
    return '';
}

/** Step 1 - Job Application: applicant details + resume upload (Homepage/applicant/apply.php). */
export default function ApplyPage() {
    usePageMeta('Job Application', 'Archon Nell Incorporated - Career Application Portal');
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const resumeRef = useRef<HTMLInputElement>(null);

    // Job Posting -> Apply Now carries ?job=<id> so the position is not picked again later.
    const [job, setJob] = useState<ApplyJob | null>(null);
    // The job asked for no longer accepts applications (closed / past its deadline).
    const [jobUnavailable, setJobUnavailable] = useState(false);
    const requestedJob = parseInt(params.get('job') || '0', 10) || 0;
    useEffect(() => {
        setJobUnavailable(false);
        if (requestedJob <= 0) { setJob(null); return; }
        portalService.job(requestedJob)
            .then(r => { setJob(r.job); setJobUnavailable(!!r.unavailable); })
            .catch(() => setJob(null));
    }, [requestedJob]);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [invalid, setInvalid] = useState<Set<string>>(new Set());
    const [file, setFile] = useState<File | null>(null);
    const [dragover, setDragover] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [serverErrors, setServerErrors] = useState<string[]>([]);

    const setError = (name: string, message: string) => {
        setErrors(e => ({ ...e, [name]: message }));
        setInvalid(s => {
            const next = new Set(s);
            if (message) next.add(name); else next.delete(name);
            return next;
        });
    };

    const validate = (input: Field): boolean => {
        const message = fieldError(input);
        setError(input.name || input.id, message);
        return !message;
    };

    const onBlur = (e: FocusEvent<Field>) => { if (e.target.type !== 'file') validate(e.target); };
    const onInput = (e: FormEvent<Field>) => {
        const name = e.currentTarget.name || e.currentTarget.id;
        if (invalid.has(name)) setError(name, '');
    };
    const cls = (name: string) => (invalid.has(name) ? 'error' : undefined);
    const err = (name: string) => <span className="field-error" data-for={name}>{errors[name] || ''}</span>;

    const clearResume = () => {
        setFile(null);
        if (resumeRef.current) resumeRef.current.value = '';
    };

    const handleFileSelect = (selected: File) => {
        const ext = (selected.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_EXTS.includes(ext) && !ALLOWED_TYPES.includes(selected.type)) {
            showToast('Invalid file type. Only PDF, DOC, and DOCX files are allowed.', 'error');
            clearResume();
            return;
        }
        if (selected.size > MAX_SIZE) {
            showToast('File too large. Maximum size is 5MB.', 'error');
            clearResume();
            return;
        }
        setFile(selected);
        setErrors(e => ({ ...e, resume: '' }));
    };

    const onResumeChange = (e: ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0];
        if (picked) handleFileSelect(picked); else clearResume();
    };

    const onDrag = (e: DragEvent<HTMLDivElement>, over: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        setDragover(over);
    };

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        onDrag(e, false);
        const dropped = e.dataTransfer.files?.[0];
        if (!dropped) return;
        // Put the dropped file in the input too, so the form's required check sees it.
        if (resumeRef.current) {
            const dt = new DataTransfer();
            dt.items.add(dropped);
            resumeRef.current.files = dt.files;
        }
        handleFileSelect(dropped);
    };

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;

        let allValid = true;
        form.querySelectorAll<Field>('input[required], select[required], textarea[required]').forEach(input => {
            if (input.type === 'file') return; // checked below
            if (!validate(input)) allValid = false;
        });
        if (!file) {
            allValid = false;
            setErrors(er => ({ ...er, resume: 'Please upload your resume file.' }));
        }
        if (!allValid) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => form.querySelector<HTMLElement>('.error')?.focus(), 300);
            return;
        }

        if (!getPortalCsrfToken()) {
            showToast('Security token missing. Please refresh the page and try again.', 'error');
            return;
        }

        setSubmitting(true);
        const formData = new FormData(form);
        if (file) formData.set('resume', file);
        formData.set('session_id', Date.now().toString());

        try {
            const result = await portalService.uploadApplication(formData);
            if (result.success && result.applicant_id) {
                showToast('Application saved! Redirecting to AI screening...', 'success');
                setTimeout(() => navigate(`/screening?applicant=${result.applicant_id}`), 800);
                return;
            }
            setSubmitting(false);
            if (result.errors && result.errors.length) {
                setServerErrors(result.errors);
                showToast(result.message || 'Validation failed', 'error');
            } else {
                showToast(result.message || 'An error occurred', 'error');
            }
        } catch (error) {
            setSubmitting(false);
            showToast(error instanceof Error ? error.message : 'Please try again.', 'error');
        }
    };

    return (
        <ApplicantPage step={1}>
            <section className="applicant-page">
                <div className="container">
                    <div className="page-header reveal">
                        <div className="section-label" style={{ textAlign: 'center' }}>APPLY NOW</div>
                        <h1 className="page-title">Job Application</h1>
                        {job ? (
                            <p className="page-subtitle">Tell us about yourself and upload your resume to apply for <strong>{job.job_title}</strong>.</p>
                        ) : (
                            <p className="page-subtitle">Tell us about yourself and upload your resume to get started.</p>
                        )}
                    </div>

                    {/* The job posting this application is for (from its job page's Apply Now). */}
                    {job && (
                        <div className="applying-for reveal">
                            <div><span className="applying-for-label">Applying for</span><span className="applying-for-value">{job.job_title}</span></div>
                            {job.department && <div><span className="applying-for-label">Department</span><span className="applying-for-value">{job.department}</span></div>}
                            {job.posting_no && <div><span className="applying-for-label">Job Posting ID</span><span className="applying-for-value">{job.posting_no}</span></div>}
                            {job.deadline && <div><span className="applying-for-label">Apply Before</span><span className="applying-for-value">{phpFjY(job.deadline)}</span></div>}
                        </div>
                    )}
                    {jobUnavailable && (
                        <div className="validation-summary" style={{ margin: '0 auto 25px' }}>
                            This job posting is closed and no longer accepts applications. <Link to="/careers" className="text-link">View open positions</Link>, or continue below and our AI will recommend the positions that match your profile.
                        </div>
                    )}

                    <form id="applicationForm" className="application-form reveal" encType="multipart/form-data" ref={formRef} onSubmit={onSubmit}>
                        <input type="hidden" name="preselected_job_id" value={job ? job.id : 0} />

                        <fieldset className="form-section">
                            <legend>
                                <span className="legend-icon">1</span>
                                <span className="legend-text">Personal Information</span>
                            </legend>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label htmlFor="first_name">First Name <span className="required">*</span></label>
                                    <input type="text" id="first_name" name="first_name" required maxLength={100} placeholder="Juan" className={cls('first_name')} onBlur={onBlur} onInput={onInput} />
                                    {err('first_name')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="middle_name">Middle Name</label>
                                    <input type="text" id="middle_name" name="middle_name" maxLength={100} placeholder="Santos" className={cls('middle_name')} onBlur={onBlur} onInput={onInput} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="last_name">Last Name <span className="required">*</span></label>
                                    <input type="text" id="last_name" name="last_name" required maxLength={100} placeholder="Dela Cruz" className={cls('last_name')} onBlur={onBlur} onInput={onInput} />
                                    {err('last_name')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="date_of_birth">Date of Birth <span className="required">*</span></label>
                                    <input type="date" id="date_of_birth" name="date_of_birth" required max={isoDateFromToday()} className={cls('date_of_birth')} onBlur={onBlur} onInput={onInput} />
                                    {err('date_of_birth')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="gender">Gender <span className="required">*</span></label>
                                    <select id="gender" name="gender" required defaultValue="" className={cls('gender')} onBlur={onBlur} onInput={onInput}>
                                        <option value="">-- Select Gender --</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                        <option value="Prefer not to say">Prefer not to say</option>
                                    </select>
                                    {err('gender')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="email">Email Address <span className="required">*</span></label>
                                    <input type="email" id="email" name="email" required maxLength={150} placeholder="juan.delacruz@email.com" className={cls('email')} onBlur={onBlur} onInput={onInput} />
                                    {err('email')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="mobile_number">Mobile Number <span className="required">*</span></label>
                                    <input type="tel" id="mobile_number" name="mobile_number" required maxLength={25} placeholder="+63 912 345 6789" className={cls('mobile_number')} onBlur={onBlur} onInput={onInput} />
                                    {err('mobile_number')}
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label htmlFor="address">Street / House Number / Building <span className="required">*</span></label>
                                    <input type="text" id="address" name="address" required maxLength={255} placeholder="123 Main Street, Barangay Example" className={cls('address')} onBlur={onBlur} onInput={onInput} />
                                    {err('address')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="city">City / Municipality <span className="required">*</span></label>
                                    <select id="city" name="city" required defaultValue="" className={cls('city')} onBlur={onBlur} onInput={onInput}>
                                        <option value="">-- Select City/Municipality --</option>
                                        {CITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    {err('city')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="province">Province <span className="required">*</span></label>
                                    <select id="province" name="province" required defaultValue="" className={cls('province')} onBlur={onBlur} onInput={onInput}>
                                        <option value="">-- Select Province --</option>
                                        {PROVINCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    {err('province')}
                                </div>
                            </div>
                        </fieldset>

                        <fieldset className="form-section">
                            <legend>
                                <span className="legend-icon">2</span>
                                <span className="legend-text">Educational Background</span>
                            </legend>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label htmlFor="highest_attainment">Highest Educational Attainment <span className="required">*</span></label>
                                    <select id="highest_attainment" name="highest_attainment" required defaultValue="" className={cls('highest_attainment')} onBlur={onBlur} onInput={onInput}>
                                        <option value="">-- Select Attainment --</option>
                                        <option value="High School Graduate">High School Graduate</option>
                                        <option value="Vocational / Technical">Vocational / Technical Course</option>
                                        <option value="Associate Degree">Associate Degree</option>
                                        <option value="Bachelor's Degree">Bachelor's Degree</option>
                                        <option value="Master's Degree">Master's Degree</option>
                                        <option value="Doctorate / PhD">Doctorate / PhD</option>
                                    </select>
                                    {err('highest_attainment')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="year_graduated">Year Graduated <span className="required">*</span></label>
                                    <input type="text" id="year_graduated" name="year_graduated" required maxLength={20} placeholder="2024" className={cls('year_graduated')} onBlur={onBlur} onInput={onInput} />
                                    {err('year_graduated')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="school">School / University <span className="required">*</span></label>
                                    <input type="text" id="school" name="school" required maxLength={200} placeholder="University of the Philippines" className={cls('school')} onBlur={onBlur} onInput={onInput} />
                                    {err('school')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="course">Course / Degree <span className="required">*</span></label>
                                    <input type="text" id="course" name="course" required maxLength={200} placeholder="Bachelor of Science in Information Technology" className={cls('course')} onBlur={onBlur} onInput={onInput} />
                                    {err('course')}
                                </div>
                            </div>
                        </fieldset>

                        <fieldset className="form-section">
                            <legend>
                                <span className="legend-icon">3</span>
                                <span className="legend-text">Professional Information</span>
                            </legend>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label htmlFor="years_experience">Years of Work Experience <span className="required">*</span></label>
                                    <input type="number" id="years_experience" name="years_experience" required min={0} max={60} step={0.5} placeholder="3" className={cls('years_experience')} onBlur={onBlur} onInput={onInput} />
                                    {err('years_experience')}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="current_position">Current / Previous Position <span className="required">*</span></label>
                                    <input type="text" id="current_position" name="current_position" required maxLength={200} placeholder="IT Support Specialist" className={cls('current_position')} onBlur={onBlur} onInput={onInput} />
                                    {err('current_position')}
                                </div>
                                <div className="form-group full-width">
                                    <label htmlFor="previous_company">Previous Company / Employer <span className="required">*</span></label>
                                    <input type="text" id="previous_company" name="previous_company" required maxLength={200} placeholder="Tech Solutions Inc." className={cls('previous_company')} onBlur={onBlur} onInput={onInput} />
                                    {err('previous_company')}
                                </div>
                                <div className="form-group full-width">
                                    <label htmlFor="skills">Skills (comma-separated) <span className="required">*</span></label>
                                    <textarea id="skills" name="skills" required rows={3} placeholder="e.g. Programming, Web Development, Microsoft Office, Project Management, Communication Skills" className={cls('skills')} onBlur={onBlur} onInput={onInput}></textarea>
                                    {err('skills')}
                                </div>
                                <div className="form-group full-width">
                                    <label htmlFor="certifications">Certifications (comma-separated, optional)</label>
                                    <textarea id="certifications" name="certifications" rows={2} placeholder="e.g. LET Passer, Civil Service Eligible, CCNA, PMP" className={cls('certifications')} onBlur={onBlur} onInput={onInput}></textarea>
                                </div>
                                <div className="form-group full-width">
                                    <label htmlFor="professional_summary">Professional Summary <span className="required">*</span></label>
                                    <textarea id="professional_summary" name="professional_summary" required rows={5} placeholder="Briefly describe your background, strengths, and career goals..." className={cls('professional_summary')} onBlur={onBlur} onInput={onInput}></textarea>
                                    {err('professional_summary')}
                                </div>
                            </div>
                        </fieldset>

                        <fieldset className="form-section">
                            <legend>
                                <span className="legend-icon">4</span>
                                <span className="legend-text">Resume Upload</span>
                            </legend>

                            <div className="upload-section">
                                <div
                                    className={dragover ? 'upload-area dragover' : 'upload-area'}
                                    id="uploadArea"
                                    onDragEnter={e => onDrag(e, true)}
                                    onDragOver={e => onDrag(e, true)}
                                    onDragLeave={e => onDrag(e, false)}
                                    onDrop={onDrop}
                                >
                                    <input type="file" id="resume" name="resume" accept=".pdf,.doc,.docx" required ref={resumeRef} onChange={onResumeChange} />
                                    <div className="upload-content" style={{ display: file ? 'none' : 'block' }}>
                                        <div className="upload-icon"><CloudUpload /></div>
                                        <p className="upload-title">Upload your latest resume.</p>
                                        <p className="upload-formats">Accepted formats: <strong>PDF, DOC, DOCX</strong> — Max size: <strong>5MB</strong></p>
                                        <p className="upload-hint">Click to browse or drag and drop your file here</p>
                                        <button
                                            type="button"
                                            className="btn btn-upload"
                                            id="browseBtn"
                                            onClick={e => { e.preventDefault(); e.stopPropagation(); resumeRef.current?.click(); }}
                                        >Browse Files</button>
                                    </div>
                                    <div className="upload-preview" id="uploadPreview" style={{ display: file ? 'flex' : 'none' }}>
                                        <div className="preview-details">
                                            <div className="file-icon"><Paperclip /></div>
                                            <div className="file-info">
                                                <div className="file-name" id="fileName">{file?.name}</div>
                                                <div className="file-size" id="fileSize">{file ? formatFileSize(file.size) : ''}</div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="remove-file"
                                            id="removeFile"
                                            onClick={e => { e.preventDefault(); e.stopPropagation(); clearResume(); }}
                                        >&times;</button>
                                    </div>
                                </div>
                                {err('resume')}
                            </div>
                        </fieldset>

                        <div className="form-actions">
                            <div className="validation-summary" id="validationSummary" style={{ display: serverErrors.length ? 'block' : 'none' }}>
                                <strong>Please correct the following:</strong>
                                <ul>{serverErrors.map((m, i) => <li key={i}>{m}</li>)}</ul>
                            </div>
                            <button type="submit" className="btn btn-primary btn-large" id="submitBtn" disabled={submitting}>
                                <span className="btn-text" style={{ display: submitting ? 'none' : undefined }}>Continue</span>
                                <span className="btn-loading" style={{ display: submitting ? 'flex' : 'none' }}>
                                    <span className="spinner"></span> Processing...
                                </span>
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </ApplicantPage>
    );
}
