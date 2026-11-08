import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Star, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  PackageCheck,
  Send
} from 'lucide-react';

export default function RateOrderModal() {
  const {
    isRateModalOpen,
    setIsRateModalOpen,
    selectedOrderForRating,
    rateDeliveredOrder
  } = useApp();

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (selectedOrderForRating) {
      setRating(selectedOrderForRating.rating || 5);
      setNotes(selectedOrderForRating.notes || '');
      setErrorMessage('');
    }
  }, [selectedOrderForRating, isRateModalOpen]);

  if (!isRateModalOpen || !selectedOrderForRating) return null;

  const currentLength = notes.length;
  const trimmedLength = notes.trim().length;
  const isValidLength = trimmedLength >= 15 && currentLength <= 60;

  const getStarLabel = (stars) => {
    switch (stars) {
      case 5: return '5/5 Stars · Excellent Product & Delivery';
      case 4: return '4/5 Stars · Very Good Quality';
      case 3: return '3/5 Stars · Met Expectations';
      case 2: return '2/5 Stars · Needs Improvement';
      case 1: return '1/5 Stars · Unsatisfactory';
      default: return 'Select your rating';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (trimmedLength < 15) {
      setErrorMessage(`Notes must be at least 15 letters. You currently have ${trimmedLength} letters.`);
      return;
    }

    if (currentLength > 60) {
      setErrorMessage('Notes cannot exceed 60 letters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await rateDeliveredOrder(selectedOrderForRating.orderNumber, {
        rating,
        notes: notes.trim()
      });
      if (success) {
        setIsRateModalOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 bg-[#0b1b3d] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-2xl border border-amber-400/30 text-amber-300">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Rate Delivered Order</h3>
              <p className="text-xs text-slate-300 font-mono">
                Order #{selectedOrderForRating.orderNumber}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsRateModalOpen(false)}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>Delivered Items:</span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
              {(selectedOrderForRating.items || []).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-[11px] text-slate-600">
                  <span className="truncate pr-2 font-medium">• {item.title}</span>
                  <span className="shrink-0 font-bold text-slate-700">×{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Select Rating (1 to 5 Stars) *
            </label>
            <div className="flex items-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating || rating) >= star;
                return (
                  <button
                    type="button"
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                    aria-label={`Rate ${star} star`}
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_4px_rgba(251,191,36,0.4)]'
                          : 'text-slate-300 hover:text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <div className="text-xs font-semibold text-amber-700">
              {getStarLabel(hoverRating || rating)}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Feedback Notes *</span>
              </label>
              <span className={`text-[11px] font-mono font-bold ${
                isValidLength 
                  ? 'text-emerald-600' 
                  : currentLength > 0 
                  ? 'text-amber-600' 
                  : 'text-slate-400'
              }`}>
                {currentLength}/60 letters (min 15)
              </span>
            </div>

            <textarea
              rows={3}
              required
              maxLength={60}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value.slice(0, 60));
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="e.g. Rapid curing and high slump performance on our job site."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
            />
            <div className="text-[11px]">
              {trimmedLength === 0 && (
                <p className="text-slate-500">
                  Please enter notes between 15 to 60 letters describing your product experience.
                </p>
              )}
              {trimmedLength > 0 && trimmedLength < 15 && (
                <p className="text-amber-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{15 - trimmedLength} more letter{15 - trimmedLength === 1 ? '' : 's'} needed to reach the 15-letter minimum.</span>
                </p>
              )}
              {isValidLength && (
                <p className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valid note length ({currentLength}/60 letters).</span>
                </p>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-2 text-[10px] text-blue-900">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Your rating updates this delivered order and feeds into our Gemini AI product analysis.
            </span>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!isValidLength || isSubmitting}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving Rating...' : selectedOrderForRating.rating ? 'Update Rating' : 'Submit Rating'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRateModalOpen(false)}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
