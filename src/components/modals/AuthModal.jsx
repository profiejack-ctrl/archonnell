import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { 
  X, 
  Lock, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  RefreshCw, 
  Eye, 
  EyeOff,
  User,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Info,
  Clock
} from 'lucide-react';

function getOrCreateDeviceId() {
  let id = localStorage.getItem('archon_device_id');
  if (!id) {
    id = 'dev-' + Math.random().toString(36).substring(2, 12) + '-' + Date.now().toString(36);
    localStorage.setItem('archon_device_id', id);
  }
  return id;
}

// Visual Password Policy Checklist
function PasswordChecklist({ password }) {
  const rules = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'One uppercase letter (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', valid: /[a-z]/.test(password) },
    { label: 'One number (0-9)', valid: /[0-9]/.test(password) },
    { label: 'One special symbol (!@#$%...)', valid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password) }
  ];

  const allValid = rules.every(r => r.valid);

  return (
    <div className={`p-3 rounded-2xl border transition-all text-left ${
      allValid ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50 border-slate-200'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1">
          <ShieldCheck className={`w-3.5 h-3.5 ${allValid ? 'text-emerald-600' : 'text-blue-600'}`} />
          Security Password Policy
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
          allValid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
        }`}>
          {allValid ? 'Compliant' : 'Required'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-[11px]">
            {rule.valid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            ) : (
              <div className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0 bg-white" />
            )}
            <span className={rule.valid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthModal() {
  const { 
    isAuthOpen, 
    setIsAuthOpen, 
    loginWithAuth,
    setCurrentUser, 
    setCurrentView, 
    showToast 
  } = useApp();

  // Modes: 'LOGIN' | 'LOGIN_OTP' | 'FORGOT_EMAIL' | 'FORGOT_OTP' | 'REGISTER'
  const [mode, setMode] = useState('LOGIN');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Trust this device for 5 days toggle state
  const [trustDevice, setTrustDevice] = useState(true);

  // OTP Fields & Restrictions
  const [otpCode, setOtpCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes overall code life
  const [resendCooldown, setResendCooldown] = useState(60); // 1-minute (60s) cooldown for Resend
  const [isOtpAborted, setIsOtpAborted] = useState(false); // True if 5 wrong attempts entered

  // Forgot Password Fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Register Fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regAddress, setRegAddress] = useState('');

  // Timer countdown for overall OTP expiration
  useEffect(() => {
    let timer;
    if ((mode === 'LOGIN_OTP' || mode === 'FORGOT_OTP') && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode, timeLeft]);

  // Timer countdown for 1-minute (60 seconds) Resend OTP cooldown
  useEffect(() => {
    let timer;
    if ((mode === 'LOGIN_OTP' || mode === 'FORGOT_OTP') && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode, resendCooldown]);

  // Reset form when modal closes/opens
  useEffect(() => {
    if (!isAuthOpen) {
      setMode('LOGIN');
      setErrorMsg('');
      setOtpCode('');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsOtpAborted(false);
      setResendCooldown(60);
    }
  }, [isAuthOpen]);

  if (!isAuthOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const validatePasswordRules = (pwd) => {
    return pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /[0-9]/.test(pwd) &&
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd);
  };

  // 1. STEP 1: LOGIN (Validates credentials -> Checks 5-day trust, 5-attempt limit, or dispatches OTP)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await api.loginInit(email.trim().toLowerCase(), password, deviceId, trustDevice);
      setLoading(false);

      // Check if trusted device bypassed OTP
      if (!res.requireOtp && res.token && res.user) {
        if (loginWithAuth) {
          loginWithAuth(res.user, res.token);
        } else {
          localStorage.setItem('archon_token', res.token);
          localStorage.setItem('archon_user', JSON.stringify(res.user));
          setCurrentUser(res.user);
          setIsAuthOpen(false);
          setCurrentView(res.user.role === 'admin' ? 'admin-dashboard' : 'customer-dashboard');
        }
        showToast(`Welcome back, ${res.user.name}! (Trusted device recognized - OTP skipped)`, 'success');
        return;
      }

      if (res.requireOtp) {
        setMode('LOGIN_OTP');
        setTimeLeft(300);
        setResendCooldown(60);
        setOtpCode('');
        setIsOtpAborted(false);
        showToast(`Verification code sent to ${res.email}`, 'info');
      }
    } catch (err) {
      setLoading(false);
      // If 5 wrong password attempts reached: force password reset
      if (err.forcePasswordReset || err.message?.includes('Maximum password attempts exceeded') || err.message?.includes('Account locked')) {
        setErrorMsg('Maximum password attempts exceeded (5/5). Your account has been locked. Please reset your password.');
        showToast('Account locked after 5 failed attempts. Please reset your password.', 'error');
        setMode('FORGOT_EMAIL');
        // Automatically dispatch forgot password OTP to user
        api.forgotPasswordInit(email.trim().toLowerCase()).then((fRes) => {
          if (fRes.requireOtp) {
            setMode('FORGOT_OTP');
            setTimeLeft(300);
            setResendCooldown(60);
            setOtpCode('');
            showToast(`Security reset code dispatched to ${email}`, 'info');
          }
        }).catch(() => {});
        return;
      }
      setErrorMsg(err.message || 'Invalid email or password.');
    }
  };

  // 2. STEP 2: VERIFY LOGIN OTP (Identifies role -> RBAC Redirect & stores trusted device; aborts after 5 wrong OTP entries)
  const handleLoginOtpVerify = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (isOtpAborted) {
      setErrorMsg('This verification code was aborted due to 5 wrong entries. Please click Resend Code below.');
      return;
    }

    if (otpCode.length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await api.loginVerifyOtp(email.trim().toLowerCase(), otpCode, deviceId, trustDevice);
      setLoading(false);

      if (res.token && res.user) {
        if (loginWithAuth) {
          loginWithAuth(res.user, res.token);
        } else {
          localStorage.setItem('archon_token', res.token);
          localStorage.setItem('archon_user', JSON.stringify(res.user));
          setCurrentUser(res.user);
          setIsAuthOpen(false);
          setCurrentView(res.user.role === 'admin' ? 'admin-dashboard' : 'customer-dashboard');
          showToast(`Welcome, ${res.user.name}!`, 'success');
        }
      }
    } catch (err) {
      setLoading(false);
      // Check if 5th wrong OTP attempt caused code abort
      if (err.otpAborted || err.message?.includes('Maximum OTP attempts exceeded') || err.message?.includes('aborted')) {
        setIsOtpAborted(true);
        setOtpCode('');
        setErrorMsg('Maximum OTP attempts exceeded (5/5). This verification code has been aborted. Please click Resend Code to receive a new one.');
        showToast('OTP code aborted. Please click Resend Code to request a new code.', 'error');
        return;
      }
      setErrorMsg(err.message || 'Invalid or expired OTP code.');
    }
  };

  // 3. FORGOT PASSWORD - STEP 1: SEND RESET CODE
  const handleForgotEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.forgotPasswordInit(email.trim().toLowerCase());
      setLoading(false);

      if (res.requireOtp) {
        setMode('FORGOT_OTP');
        setTimeLeft(300);
        setResendCooldown(60);
        setOtpCode('');
        setIsOtpAborted(false);
        showToast(res.message, 'info');
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'Failed to process request.');
    }
  };

  // 4. FORGOT PASSWORD - STEP 2: VERIFY OTP & SET NEW PASSWORD
  const handleForgotOtpVerify = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (isOtpAborted) {
      setErrorMsg('This verification code was aborted due to 5 wrong entries. Please click Resend Code below.');
      return;
    }

    if (otpCode.length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    if (!validatePasswordRules(newPassword)) {
      setErrorMsg('New password must satisfy all 5 requirements of the Password Policy below.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.forgotPasswordVerify(email.trim().toLowerCase(), otpCode, newPassword);
      setLoading(false);
      showToast(res.message || 'Password successfully updated! Your account is unlocked.', 'success');
      setPassword('');
      setMode('LOGIN');
    } catch (err) {
      setLoading(false);
      if (err.otpAborted || err.message?.includes('Maximum OTP attempts exceeded')) {
        setIsOtpAborted(true);
        setOtpCode('');
        setErrorMsg('Maximum OTP attempts exceeded (5/5). Code aborted. Please click Resend Code.');
        return;
      }
      setErrorMsg(err.message || 'Failed to reset password.');
    }
  };

  // 5. RESEND OTP CODE VIA BREVO (WITH 1-MINUTE COOLDOWN)
  const handleResendOtp = async (purpose) => {
    if (resendCooldown > 0) {
      setErrorMsg(`Please wait ${resendCooldown} seconds before requesting a new code.`);
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      const res = await api.resendOtp(email.trim().toLowerCase(), purpose);
      setLoading(false);
      setTimeLeft(300);
      setResendCooldown(60);
      setOtpCode('');
      setIsOtpAborted(false);
      showToast(res.message || 'New verification code dispatched to your email.', 'info');
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'Failed to resend code.');
    }
  };

  // 6. REGISTER NEW CUSTOMER
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    if (!validatePasswordRules(regPassword)) {
      setErrorMsg('Password must satisfy all 5 requirements of the Password Policy below.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        phone: regPhone.trim(),
        company: regCompany.trim(),
        defaultAddress: regAddress.trim()
      });
      setLoading(false);

      if (res.token && res.user) {
        if (loginWithAuth) {
          loginWithAuth(res.user, res.token);
        } else {
          localStorage.setItem('archon_token', res.token);
          localStorage.setItem('archon_user', JSON.stringify(res.user));
          setCurrentUser(res.user);
          setIsAuthOpen(false);
          setCurrentView('customer-dashboard');
        }
        showToast(`Account created! Welcome to Archon Nell, ${res.user.name}.`, 'success');
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'Registration failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Navy Branding */}
        <div className="p-5 sm:p-6 bg-[#0b1b3d] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white">
              {mode === 'LOGIN_OTP' || mode === 'FORGOT_OTP' ? (
                <KeyRound className="w-5 h-5" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                {mode === 'LOGIN' && 'Sign In to Archon Nell'}
                {mode === 'LOGIN_OTP' && 'Two-Factor Authentication'}
                {mode === 'FORGOT_EMAIL' && 'Reset Your Password'}
                {mode === 'FORGOT_OTP' && 'Verify & Set New Password'}
                {mode === 'REGISTER' && 'Create Contractor Account'}
              </h3>
              <p className="text-[11px] text-slate-300">
                {mode === 'LOGIN' && 'Secure access with 2FA OTP & Password Policy'}
                {mode === 'LOGIN_OTP' && 'Enter the 6-digit code sent to your email'}
                {mode === 'FORGOT_EMAIL' && 'We will send a reset code via Brevo email'}
                {mode === 'FORGOT_OTP' && 'Adhere to password policy to protect your account'}
                {mode === 'REGISTER' && 'Register for procurement and bulk contractor orders'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAuthOpen(false)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. LOGIN FORM                                            */}
        {/* ======================================================== */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
            
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@archonnell.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('FORGOT_EMAIL');
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Policy info hint */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-blue-700">
              <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span>Max 5 attempts allowed. Policy: Min 8 chars with upper, lower, number & symbol.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 active:scale-98"
            >
              {loading ? (
                <span>Validating & Dispatching OTP...</span>
              ) : (
                <>
                  <span>Sign In & Verify</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Switch to Register */}
            <div className="pt-3 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('REGISTER');
                  }}
                  className="font-bold text-blue-600 hover:text-blue-700 ml-1"
                >
                  Register here
                </button>
              </p>
            </div>

          </form>
        )}

        {/* ======================================================== */}
        {/* 2. LOGIN OTP VERIFICATION (2FA RBAC)                     */}
        {/* ======================================================== */}
        {mode === 'LOGIN_OTP' && (
          <form onSubmit={handleLoginOtpVerify} className="p-6 space-y-4 text-center">
            
            <div className="space-y-1.5">
              <p className="text-xs text-slate-600">
                We sent a 6-digit security code via Brevo to:
              </p>
              <div className="inline-block bg-slate-100 text-slate-800 font-mono text-xs px-3 py-1 rounded-full font-bold">
                {email}
              </div>
            </div>

            {/* 6-Digit OTP Box (Disabled if code aborted) */}
            <div>
              <input
                type="text"
                autoFocus
                disabled={isOtpAborted}
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className={`w-full text-center text-3xl tracking-[0.5em] font-mono font-black py-3 border-2 rounded-2xl focus:outline-none transition-all ${
                  isOtpAborted 
                    ? 'bg-rose-50 border-rose-300 text-rose-400 cursor-not-allowed' 
                    : 'bg-slate-50 border-blue-200 focus:border-blue-600 text-slate-900'
                }`}
              />
            </div>

            {/* Timer & Attempt Warning */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Code expires in:</span>
              <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-rose-500 animate-pulse' : 'text-slate-800'}`}>
                {formattedTime}
              </span>
            </div>

            {/* Trust this device for 5 days toggle on OTP screen */}
            <div 
              onClick={() => setTrustDevice(!trustDevice)}
              className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm text-left my-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  trustDevice ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate">Trust this device for 5 days.</span>
                  <span className="text-[10px] text-slate-500 block truncate">Skips OTP verification on this browser for 5 days</span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={trustDevice}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  trustDevice ? 'bg-[#5850ec]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                    trustDevice ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6 || isOtpAborted}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              {loading ? (
                <span>Verifying credentials & role...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify OTP & Launch Dashboard</span>
                </>
              )}
            </button>

            {/* Action Bar with 1-Minute Cooldown Timer on Resend */}
            <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMode('LOGIN')}
                className="text-slate-500 hover:text-slate-700 flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </button>

              <button
                type="button"
                disabled={loading || resendCooldown > 0}
                onClick={() => handleResendOtp('Login 2FA Verification')}
                className="text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed font-bold flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}</span>
              </button>
            </div>

          </form>
        )}

        {/* ======================================================== */}
        {/* 3. FORGOT PASSWORD - EMAIL INPUT                         */}
        {/* ======================================================== */}
        {mode === 'FORGOT_EMAIL' && (
          <form onSubmit={handleForgotEmailSubmit} className="p-6 space-y-4">
            
            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your registered account email. An OTP code will be sent to verify your identity before creating a new password.
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Registered Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@archonnell.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-4 active:scale-98"
            >
              {loading ? (
                <span>Dispatching Code...</span>
              ) : (
                <>
                  <span>Send Reset OTP Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setMode('LOGIN')}
                className="text-xs text-slate-500 hover:text-slate-700 font-semibold inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancel & Return to Login</span>
              </button>
            </div>

          </form>
        )}

        {/* ======================================================== */}
        {/* 4. FORGOT PASSWORD - OTP & NEW PASSWORD (POLICY CHECK)   */}
        {/* ======================================================== */}
        {mode === 'FORGOT_OTP' && (
          <form onSubmit={handleForgotOtpVerify} className="p-6 space-y-3.5">
            
            <div className="space-y-1 text-center">
              <p className="text-xs text-slate-600">Enter code sent to:</p>
              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                {email}
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">6-Digit Verification Code</label>
              <input
                type="text"
                autoFocus
                disabled={isOtpAborted}
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className={`w-full text-center text-2xl tracking-[0.4em] font-mono font-bold py-2 border rounded-xl focus:outline-none ${
                  isOtpAborted ? 'bg-rose-50 border-rose-300 text-rose-400 cursor-not-allowed' : 'bg-slate-50 border-blue-300 focus:border-blue-600'
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Must adhere to password policy"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900"
              />
            </div>

            {/* Interactive Password Policy Checklist */}
            <PasswordChecklist password={newPassword} />

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !validatePasswordRules(newPassword) || newPassword !== confirmPassword || isOtpAborted}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-4 active:scale-98"
            >
              {loading ? (
                <span>Updating Password...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Password & Unlock Account</span>
                </>
              )}
            </button>

            <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMode('LOGIN')}
                className="text-slate-500 hover:text-slate-700 flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={loading || resendCooldown > 0}
                onClick={() => handleResendOtp('Password Reset')}
                className="text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed font-bold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}</span>
              </button>
            </div>

          </form>
        )}

        {/* ======================================================== */}
        {/* 5. REGISTER NEW CONTRACTOR ACCOUNT (POLICY CHECK)        */}
        {/* ======================================================== */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} className="p-6 space-y-3">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Engr. Juan Dela Cruz"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Email Address *</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="contractor@company.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Password *</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create secure password"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Mobile Phone</label>
                <input
                  type="text"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="0917 123 4567"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Interactive Password Policy Checklist */}
            <PasswordChecklist password={regPassword} />

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Company / Contractor Name</label>
              <input
                type="text"
                value={regCompany}
                onChange={(e) => setRegCompany(e.target.value)}
                placeholder="e.g. Mega Infrastructure Builders Corp."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Primary Delivery Address / Depot</label>
              <input
                type="text"
                value={regAddress}
                onChange={(e) => setRegAddress(e.target.value)}
                placeholder="Depot address or project location"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !validatePasswordRules(regPassword)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-3 active:scale-98"
            >
              {loading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <User className="w-4 h-4" />
                  <span>Create Account & Log In</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('LOGIN');
                  }}
                  className="font-bold text-blue-600 hover:text-blue-700 ml-1"
                >
                  Sign in here
                </button>
              </p>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
