import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Info, KeyRound, LockKeyhole } from 'lucide-react';
import { ApplicantPage } from '../../layouts/SiteLayouts';
import { showToast, usePageMeta } from '../../hooks';
import { applicantPortalService } from '../../../services/portalService';
import { isoDateFromToday } from '../../../utils/format';
import type { ApplicantPortalPending } from '../../../types/portal';

export const PORTAL_SIGN_IN = '/applicant-portal';
export const PORTAL_DASHBOARD = '/applicant-portal/dashboard';

const outlineBtn = { color: '#0877bb', borderColor: '#0877bb', background: '#fff' };

type Details = { application_number: string; email: string; date_of_birth: string };
type FieldName = keyof Details | 'code';

/** Same client-side checks as the application form (the server validates again). */
function detailErrors(d: Details): Partial<Record<FieldName, string>> {
    const errors: Partial<Record<FieldName, string>> = {};
    if (!d.application_number.trim()) errors.application_number = 'Application ID is required.';
    if (!d.email.trim()) errors.email = 'Email Address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) errors.email = 'Please enter a valid email address.';
    if (!d.date_of_birth) errors.date_of_birth = 'Date of Birth is required.';
    else if (d.date_of_birth > isoDateFromToday()) errors.date_of_birth = 'Date of birth cannot be in the future.';
    return errors;
}

/** Applicant Portal sign-in: application details, then the e-mailed code (when mail is set up). */
export default function ApplicantPortalLoginPage() {
    usePageMeta('Applicant Portal', 'Archon Nell Incorporated - Applicant Portal');
    const navigate = useNavigate();
    const location = useLocation();
    const notice = (location.state as { notice?: string } | null)?.notice ?? '';

    const [checking, setChecking] = useState(true);
    const [pending, setPending] = useState<ApplicantPortalPending | null>(null);
    const [details, setDetails] = useState<Details>({ application_number: '', email: '', date_of_birth: '' });
    const [code, setCode] = useState('');
    const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
    const [serverError, setServerError] = useState('');
    const [busy, setBusy] = useState(false);
    const [resendIn, setResendIn] = useState(0);

    const startCodeStep = (p: ApplicantPortalPending) => {
        setPending(p);
        setResendIn(p.resend_in);
        setCode('');
        setErrors({});
        setServerError('');
    };

    const backToDetails = (message = '') => {
        setPending(null);
        setCode('');
        setServerError(message);
    };

    // Already signed in -> dashboard; a code step still open in this browser -> resume it.
    useEffect(() => {
        applicantPortalService.session()
            .then(s => {
                if (s.authenticated) { navigate(PORTAL_DASHBOARD, { replace: true }); return; }
                if (s.pending) startCodeStep(s.pending);
                setChecking(false);
            })
            .catch(() => setChecking(false));
    }, [navigate]);

    useEffect(() => {
        if (resendIn <= 0) return;
        const t = setTimeout(() => setResendIn(n => n - 1), 1000);
        return () => clearTimeout(t);
    }, [resendIn]);

    const onDetail = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDetails(d => ({ ...d, [name]: value }));
        if (errors[name as FieldName]) setErrors(er => ({ ...er, [name]: '' }));
    };

    const onSignIn = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const found = detailErrors(details);
        setErrors(found);
        setServerError('');
        if (Object.values(found).some(Boolean)) return;

        setBusy(true);
        try {
            const r = await applicantPortalService.login(details.application_number.trim(), details.email.trim(), details.date_of_birth);
            if (r.success && r.verification_required && r.pending) {
                startCodeStep(r.pending);
            } else if (r.success) {
                navigate(PORTAL_DASHBOARD, { replace: true });
            } else {
                setServerError(r.errors?.length ? r.errors.join(' ') : (r.message || 'Sign-in failed. Please try again.'));
            }
        } catch (err) {
            setServerError(err instanceof Error ? err.message : 'Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const onVerify = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const digits = code.replace(/\D/g, '');
        if (digits.length !== 6) {
            setErrors({ code: 'Please enter the 6-digit code sent to your e-mail.' });
            return;
        }
        setBusy(true);
        setServerError('');
        try {
            const r = await applicantPortalService.verify(digits);
            if (r.success) navigate(PORTAL_DASHBOARD, { replace: true });
            else if (r.restart) backToDetails(r.message || 'Please sign in again.');
            else setServerError(r.message || 'Verification failed. Please try again.');
        } catch (err) {
            setServerError(err instanceof Error ? err.message : 'Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const onResend = async () => {
        setServerError('');
        try {
            const r = await applicantPortalService.resend();
            if (r.success && r.pending) {
                startCodeStep(r.pending);
                showToast('A new verification code has been sent.', 'success');
            } else if (r.restart) {
                backToDetails(r.message || 'Please sign in again.');
            } else {
                if (r.pending) setResendIn(r.pending.resend_in);
                setServerError(r.message || 'We could not send a new code. Please try again.');
            }
        } catch (err) {
            setServerError(err instanceof Error ? err.message : 'Please try again.');
        }
    };

    const onUseOtherDetails = async () => {
        try { await applicantPortalService.cancel(); } catch { /* the step is dropped client-side anyway */ }
        backToDetails();
    };

    const cls = (name: FieldName) => (errors[name] ? 'error' : undefined);
    const err = (name: FieldName) => <span className="field-error" data-for={name}>{errors[name] || ''}</span>;

    return (
        <ApplicantPage>
            <section className="applicant-page portal-access-page">
                <div className="container">
                    <div className="page-header reveal">
                        <div className="section-label" style={{ textAlign: 'center' }}>APPLICANT PORTAL</div>
                        <h1 className="page-title">Track Your Application</h1>
                        <p className="page-subtitle">Sign in with the details from your application to see its status, interview schedule and latest updates.</p>
                    </div>

                    {!checking && (pending ? (
                        <form className="application-form portal-access-form reveal" onSubmit={onVerify} noValidate>
                            <fieldset className="form-section">
                                <legend>
                                    <span className="legend-icon"><KeyRound /></span>
                                    <span className="legend-text">Verify It&apos;s You</span>
                                </legend>
                                <p className="portal-form-text">
                                    We sent a 6-digit verification code to <strong>{pending.email}</strong>. Enter it below to open your application.
                                </p>
                                <div className="form-grid">
                                    <div className="form-group full-width">
                                        <label htmlFor="portal_code">Verification Code <span className="required">*</span></label>
                                        <input
                                            type="text" id="portal_code" name="code" inputMode="numeric" autoComplete="one-time-code"
                                            maxLength={6} placeholder="000000" className={cls('code')} value={code} autoFocus
                                            onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setErrors({}); }}
                                        />
                                        {err('code')}
                                    </div>
                                </div>
                            </fieldset>

                            <div className="form-actions">
                                {serverError && <div className="validation-summary">{serverError}</div>}
                                <button type="submit" className="btn btn-primary btn-large" disabled={busy}>
                                    <span className="btn-text" style={{ display: busy ? 'none' : undefined }}>Verify &amp; Continue</span>
                                    <span className="btn-loading" style={{ display: busy ? 'flex' : 'none' }}><span className="spinner"></span> Verifying...</span>
                                </button>
                                <div className="portal-form-links">
                                    <button type="button" className="btn btn-outline" style={outlineBtn} disabled={resendIn > 0} onClick={() => void onResend()}>
                                        {resendIn > 0 ? `Resend code (${resendIn}s)` : 'Resend code'}
                                    </button>
                                    <button type="button" className="btn btn-outline" style={outlineBtn} onClick={() => void onUseOtherDetails()}>
                                        Use different details
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <form className="application-form portal-access-form reveal" onSubmit={onSignIn} noValidate>
                            <fieldset className="form-section">
                                <legend>
                                    <span className="legend-icon"><LockKeyhole /></span>
                                    <span className="legend-text">Applicant Sign In</span>
                                </legend>
                                {notice && !serverError && <div className="portal-notice">{notice}</div>}
                                <div className="form-grid">
                                    <div className="form-group full-width">
                                        <label htmlFor="application_number">Application ID <span className="required">*</span></label>
                                        <input type="text" id="application_number" name="application_number" maxLength={50} autoComplete="off"
                                            placeholder="AP-2026-00001" className={cls('application_number')} value={details.application_number} onChange={onDetail} />
                                        {err('application_number')}
                                    </div>
                                    <div className="form-group full-width">
                                        <label htmlFor="portal_email">Email Address <span className="required">*</span></label>
                                        <input type="email" id="portal_email" name="email" maxLength={150} autoComplete="email"
                                            placeholder="juan.delacruz@email.com" className={cls('email')} value={details.email} onChange={onDetail} />
                                        {err('email')}
                                    </div>
                                    <div className="form-group full-width">
                                        <label htmlFor="portal_dob">Date of Birth <span className="required">*</span></label>
                                        <input type="date" id="portal_dob" name="date_of_birth" max={isoDateFromToday()}
                                            className={cls('date_of_birth')} value={details.date_of_birth} onChange={onDetail} />
                                        {err('date_of_birth')}
                                    </div>
                                </div>
                            </fieldset>

                            <div className="form-actions">
                                {serverError && <div className="validation-summary">{serverError}</div>}
                                <button type="submit" className="btn btn-primary btn-large" disabled={busy}>
                                    <span className="btn-text" style={{ display: busy ? 'none' : undefined }}>Sign In</span>
                                    <span className="btn-loading" style={{ display: busy ? 'flex' : 'none' }}><span className="spinner"></span> Checking...</span>
                                </button>
                            </div>
                        </form>
                    ))}

                    <div className="note-card portal-help reveal">
                        <div className="note-icon"><Info /></div>
                        <div className="note-content">
                            <strong>Where do I find my Application ID?</strong>
                            <p>
                                It is shown on the confirmation page after you submit your application and in the confirmation
                                e-mail we sent you (for example <code>AP-2026-00001</code>). Haven&apos;t applied yet?{' '}
                                <Link to="/apply" className="text-link">Apply now</Link>. Employees and HR staff should use <strong className="portal-inline">Sign in</strong> instead.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </ApplicantPage>
    );
}
