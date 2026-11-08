import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export default function Toast() {
  const { toastMessage } = useApp();

  if (!toastMessage) return null;

  const { msg, type } = toastMessage;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 max-w-md ${
        type === 'success'
          ? 'bg-emerald-950 text-emerald-100 border-emerald-700/80'
          : type === 'error'
          ? 'bg-rose-950 text-rose-100 border-rose-700/80'
          : type === 'warning'
          ? 'bg-amber-950 text-amber-100 border-amber-700/80'
          : 'bg-[#0b1b3d] text-blue-100 border-[#142958]'
      }`}>
        {type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
        {type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
        {type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
        {type === 'info' && <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />}
        <span>{msg}</span>
      </div>
    </div>
  );
}

