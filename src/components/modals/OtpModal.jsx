import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, X, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';

export default function OtpModal() {
  const { otpState, setOtpState, verifyOtpCode, triggerOtp, showToast } = useApp();
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!otpState.isOpen) return;
    setTimeLeft(Math.max(0, Math.ceil((otpState.expiresAt - Date.now()) / 1000)));

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((otpState.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [otpState.isOpen, otpState.expiresAt]);

  if (!otpState.isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      showToast('A 6-digit code is required.', 'warning');
      return;
    }
    setIsVerifying(true);
    try {
      const ok = await verifyOtpCode(code);
      if (ok) setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await triggerOtp(otpState.email, otpState.onSuccessCallback);
      setCode('');
      setTimeLeft(300);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Icon */}
        <div className="flex justify-between items-start">
          <div className="w-5"></div>
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <button
            onClick={() => setOtpState(prev => ({ ...prev, isOpen: false, isVerified: false }))}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-xl font-extrabold text-slate-900">
            Email Verification
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            We have dispatched a 6-digit verification code to:
          </p>
          <div className="inline-block bg-blue-50 text-blue-800 font-mono text-xs px-3 py-1 rounded-full font-bold border border-blue-200">
            {otpState.email}
          </div>
        </div>

        {/* OTP Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full text-center text-2xl tracking-[0.5em] font-mono font-extrabold py-3 border-2 border-blue-200 focus:border-blue-600 rounded-2xl focus:outline-none bg-slate-50 transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Code expires in:</span>
            <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-rose-500 animate-pulse' : 'text-slate-800'}`}>
              {formattedTime}
            </span>
          </div>

          <button
            type="submit"
            disabled={code.length !== 6 || isVerifying}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Code...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Verify & Proceed</span>
              </>
            )}
          </button>
        </form>

        {/* Resend Action */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span>Didn't receive the email?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
            <span>Resend Code</span>
          </button>
        </div>

      </div>
    </div>
  );
}
