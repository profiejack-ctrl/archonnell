import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Search, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RotateCcw,
  Star
} from 'lucide-react';

export default function OrderTrackingModal() {
  const {
    isTrackingOpen,
    setIsTrackingOpen,
    setIsRefundOpen,
    setSelectedOrderForRefund,
    orders,
    selectedOrderForTracking,
    setSelectedOrderForTracking,
    cancelOrder,
    showToast,
    openRateModal
  } = useApp();

  const [searchId, setSearchId] = useState('');
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  const [cancelReasonType, setCancelReasonType] = useState('Ordered wrong product or size');
  const [cancelOtherReason, setCancelOtherReason] = useState('');

  if (!isTrackingOpen) return null;

  // Active order displayed
  const currentOrder = (selectedOrderForTracking && orders.find(o => o.orderNumber === selectedOrderForTracking.orderNumber)) || (selectedOrderForTracking ? null : orders[0]) || null;

  const handleSearchOrder = (e) => {
    e.preventDefault();
    const found = orders.find(o => 
      o.orderNumber.toLowerCase() === searchId.trim().toLowerCase()
    );
    if (found) {
      setSelectedOrderForTracking(found);
      setSearchId('');
    } else {
      showToast('No order found matching that ID.', 'error');
    }
  };

  const handleConfirmCancel = () => {
    if (!currentOrder) return;
    if (cancelReasonType === 'Other reason') {
      const trimmed = cancelOtherReason.trim();
      if (trimmed.length < 8) {
        showToast('Other reason must be at least 8 characters.', 'warning');
        return;
      }
      if (trimmed.length > 25) {
        showToast('Other reason cannot exceed 25 characters.', 'warning');
        return;
      }
    }
    const finalReason = cancelReasonType === 'Other reason' ? cancelOtherReason.trim() : cancelReasonType;
    const ok = cancelOrder(currentOrder.orderNumber, finalReason);
    if (ok) {
      setCancelPromptOpen(false);
      setCancelReasonType('Ordered wrong product or size');
      setCancelOtherReason('');
    }
  };

  const handleOpenRefund = () => {
    setSelectedOrderForRefund(currentOrder);
    setIsTrackingOpen(false);
    setIsRefundOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-[#0b1b3d] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">5-Stage Order Tracking & Delivery Status</h3>
              <p className="text-xs text-slate-300">Demo order statuses (not live GPS or dispatch)</p>
            </div>
          </div>
          <button
            onClick={() => setIsTrackingOpen(false)}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar for Order ID */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex-shrink-0">
          <form onSubmit={handleSearchOrder} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Enter Order # (e.g. AN-ORD-2026-88412)"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
            >
              Search Order
            </button>
          </form>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!currentOrder ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No active order selected. Please enter an Order ID above.
            </div>
          ) : (
            <>
              {/* Order Meta Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black font-mono text-slate-900">
                      {currentOrder.orderNumber}
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      currentOrder.status === 'DELIVERED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : currentOrder.status === 'CANCELLED'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : currentOrder.status === 'REFUNDED' || currentOrder.status === 'REFUND_REQUESTED'
                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                        : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                      {currentOrder.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Customer: <strong>{currentOrder.customerName}</strong> • {new Date(currentOrder.date).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{currentOrder.deliveryAddress}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Dispatch Depot</div>
                  <div className="font-bold text-slate-800">Cainta Central Plant</div>
                </div>
              </div>

              {/* 5-Step Visual Tracking Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Logistics Progress Status
                </h4>

                <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
                  {currentOrder.trackingTimeline.map((step, idx) => {
                    const isDone = step.done;
                    const isCancelled = step.isCancelled;

                    return (
                      <div key={idx} className="relative">
                        {/* Dot Indicator */}
                        <div className={`absolute -left-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isCancelled
                            ? 'bg-rose-600 text-white'
                            : isDone
                            ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                            : 'bg-slate-200 text-slate-400'
                        }`}>
                          {isCancelled ? <X className="w-3.5 h-3.5" /> : isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                        </div>

                        <div className="space-y-0.5">
                          <div className={`text-xs font-bold ${
                            isCancelled ? 'text-rose-600' : isDone ? 'text-slate-900' : 'text-slate-400'
                          }`}>
                            {step.step}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {step.time}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ordered Items List */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Order Items Breakdown
                </h4>
                <div className="space-y-2">
                  {currentOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl">
                      <div>
                        <span className="font-bold text-slate-900">{item.title}</span>
                        <div className="text-[10px] text-slate-500">Qty: {item.quantity} × PHP {item.price.toLocaleString()}</div>
                      </div>
                      <span className="font-extrabold text-blue-600">
                        PHP {item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs font-bold text-slate-800 pt-2 px-2">
                  <span>Grand Total (including freight & discounts):</span>
                  <span className="text-blue-600 text-sm">
                    PHP {currentOrder.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Cancel Order & Refund Request */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-3">
                {['CONFIRMED', 'PENDING'].includes(currentOrder.status) && (
                  <button
                    onClick={() => setCancelPromptOpen(true)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Cancel Order (Restore Stocks)</span>
                  </button>
                )}

                {currentOrder.status === 'DELIVERED' && (
                  <button
                    onClick={handleOpenRefund}
                    className="px-4 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-4 h-4 text-purple-600" />
                    <span>Request Refund / Return</span>
                  </button>
                )}
              </div>

              {/* Cancel Confirmation Prompt */}
              {cancelPromptOpen && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Confirm Order Cancellation</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    Cancelling this order will <strong>automatically restore all purchased quantities to active warehouse inventory</strong>.
                  </p>
                  <div>
                    <label className="block text-[11px] font-semibold text-rose-900 mb-1">
                      Reason for Cancellation: *
                    </label>
                    <select
                      value={cancelReasonType}
                      onChange={(e) => {
                        setCancelReasonType(e.target.value);
                        if (e.target.value !== 'Other reason') {
                          setCancelOtherReason('');
                        }
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-rose-300 rounded-lg focus:outline-none"
                    >
                      <option value="Ordered wrong product or size">Ordered wrong product or size</option>
                      <option value="Job site schedule delayed">Job site schedule delayed</option>
                      <option value="Found lower price elsewhere">Found lower price elsewhere</option>
                      <option value="Change of project plans">Change of project plans</option>
                      <option value="Incorrect shipping address">Incorrect shipping address</option>
                      <option value="Other reason">Other reason</option>
                    </select>
                  </div>

                  {cancelReasonType === 'Other reason' && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <label className="font-semibold text-rose-900">
                          Specify Reason (8–25 characters): *
                        </label>
                        <span className={`text-[10px] font-mono ${
                          cancelOtherReason.trim().length >= 8 && cancelOtherReason.trim().length <= 25
                            ? 'text-emerald-700 font-bold'
                            : cancelOtherReason.length > 0
                            ? 'text-amber-700 font-bold'
                            : 'text-slate-500'
                        }`}>
                          {cancelOtherReason.length}/25 (min 8)
                        </span>
                      </div>
                      <input
                        type="text"
                        minLength={8}
                        maxLength={25}
                        value={cancelOtherReason}
                        onChange={(e) => setCancelOtherReason(e.target.value.slice(0, 25))}
                        placeholder="Enter 8 to 25 characters"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-rose-300 rounded-lg focus:outline-none"
                      />
                      {cancelOtherReason.length > 0 && cancelOtherReason.trim().length < 8 && (
                        <p className="text-[10px] text-rose-600 font-medium">
                          Must be at least 8 characters ({8 - cancelOtherReason.trim().length} more needed).
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmCancel}
                      disabled={cancelReasonType === 'Other reason' && (cancelOtherReason.trim().length < 8 || cancelOtherReason.trim().length > 25)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm Cancellation & Restore Stock
                    </button>
                    <button
                      onClick={() => {
                        setCancelPromptOpen(false);
                        setCancelReasonType('Ordered wrong product or size');
                        setCancelOtherReason('');
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
                    >
                      Keep Order
                    </button>
                  </div>
                </div>
              )}

            </>
          )}
        </div>

      </div>
    </div>
  );
}
