import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Tag, 
  Check, 
  Truck,
  ArrowRight,
  ShieldCheck,
  TrendingDown
} from 'lucide-react';

export default function CartDrawer() {
  const {
    isCartOpen,
    setIsCartOpen,
    setIsCheckoutOpen,
    cart,
    updateCartQuantity,
    removeFromCart,
    cartSubtotal,
    totalItemCount,
    isBulkyOrder,
    bulkyDiscountAmount,
    appliedVoucher,
    applyVoucher,
    removeVoucher,
    effectiveDiscount,
    discountType,
    shippingFee,
    cartWeightKg,
    shippingTierCount,
    finalTotal,
    currentUser,
    setIsAuthOpen,
    showToast
  } = useApp();

  const [inputCode, setInputCode] = useState('');

  if (!isCartOpen || currentUser?.role === 'admin') return null;

  const handleApplyVoucher = (e) => {
    e.preventDefault();
    if (!inputCode) return;
    applyVoucher(inputCode);
    setInputCode('');
  };

  const handleProceedToCheckout = () => {
    if (cart.length === 0) return;
    if (!currentUser) {
      showToast('Please sign in to your account first before checking out.', 'warning');
      setIsCartOpen(false);
      setIsAuthOpen(true);
      return;
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
      ></div>

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          
          {/* Header */}
          <div className="p-6 bg-[#0b1b3d] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Your Shopping Cart</h3>
                <p className="text-xs text-slate-300">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} in cart
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bulky Discount Banner */}
          {isBulkyOrder && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-800">
              <TrendingDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Bulky Contractor Discount Active:</strong> Automatic 10% volume discount applied (-PHP {bulkyDiscountAmount.toLocaleString()}).
              </span>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">Your Cart is Empty</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Explore our industrial catalog and select construction materials.
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl shadow hover:bg-blue-700"
                >
                  Browse Products
                </button>
              </div>
            ) : (
              cart.map(item => {
                const maxStock = item.product.stock;
                const isMax = item.quantity >= maxStock;

                return (
                  <div
                    key={item.product.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex gap-4 items-center"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.title}
                      className="w-16 h-16 object-contain bg-white rounded-lg p-1 border border-slate-200 flex-shrink-0"
                    />

                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                        {item.product.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-blue-600">
                          PHP {item.product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          (Stock: {maxStock})
                        </span>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 hover:bg-slate-100 text-slate-600"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-bold text-slate-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            disabled={isMax}
                            className={`p-1 text-slate-600 ${isMax ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100'}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Computations & Checkout */}
          {cart.length > 0 && (
            <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
              
              {/* Voucher Code Input */}
              <div>
                <form onSubmit={handleApplyVoucher} className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value)}
                      placeholder="ARCHON20 / FREESHIP"
                      className="w-full pl-9 pr-3 py-2 text-xs uppercase bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all"
                  >
                    Apply
                  </button>
                </form>

                {/* Applied voucher pill */}
                {appliedVoucher && (
                  <div className="mt-2 flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs text-emerald-800">
                    <span className="font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Voucher Applied: {appliedVoucher} ({discountType})
                    </span>
                    <button
                      onClick={removeVoucher}
                      className="text-emerald-700 hover:text-rose-600 font-bold text-xs"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 text-xs pt-2 border-t border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({totalItemCount} items)</span>
                  <span className="font-semibold text-slate-900">
                    PHP {cartSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {effectiveDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount ({discountType || 'Promo'})</span>
                    <span className="font-bold">
                      -PHP {effectiveDiscount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    Direct Cainta Logistics / Delivery Fee
                  </span>
                  <span className="font-semibold text-slate-900">
                    {shippingFee === 0 ? (
                      <span className="text-emerald-600 font-bold">FREE</span>
                    ) : (
                      `PHP ${shippingFee.toFixed(2)}`
                    )}
                  </span>
                </div>
                <p className="-mt-1 text-[10px] leading-relaxed text-slate-500">Estimated order weight: {cartWeightKg.toLocaleString()} kg ({shippingTierCount} × 1,000 kg tier). Delivery is PHP 500 per 1,000 kg or part thereof; each additional 1,000 kg adds PHP 500. Package weights are estimates.</p>

                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Amount</span>
                  <span className="text-blue-600 text-lg">
                    PHP {finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <span>Proceed to Industrial Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>GCash, Maya, Bank & COD Demo Layouts</span>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
