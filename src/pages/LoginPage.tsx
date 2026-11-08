import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, LockKeyhole, RefreshCw, User } from 'lucide-react';
import Icon from '../components/Icon';
import ArchonLogo from '../components/ArchonLogo';
import { authService } from '../services/authService';
import { ApiError, setCsrfToken } from '../services/http';
import { useAuth } from '../hooks/AuthContext';
import { useScopedCss } from '../hooks/useScopedCss';
import { ArchonAlert } from '../utils/alerts';
import loginCss from '../../../css/login.css?inline';
import loginPageCss from '../styles/login-page.css?inline';

type Stage = 'credentials' | 'verify';

export function useLoginStyles() {
    useScopedCss('login', loginCss + '\n' + loginPageCss);
}

const OTP_DURATION_SECONDS = 120; // 2 minutes (120 seconds)

function formatOtpTimer(total: number): string {
    const clamped = Math.max(0, total);
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

/** Login: username/email + password, then the e-mailed 6-digit code (same flow as login.php). */
export default function LoginPage() {
    useLoginStyles();
    const { refresh, clear, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [params] = useSearchParams();
    const [ready, setReady] = useState(false);
    const [stage, setStage] = useState<Stage>('credentials');
    const [maskedEmail, setMaskedEmail] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [otpSeconds, setOtpSeconds] = useState(OTP_DURATION_SECONDS);
    const [otpExpired, setOtpExpired] = useState(false);
    const shownNotice = useRef(false);

    useEffect(() => { document.title = 'Login - Archon Nell Incorporated'; }, []);

    useEffect(() => {
        // Wait for the app's own session check to finish: on a first visit both
        // requests would otherwise start a PHP session at once, and the second
        // cookie would replace the session holding this page's CSRF token.
        if (authLoading) return undefined;

        // Lets any other open tab of this browser notice the session ended.
        try { localStorage.setItem('archon_session_end', String(Date.now())); } catch { /* storage unavailable */ }

        let cancelled = false;
        (async () => {
            try {
                const s = await authService.state();
                if (cancelled) return;
                setCsrfToken(s.csrf_token);
                if (s.authenticated) {
                    await refresh();
                    navigate('/', { replace: true });
                    return;
                }
                clear(); // the server has no session: forget any local one
                setStage(s.stage);
                setMaskedEmail(s.masked_email);
                if (s.stage === 'verify') {
                    const remaining = typeof s.otp_remaining === 'number' && s.otp_remaining > 0
                        ? s.otp_remaining
                        : (s.otp_remaining === 0 ? 0 : OTP_DURATION_SECONDS);
                    setOtpSeconds(remaining);
                    setOtpExpired(remaining <= 0);
                }
                setReady(true);

                if (shownNotice.current) return;
                shownNotice.current = true;
                const msg = params.get('msg');
                if (msg === 'timeout') {
                    await ArchonAlert.warning(`You have been automatically logged out because of ${Math.floor(s.session_timeout / 60)} minutes of inactivity. Please log in again.`, { title: 'Session Expired' });
                } else if (msg === 'loggedout') {
                    await ArchonAlert.success('You have been successfully logged out.');
                }
                if (s.notice) await ArchonAlert.error(s.notice);
            } catch (err) {
                if (cancelled) return;
                setReady(true);
                void ArchonAlert.error(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again later.');
            }
        })();
        return () => { cancelled = true; };
    }, [authLoading]);

    // OTP verification countdown timer (separate from session timeout)
    useEffect(() => {
        if (stage !== 'verify') {
            setOtpSeconds(OTP_DURATION_SECONDS);
            setOtpExpired(false);
            return undefined;
        }

        const interval = window.setInterval(() => {
            setOtpSeconds(prev => {
                if (prev <= 1) {
                    setOtpExpired(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => window.clearInterval(interval);
    }, [stage]);

    const handleError = async (err: unknown) => {
        if (err instanceof ApiError) {
            if (typeof err.data.csrf_token === 'string') setCsrfToken(err.data.csrf_token);
            if (err.data.stage === 'credentials') { setStage('credentials'); setCode(''); }
            await ArchonAlert.error(err.message);
        } else {
            await ArchonAlert.error('An unexpected error occurred. Please try again later.');
        }
    };

    const finish = async (redirect: string | null | undefined, csrf?: string) => {
        if (csrf) setCsrfToken(csrf);
        if (redirect) {
            // The user was sent here from a PHP endpoint (e.g. a document download): go back to it.
            window.location.assign(redirect);
            return;
        }
        await refresh();
        const from = (location.state as { from?: string } | null)?.from;
        navigate(from && from !== '/login' ? from : '/', { replace: true });
    };

    const onLogin = async (e: FormEvent) => {
        e.preventDefault();
        if (!identifier.trim() || !password) {
            await ArchonAlert.warning('Please enter both your username/email and password.', { title: 'Missing Information' });
            return;
        }
        setBusy(true);
        try {
            const res = await authService.login(identifier.trim(), password);
            if (res.stage === 'done') { await finish(res.redirect, res.csrf_token); return; }
            setStage('verify');
            setMaskedEmail(res.masked_email || '');
            setPassword('');
            setCode('');
            setOtpSeconds(res.otp_remaining ?? OTP_DURATION_SECONDS);
            setOtpExpired(false);
            setBusy(false);
            if (res.message) await (res.sent ? ArchonAlert.success(res.message) : ArchonAlert.error(res.message));
        } catch (err) {
            setBusy(false);
            await handleError(err);
        }
    };

    const onVerify = async (e: FormEvent) => {
        e.preventDefault();
        if (otpSeconds <= 0 || otpExpired) {
            await ArchonAlert.warning('Your verification code has expired. Please request a new one.', { title: 'Code Expired' });
            return;
        }
        setBusy(true);
        try {
            const res = await authService.verify(code);
            await finish(res.redirect, res.csrf_token);
        } catch (err) {
            setBusy(false);
            await handleError(err);
        }
    };

    const onResend = async () => {
        try {
            const res = await authService.resend();
            setMaskedEmail(res.masked_email || maskedEmail);
            setOtpSeconds(res.otp_remaining ?? OTP_DURATION_SECONDS);
            setOtpExpired(false);
            setCode('');
            if (res.message) await ArchonAlert.success(res.message);
        } catch (err) {
            await handleError(err);
        }
    };

    const onCancel = async () => {
        try { await authService.cancel(); } catch { /* back to the first step anyway */ }
        setStage('credentials');
        setCode('');
        setOtpSeconds(OTP_DURATION_SECONDS);
        setOtpExpired(false);
    };

    return (
        <div className="login-wrapper">
            <div className="login-card">
                <div className="login-header">
                    <div className="logo-icon archon-logo-icon"><ArchonLogo /></div>
                    <h2 className="login-title">{stage === 'verify' ? 'Verify Your Login' : 'Welcome Back'}</h2>
                    <p className="login-subtitle">
                        {stage === 'verify' ? `Enter the 6-digit code we e-mailed to ${maskedEmail}` : 'Sign in to access the Archon Nell Incorporated'}
                    </p>
                </div>

                {ready && stage === 'verify' && (
                    <>
                        <form autoComplete="off" id="verifyForm" noValidate onSubmit={onVerify}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="code">Verification Code</label>
                                <div className="input-group">
                                    <Icon as={LockKeyhole} />
                                    <input type="text" id="code" name="code" className="form-control" inputMode="numeric" pattern="[0-9]*"
                                        maxLength={6} autoComplete="one-time-code" placeholder="Enter 6-digit code" required autoFocus
                                        aria-required="true" value={code} onChange={e => setCode(e.target.value)} />
                                </div>
                            </div>
                            <div className="otp-timer-wrap" style={{ textAlign: 'center', marginBottom: '1.25rem', padding: '0.6rem 0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Code expires in:</span>
                                <strong id="otpTimerDisplay" style={{ fontSize: '1.1rem', fontFamily: 'monospace', fontWeight: 700, color: otpSeconds <= 30 ? 'var(--danger, #dc2626)' : 'var(--accent, #2563eb)' }}>
                                    {formatOtpTimer(otpSeconds)}
                                </strong>
                                {otpSeconds <= 0 && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--danger, #dc2626)', fontWeight: 600, marginLeft: '0.25rem' }}>(Expired)</span>
                                )}
                            </div>
                            <button type="submit" className={`btn-submit${busy ? ' is-loading' : ''}`} id="submitBtn" disabled={busy || otpSeconds <= 0}>
                                <span className="btn-text">Verify &amp; Continue</span>
                                <span className="btn-spinner" aria-hidden="true"></span>
                            </button>
                            <div className="verify-actions">
                                <button type="button" className="btn-verify-action btn-verify-cancel btn-verify-secondary" id="btnCancelLogin"
                                    title="Use a different account" onClick={() => void onCancel()}>
                                    <Icon as={ArrowLeft} />
                                    <span>Use a different account</span>
                                </button>
                                <button type="button" className="btn-verify-action btn-verify-resend btn-verify-primary" id="btnResendCode"
                                    title="Resend code" onClick={() => void onResend()}>
                                    <Icon as={RefreshCw} />
                                    <span>Resend code</span>
                                </button>
                            </div>
                        </form>
                        <p className="login-footer-note">The code expires in 2 minutes and can only be used once.</p>
                    </>
                )}

                {ready && stage === 'credentials' && (
                    <>
                        <form autoComplete="off" id="loginForm" noValidate onSubmit={onLogin}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="identifier">Username or Email</label>
                                <div className="input-group">
                                    <Icon as={User} />
                                    <input type="text" id="identifier" name="identifier" className="form-control" placeholder="Enter your username or email"
                                        required autoFocus aria-required="true" value={identifier} onChange={e => setIdentifier(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="password">Password</label>
                                <div className="input-group">
                                    <Icon as={Lock} />
                                    <input type={showPassword ? 'text' : 'password'} id="password" name="password" className="form-control"
                                        placeholder="Enter your password" required aria-required="true" value={password} onChange={e => setPassword(e.target.value)} />
                                    <button type="button" className="toggle-password" id="togglePassword" tabIndex={-1}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(s => !s)}>
                                        <Icon as={showPassword ? Eye : EyeOff} />
                                    </button>
                                </div>
                            </div>
                            <button type="submit" className={`btn-submit${busy ? ' is-loading' : ''}`} id="submitBtn" disabled={busy}>
                                <span className="btn-text">Log In</span>
                                <span className="btn-spinner" aria-hidden="true"></span>
                            </button>
                        </form>
                        <p className="login-footer-note">A 6-digit verification code will be e-mailed to your registered address to complete sign-in.</p>
                    </>
                )}
            </div>
        </div>
    );
}
