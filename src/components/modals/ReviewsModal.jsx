import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import api from '../../services/api';
import { 
  X, 
  Star, 
  Sparkles, 
  CheckCircle, 
  MessageSquare, 
  Send, 
  ShieldCheck, 
  TrendingUp,
  Award,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function ReviewsModal() {
  const { 
    isReviewsOpen, 
    setIsReviewsOpen, 
    selectedProductForReview,
    reviews,
    addReview,
    analyzeReviewsWithAI,
    currentUser
  } = useApp();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [userName, setUserName] = useState(currentUser?.name || 'Site Engineer');
  const [geminiAnalysis, setGeminiAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [geminiError, setGeminiError] = useState('');

  if (!isReviewsOpen || !selectedProductForReview) return null;

  const prodId = selectedProductForReview.id;
  const prodReviews = reviews[prodId] || [];
  const aiReport = analyzeReviewsWithAI(prodId);

  const handleAnalyzeWithGemini = async () => {
    if (!prodReviews.length) {
      setGeminiError('Please add at least one review before analyzing with Gemini AI.');
      return;
    }
    setIsAnalyzing(true);
    setGeminiError('');
    try {
      const payload = prodReviews.map(r => ({
        product: selectedProductForReview.title,
        rating: r.rating,
        comment: r.comment,
        verifiedPurchase: r.verified
      }));
      const res = await api.analyzeReviews(payload, prodId, selectedProductForReview.title);
      setGeminiAnalysis(res);
    } catch (err) {
      setGeminiError(err.message || 'Failed to connect to Google Gemini AI service.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    addReview(prodId, {
      userName,
      rating,
      comment,
      verified: Boolean(selectedProductForReview.verifiedPurchase)
    });

    setComment('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-[#0b1b3d] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={selectedProductForReview.image}
              alt={selectedProductForReview.title}
              className="w-12 h-12 rounded-xl object-contain bg-white p-1"
            />
            <div>
              <h3 className="text-sm font-extrabold text-white line-clamp-1">
                {selectedProductForReview.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {selectedProductForReview.rating}
                </span>
                <span>•</span>
                <span>{prodReviews.length} Customer Reviews</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setIsReviewsOpen(false);
              setGeminiAnalysis(null);
              setGeminiError('');
            }}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* GEMINI AI REVIEW ANALYSIS CARD */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0a1a3c] via-blue-950 to-[#0b1b3d] text-white border border-blue-600/40 shadow-lg space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-400/30">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-100">
                      Gemini AI Review Analysis
                    </h4>
                    {geminiAnalysis?.model && (
                      <span className="bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                        {geminiAnalysis.model}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-300">
                    Grounded sentiment & engineering analysis powered by Google Gemini AI
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{aiReport.positivePercentage}% Positive</span>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyzeWithGemini}
                  disabled={isAnalyzing || prodReviews.length === 0}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold rounded-xl shadow border border-blue-400/40 flex items-center gap-1.5 transition-all"
                  title="Run Google Gemini AI analysis on customer reviews"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>{geminiAnalysis ? 'Re-Analyze AI' : '✨ Analyze with Gemini AI'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Analysis Result or Summary */}
            {geminiAnalysis ? (
              <div className="space-y-2">
                <div className="text-xs text-blue-50 leading-relaxed bg-black/30 p-3.5 rounded-xl border border-blue-400/20 shadow-inner">
                  <p>{geminiAnalysis.analysis}</p>
                  <p className="mt-2 text-[9px] text-slate-400">
                    Generated by {geminiAnalysis.model} from {geminiAnalysis.reviewCount} customer review{geminiAnalysis.reviewCount === 1 ? '' : 's'}.
                  </p>
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex items-center justify-center gap-2 text-xs text-blue-200">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Google Gemini is evaluating review feedback and quality factors...</span>
              </div>
            ) : (
              <p className="text-xs text-slate-200 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">
                "{aiReport.summary}"
              </p>
            )}

            {geminiError && (
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-[11px] text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{geminiError}</span>
              </div>
            )}

            {/* Engineering Highlights */}
            <div className="pt-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1.5">
                Key Performance Factors:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {aiReport.highlights.map((badge, idx) => (
                  <span
                    key={idx}
                    className="bg-white/10 text-white text-[10px] font-semibold px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Customer Feedback ({prodReviews.length})
            </h4>

            {prodReviews.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No contractor reviews recorded yet for this product. Be the first to evaluate!
              </div>
            ) : (
              <div className="space-y-3">
                {prodReviews.map(rev => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{rev.userName}</span>
                        {rev.verified && (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Purchase Verified
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">{rev.date}</span>
                    </div>

                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      {rev.comment}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Review Form */}
          <form onSubmit={handleSubmitReview} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600" />
              Submit Job Site Review
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name / Title</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Engr. Roberto Dalisay"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Star Rating</label>
                <div className="flex items-center gap-2 py-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-amber-600 ml-2">
                    {rating} out of 5
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Job Site Feedback & Performance Evaluation
              </label>
              <textarea
                rows={3}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe curing speed, workability, slump retention, and core drill test results..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Post Review & Update Summary</span>
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}
