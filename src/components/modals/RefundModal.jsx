import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, RotateCcw, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function RefundModal() {
  const {
    isRefundOpen,
    setIsRefundOpen,
    selectedOrderForRefund,
    requestRefund,
    showToast
  } = useApp();

  const [reason, setReason] = useState('Damaged packaging during transit');
  const [details, setDetails] = useState('');
  const [damagePhoto, setDamagePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  if (!isRefundOpen || !selectedOrderForRefund) return null;

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/') || file.size > 600 * 1024) {
        showToast('Please use a demo image smaller than 600 KB.', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setDamagePhoto(reader.result);
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitRefund = (e) => {
    e.preventDefault();
    if (!damagePhoto) {
      showToast('A photograph of the damaged seal or defective packaging is required.', 'warning');
      return;
    }

    const ok = requestRefund(selectedOrderForRefund.orderNumber, { reason, damagePhoto, details });
    if (ok) setIsRefundOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 bg-[#0b1b3d] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-xl">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Refund / Return Inspection Claim</h3>
              <p className="text-xs text-slate-300">Order #{selectedOrderForRefund.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={() => setIsRefundOpen(false)}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmitRefund} className="p-6 space-y-4">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <span>
              This is a frontend-only claim preview. A real review team, returns policy, and refund processing must be connected by the backend team.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Return / Refund Claim *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
            >
              <option value="Damaged packaging during transit">Damaged bag / leaking drum during transit</option>
              <option value="Incorrect mortar / admixture batch">Incorrect mortar or admixture batch variant delivered</option>
              <option value="Moisture clumped cementitious powder">Hardened powder / clumped due to moisture exposure</option>
              <option value="Job site project cancellation">Approved contractor job site cancellation</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Upload Damage Proof / Defect Photo *
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer px-4 py-2.5 bg-slate-50 border border-dashed border-purple-400 hover:border-purple-600 text-purple-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>Select Photo File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
              {photoPreview && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Photo attached
                </span>
              )}
            </div>

            {photoPreview && (
              <div className="mt-2 p-2 bg-slate-100 rounded-xl border border-slate-200 inline-block">
                <img src={photoPreview} alt="Damage Proof" className="h-28 w-auto rounded object-contain" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Details & Job Site Remarks
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe condition of seals, packaging, or product batch numbers upon depot arrival..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
            <span className="text-slate-600">Requested Demo Amount:</span>
            <span className="text-purple-700 font-black text-sm">
              PHP {selectedOrderForRefund.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Submit Return / Refund Claim</span>
          </button>
        </form>

      </div>
    </div>
  );
}
