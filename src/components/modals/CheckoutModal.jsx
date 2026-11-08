import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  CreditCard, 
  Lock, 
  Mail, 
  Building
} from 'lucide-react';

export default function CheckoutModal() {
  const {
    isCheckoutOpen,
    setIsCheckoutOpen,
    setIsTrackingOpen,
    setSelectedOrderForTracking,
    cart,
    cartSubtotal,
    effectiveDiscount,
    discountType,
    shippingFee,
    cartWeightKg,
    shippingTierCount,
    finalTotal,
    createOrder,
    currentUser,
    triggerOtp,
    setOtpState,
    showToast,
    setIsAuthOpen
  } = useApp();

  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  
  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [gcashRefNumber, setGcashRefNumber] = useState('');
  const [proofImage, setProofImage] = useState(null);
  const [proofImagePreview, setProofImagePreview] = useState(null);
  const [refError, setRefError] = useState('');

  // Email verification status
  const [verifiedEmail, setVerifiedEmail] = useState('');

  useEffect(() => {
    if (!isCheckoutOpen) return;
    setCustomerName(currentUser?.name || '');
    setCustomerEmail(currentUser?.email || '');
    setCustomerPhone(currentUser?.phone || '');
    setDeliveryAddress('');
    setDeliveryNotes('');
    setPaymentMethod('COD');
    setGcashRefNumber('');
    setProofImage(null);
    setProofImagePreview(null);
    setVerifiedEmail('');
    setRefError('');
    setOtpState(prev => ({ ...prev, isVerified: false, isOpen: false, email: '' }));
  }, [isCheckoutOpen]); // reset the checkout form for each new demo order


  if (!isCheckoutOpen || currentUser?.role === 'admin') return null;

  if (!currentUser) {
    return null;
  }

  // Handle GCash Ref Number change with strict 13-digit fixed requirement
  const handleGcashRefChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); // digits only
    if (val.length <= 13) {
      setGcashRefNumber(val);
      if (val.length > 0 && val.length !== 13) {
        setRefError('The GCash Reference Number must be exactly 13 digits.');
      } else {
        setRefError('');
      }
    }
  };

  // Handle proof screenshot upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/') || file.size > 600 * 1024) {
        showToast('Please upload an image smaller than 2 MB.', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result);
        setProofImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger on-screen demo OTP (never sends an email)
  const handleSendOtp = () => {
    if (!customerEmail || !customerEmail.includes('@')) {
      showToast('Please enter a valid email address.', 'warning');
      return;
    }
    triggerOtp(customerEmail, () => {
      setVerifiedEmail(customerEmail.trim().toLowerCase());
    });
  };

  const handleSubmitOrder = (e) => {
    e.preventDefault();

    if (!cart.length) { showToast('Your cart is empty.', 'warning'); return; }
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      showToast('Please complete all required delivery details.', 'warning');
      return;
    }

    // Require Email OTP verification
    if (verifiedEmail !== customerEmail.trim().toLowerCase()) {
      showToast('Please complete the email OTP verification step before placing your order.', 'warning');
      handleSendOtp();
      return;
    }

    // Frontend-only format validation. No transaction reference is confirmed against a payment service.
    if (paymentMethod === 'GCash') {
      if (gcashRefNumber.length !== 13) {
        setRefError('GCash Reference Number must be exactly 13 digits (e.g. 1234567890123).');
        showToast('Invalid GCash Reference Number format (13 digits required).', 'error');
        return;
      }

    }

    // Maya sample field validation
    if (paymentMethod === 'Maya' && !gcashRefNumber.trim()) {
      showToast('Please enter your Maya reference number.', 'warning');
      return;
    }

    const orderData = {
      customerName,
      customerEmail,
      customerPhone,
      deliveryAddress,
      deliveryNotes,
      paymentMethod,
      gcashRefNumber,
      proofImage,
      items: cart.map(item => ({
        id: item.product.id,
        title: item.product.title,
        price: item.product.price,
        quantity: item.quantity,
        total: item.product.price * item.quantity
      })),
      subtotal: cartSubtotal,
      shippingFee,
      discountAmount: effectiveDiscount,
      discountType,
      totalAmount: finalTotal
    };

    const newOrder = createOrder(orderData);
    if (newOrder) {
      setIsCheckoutOpen(false);
      setOtpState(prev => ({ ...prev, isVerified: false, isOpen: false }));
      setSelectedOrderForTracking(newOrder);
      setIsTrackingOpen(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 bg-[#0b1b3d] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Archon Nell Industrial Checkout Preview</h3>
              <p className="text-xs text-slate-300">Frontend prototype — no payment is processed or order transmitted</p>
            </div>
          </div>
          <button
            onClick={() => setIsCheckoutOpen(false)}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 1. Customer & Delivery Information */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              1. Customer & Job Site Delivery Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name / Contractor In-Charge *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+63 917 123 4567"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Email with OTP Verification Badge */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address *
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => {
                    setCustomerEmail(e.target.value);
                    setVerifiedEmail('');
                  }}
                  placeholder="contractor@company.com"
                  className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    verifiedEmail === customerEmail.trim().toLowerCase() && !!customerEmail.trim()
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow'
                  }`}
                >
                  {verifiedEmail === customerEmail.trim().toLowerCase() && !!customerEmail.trim() ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Verify Email</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                A 6-digit verification code will be dispatched to your email via Brevo SMTP.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Delivery Address / Job Site Depot *
              </label>
              <textarea
                required
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="National Highway km 42, Cainta / San Simon Project Depot, Gate 2..."
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Special Delivery Notes / Unloading Instructions (Optional)
              </label>
              <input
                type="text"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Heavy pallet crane unloading required, Call before delivery"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 2. Payment Method Selection */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              2. Payment Method
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'GCash', label: 'GCash', sub: 'UI Preview' },
                { id: 'Maya', label: 'Maya', sub: 'UI Preview' },
                { id: 'Bank', label: 'Bank Transfer', sub: 'UI Preview' },
                { id: 'COD', label: 'Cash on Delivery', sub: 'Pay on Arrival' }
              ].map(method => (
                <button
                  type="button"
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentMethod === method.id
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">{method.label}</div>
                  <div className="text-[10px] text-slate-500">{method.sub}</div>
                </button>
              ))}
            </div>

            {/* GCash Payment Details Section */}
            {paymentMethod === 'GCash' && (
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-blue-100">
                  <div className="w-32 h-32 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-center px-3 text-[11px] font-bold text-slate-500">Official Archon Nell QR</div>
                  <div className="space-y-2 text-xs">
                    <span className="bg-blue-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded">GCASH UI SAMPLE</span>
                    <h5 className="font-bold text-slate-900 text-sm">GCash Payment Layout</h5>
                    <p className="text-slate-600">Account details, QR codes, and payment verification require a backend/payment integration. Do not send real money.</p>
                  </div>
                </div>

                {/* Strict 13-digit Reference Number */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-800">
                      Sample 13-Digit GCash Reference * <span className="text-rose-500">(Fixed Format Required)</span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-500">
                      {gcashRefNumber.length} / 13 digits
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={gcashRefNumber}
                    onChange={handleGcashRefChange}
                    maxLength={13}
                    placeholder="e.g. 1234567890123"
                    className={`w-full px-3.5 py-2.5 text-xs font-mono bg-white border rounded-xl focus:outline-none ${
                      refError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-blue-500'
                    }`}
                  />
                  {refError && (
                    <p className="text-xs text-rose-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {refError}
                    </p>
                  )}
                </div>

                {/* Proof of Account / Payment Screenshot Upload */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Upload Sample Screenshot (optional; do not upload real payment data)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer px-4 py-2.5 bg-white border border-dashed border-blue-400 hover:border-blue-600 text-blue-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
                      <Upload className="w-4 h-4" />
                      <span>Select Screenshot File</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    {proofImagePreview && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Screenshot uploaded</span>
                      </div>
                    )}
                  </div>

                  {proofImagePreview && (
                    <div className="mt-2 p-2 bg-white rounded-xl border border-slate-200 inline-block">
                      <img
                        src={proofImagePreview}
                        alt="Proof Preview"
                        className="h-28 w-auto rounded object-contain"
                      />
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Maya Payment Section */}
            {paymentMethod === 'Maya' && (
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-emerald-100">
                  <div className="w-32 h-32 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-center px-3 text-[11px] font-bold text-slate-500">Official Archon Nell QR</div>
                  <div className="space-y-2 text-xs">
                    <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded">MAYA UI SAMPLE</span>
                    <h5 className="font-bold text-slate-900 text-sm">Maya Payment Layout</h5>
                    <p className="text-slate-600">Account details, QR codes, and payment verification require a backend/payment integration. Do not send real money.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Maya Reference Number (sample) *
                  </label>
                  <input
                    type="text"
                    required
                    value={gcashRefNumber}
                    onChange={(e) => setGcashRefNumber(e.target.value)}
                    placeholder="Enter Maya Reference Number"
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-none"
                  />
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-dashed border-emerald-400 text-emerald-700 rounded-xl text-xs font-bold">
                    <Upload className="w-4 h-4" />
                    <span>Upload Sample Screenshot (optional)</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {/* Bank Transfer Section */}
            {paymentMethod === 'Bank' && (
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 space-y-3 text-xs">
                <h5 className="font-bold text-slate-900">Bank Transfer UI Preview</h5>
                <p className="bg-white rounded-xl border border-slate-200 p-3 text-slate-600">Direct BDO / BPI bank transfer details. Please upload your proof of deposit.</p>
              </div>
            )}

            {/* COD Section */}
            {paymentMethod === 'COD' && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold">Cash On Delivery (Cainta / Rizal / Metro Manila Sites)</div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  This is a checkout preview only. No physical delivery or cash collection is scheduled.
                </p>
              </div>
            )}

          </div>

          {/* 3. Order Summary & Price Computation Breakdown */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              3. Order Summary & Price Computation
            </h4>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items Subtotal ({cart.length} unique products)</span>
                <span className="font-semibold text-slate-800">
                  PHP {cartSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Applied Discount ({discountType || '20% OFF / Bulky'})</span>
                  <span className="font-bold">
                    -PHP {effectiveDiscount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Plant Logistics / Shipping Fee</span>
                <span className="font-semibold text-slate-800">
                  {shippingFee === 0 ? (
                    <span className="text-emerald-600 font-bold">FREE SHIPPING</span>
                  ) : (
                    `PHP ${shippingFee.toFixed(2)}`
                  )}
                </span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500">Estimated delivery weight: {cartWeightKg.toLocaleString()} kg ({shippingTierCount} × 1,000 kg tier). Fee is PHP 500 per 1,000 kg or part thereof; each additional 1,000 kg adds PHP 500. Package weights are estimates.</p>

              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total</span>
                <span className="text-blue-600 text-lg">
                  PHP {finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex-shrink-0">
            <button
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Confirm & Place Order</span>
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              Your order is recorded and synchronized directly with Archon Nell logistics & warehouse dispatch.
            </p>
          </div>

        </form>

      </div>
    </div>
  );
}
