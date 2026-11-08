import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import api from '../../services/api';
import { AlertCircle, Loader2, MessageSquareQuote, ShieldCheck, Sparkles, Star } from 'lucide-react';

export default function ReviewsSection() {
  const { reviews, products, setSelectedProductForReview, setIsReviewsOpen } = useApp();
  const [selectedProductId, setSelectedProductId] = useState('all');
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const allReviews = Object.entries(reviews || {}).flatMap(([productId, entries]) => {
    const product = products.find(item => item.id === productId || item.customId === productId || item._id === productId);
    return (entries || []).map(review => ({ ...review, productId, productTitle: product?.title || 'Product review' }));
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
  const visibleReviews = allReviews.slice(0, 6);
  const selectedReviews = selectedProductId === 'all'
    ? allReviews
    : allReviews.filter(review => String(review.productId) === selectedProductId || String(review.customId) === selectedProductId);
  const totalReviewCount = allReviews.length;
  const averageRating = totalReviewCount
    ? (allReviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / totalReviewCount).toFixed(1)
    : '0.0';

  const openProductReviews = productId => {
    const product = products.find(item => item.id === productId);
    if (!product) return;
    setSelectedProductForReview(product);
    setIsReviewsOpen(true);
  };

  const analyzeReviews = async () => {
    setIsAnalyzing(true);
    setAnalysisError('');
    try {
      const reviewPayload = selectedReviews.slice(0, 50).map(review => ({
        product: review.productTitle,
        rating: review.rating,
        comment: review.comment,
        verifiedPurchase: review.verified,
      }));
      const selectedProduct = products.find(p => String(p.id) === String(selectedProductId));
      const targetTitle = selectedProduct ? selectedProduct.title : (selectedProductId === 'all' ? 'All Archon Nell Products' : 'Product Reviews');
      const result = await api.analyzeReviews(reviewPayload, selectedProductId !== 'all' ? selectedProductId : null, targetTitle);
      setAnalysis(result);
    } catch (error) {
      setAnalysisError(error.message || 'Could not reach the Gemini review service.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section id="reviews" className="border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-blue-800"><MessageSquareQuote size={13} />Product feedback</span>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Reviews from our customers</h2>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-600 sm:text-sm">Feedback shared by customers about products in their projects. Reviews are customer opinions, not independent technical certifications.</p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:self-auto">
            <div className="flex items-center gap-1 text-amber-500"><Star size={20} fill="currentColor" /><strong className="text-xl text-slate-900">{averageRating}</strong></div>
            <div className="border-l border-slate-200 pl-3"><div className="text-xs font-bold text-slate-800">Overall rating</div><div className="text-[10px] text-slate-500">{totalReviewCount} review{totalReviewCount === 1 ? '' : 's'}</div></div>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5" aria-live="polite">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Sparkles size={18} /></div><div className="min-w-0 flex-1"><h3 className="text-sm font-extrabold text-slate-900">AI review analysis</h3><p className="mt-1 text-[10px] text-slate-500">Gemini summarizes up to 50 recent reviews for the selected product.</p><label className="mt-3 flex flex-col gap-1 text-[10px] font-bold text-slate-600 sm:max-w-sm">Analyze reviews for<select value={selectedProductId} onChange={event => { setSelectedProductId(event.target.value); setAnalysis(null); setAnalysisError(''); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="all">All products ({allReviews.length} reviews)</option>{products.map(product => { const count = allReviews.filter(review => String(review.productId) === String(product.id) || String(review.productId) === String(product.customId)).length; return <option key={product.id} value={String(product.id)}>{product.title} ({count} review{count === 1 ? '' : 's'})</option>; })}</select></label><p className="mt-1 text-[10px] text-slate-500">{selectedReviews.length} review{selectedReviews.length === 1 ? '' : 's'} available for analysis.</p></div></div>
            <button type="button" onClick={analyzeReviews} disabled={isAnalyzing || selectedReviews.length === 0} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{isAnalyzing ? <><Loader2 size={14} className="animate-spin" />Analyzing…</> : <><Sparkles size={14} />Analyze with Gemini</>}</button>
          </div>
          {analysis && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4"><p className="text-sm leading-relaxed text-slate-800">{analysis.analysis}</p><p className="mt-2 text-[9px] text-slate-500">Generated by {analysis.model} from {analysis.reviewCount} review{analysis.reviewCount === 1 ? '' : 's'}. AI summary may be imperfect.</p></div>}
          {analysisError && <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle size={15} className="mt-0.5 shrink-0" />{analysisError}</p>}
          {!analysis && !analysisError && <p className="mt-3 text-[9px] text-slate-400">Only runs when clicked. Up to 50 review comments and ratings for the selected product are sent to Google Gemini. Free-tier availability and quota depend on your AI Studio account and region.</p>}
        </section>

        {visibleReviews.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleReviews.map(review => <article key={review.id} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>{[1,2,3,4,5].map(star => <Star key={star} size={13} fill={star <= review.rating ? 'currentColor' : 'none'} className={star <= review.rating ? 'text-amber-400' : 'text-slate-300'} />)}</div>{review.verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700"><ShieldCheck size={11} />Verified purchase</span>}</div>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">“{review.comment}”</p>
            <div className="mt-5 border-t border-slate-100 pt-3"><div className="flex items-center justify-between gap-2"><strong className="truncate text-xs text-slate-900">{review.userName}</strong><time className="shrink-0 text-[10px] text-slate-400">{new Date(review.date).toLocaleDateString()}</time></div><button type="button" onClick={() => openProductReviews(review.productId)} className="mt-2 inline-flex max-w-full items-center gap-1.5 text-left text-[10px] font-bold text-blue-700 hover:text-blue-900"><Sparkles size={12} className="shrink-0" /><span className="truncate">{review.productTitle}</span></button></div>
          </article>)}
        </div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No product reviews yet.</div>}
      </div>
    </section>
  );
}
