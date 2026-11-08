import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  AlertTriangle, ArrowLeft, Bell, BookOpen, ChevronRight, CircleHelp, CreditCard,
  Download, Heart, LogOut, MapPin, Package, Plus, RotateCcw, Search,
  Settings, ShieldAlert, ShieldCheck, ShoppingBag, Star, Truck, UserRound, Wallet, X
} from 'lucide-react';

const panelClass = 'rounded-2xl border border-[#142958] bg-[#0b1b3d] p-4 shadow-lg sm:p-6';
const inputClass = 'w-full rounded-xl border border-[#142958] bg-[#07132c] px-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500';
const formatMoney = value => `PHP ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export default function CustomerView() {
  const {
    currentUser, setCurrentView, logoutUser, orders, products, addToCart,
    cancelOrder, setSelectedOrderForTracking, setIsTrackingOpen,
    setSelectedOrderForRefund, setIsRefundOpen, setIsCsOpen,
    updateUserProfile, showToast,
    setSelectedProductForReview, setIsReviewsOpen, openRateModal
  } = useApp();

  const [activeSection, setActiveSection] = useState('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReasonType, setCancelReasonType] = useState('Ordered wrong product or size');
  const [cancelOtherReason, setCancelOtherReason] = useState('');
  const [profileDraft, setProfileDraft] = useState({
    name: currentUser?.name || '', email: currentUser?.email || '',
    phone: currentUser?.phone || '', company: currentUser?.company || ''
  });
  const storagePrefix = `archon-customer-${currentUser?.id || 'guest'}`;
  const readLocal = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(`${storagePrefix}-${key}`)) ?? fallback; }
    catch { return fallback; }
  };
  const [addresses, setAddresses] = useState(() => readLocal('addresses', []));
  const [wishlist, setWishlist] = useState(() => readLocal('wishlist', []));
  const [addressDraft, setAddressDraft] = useState({ label: '', address: '' });
  const [preferences, setPreferences] = useState(() => readLocal('preferences', { emailNews: true, smsUpdates: true, marketing: false }));
  const [billingPreference, setBillingPreference] = useState(currentUser?.billingPreference || 'standard');

  const knownEmails = [currentUser?.email, ...(currentUser?.previousEmails || [])].filter(Boolean).map(email => email.toLowerCase());
  const customerOrders = orders.filter(order =>
    !knownEmails.length || knownEmails.includes((order.customerEmail || '').toLowerCase())
  );
  const filteredOrders = customerOrders.filter(order => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || order.orderNumber.toLowerCase().includes(query) ||
      (order.items || []).some(item => item.title.toLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'all' || order.status === statusFilter);
  });
  const activeOrders = customerOrders.filter(order => ['CONFIRMED', 'PREPARING', 'IN_TRANSIT'].includes(order.status));
  const purchasedTotal = customerOrders.filter(order => !['CANCELLED', 'REFUNDED'].includes(order.status)).reduce((sum, order) => sum + order.totalAmount, 0);
  const rewardPoints = Math.floor(purchasedTotal / 100);
  const rewardTier = rewardPoints >= 10000 ? 'Platinum' : rewardPoints >= 3000 ? 'Gold' : rewardPoints >= 500 ? 'Silver' : 'Member';
  const customerProducts = products.filter(product => wishlist.includes(product.id));
  const sections = [
    { id: 'overview', label: 'Overview', icon: UserRound },
    { id: 'orders', label: 'Orders & returns', icon: Package, count: customerOrders.length },
    { id: 'profile', label: 'Profile & addresses', icon: Settings },
    { id: 'rewards', label: 'Rewards & wishlist', icon: Star },
    { id: 'support', label: 'Help & preferences', icon: CircleHelp },
  ];

  const saveAddresses = next => { setAddresses(next); localStorage.setItem(`${storagePrefix}-addresses`, JSON.stringify(next)); };
  const saveWishlist = next => { setWishlist(next); localStorage.setItem(`${storagePrefix}-wishlist`, JSON.stringify(next)); };
  const savePreferences = next => { setPreferences(next); localStorage.setItem(`${storagePrefix}-preferences`, JSON.stringify(next)); };

  const openTracking = order => {
    setSelectedOrderForTracking(order);
    setIsTrackingOpen(true);
  };
  const openRefund = order => {
    setSelectedOrderForRefund(order);
    setIsRefundOpen(true);
  };
  const openProductReview = item => {
    const product = products.find(candidate => candidate.id === item.id);
    if (!product) {
      showToast('This product is no longer available for review.', 'warning');
      return;
    }
    setSelectedProductForReview({ ...product, verifiedPurchase: true });
    setIsReviewsOpen(true);
  };
  const reorder = order => {
    let added = 0;
    (order.items || []).forEach(item => {
      const product = products.find(candidate => candidate.id === item.id);
      if (product && product.stock >= item.quantity) {
        addToCart(product, item.quantity);
        added += 1;
      }
    });
    if (!added) showToast('These items are unavailable or no longer in stock.', 'warning');
    else showToast(`${added} item${added === 1 ? '' : 's'} added to your cart.`, 'success');
  };
  const downloadInvoice = order => {
    const rows = (order.items || []).map(item => `<tr><td>${escapeHtml(item.title)}</td><td>${item.quantity}</td><td>${formatMoney(item.total ?? item.price * item.quantity)}</td></tr>`).join('');
    const invoice = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(order.orderNumber)}</title><style>body{font:14px Arial,sans-serif;color:#172033;padding:40px;max-width:800px;margin:auto}h1{color:#102750}table{border-collapse:collapse;width:100%;margin-top:24px}td,th{text-align:left;padding:12px;border-bottom:1px solid #dbe2ef}</style></head><body><h1>Archon Nell · Order Invoice</h1><p>Order ${escapeHtml(order.orderNumber)} · ${new Date(order.date).toLocaleDateString()}</p><p>${escapeHtml(order.customerName)}<br>${escapeHtml(order.customerEmail)}<br>${escapeHtml(order.deliveryAddress)}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><h2>Total: ${formatMoney(order.totalAmount)}</h2><p>Official Customer Invoice.</p></body></html>`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([invoice], { type: 'text/html' }));
    link.download = `invoice-${order.orderNumber}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  const printReturnLabel = order => {
    const popup = window.open('', '_blank', 'width=700,height=600');
    if (!popup) { showToast('Allow pop-ups to print this return label.', 'warning'); return; }
    popup.document.write(`<html><head><title>Return label ${escapeHtml(order.orderNumber)}</title><style>body{font:16px Arial;padding:40px}.label{border:2px dashed #222;padding:28px;max-width:500px}h1{font-size:20px}</style></head><body><div class="label"><h1>RETURN REQUEST</h1><p>From: ${escapeHtml(order.customerName)}</p><p>${escapeHtml(order.deliveryAddress)}</p><p>Order: ${escapeHtml(order.orderNumber)}</p><p>Official Archon Nell Return Authorization (RMA) Label.</p></div></body></html>`);
    popup.document.close(); popup.focus(); popup.print();
  };
  const submitProfile = event => {
    event.preventDefault();
    const previousEmails = currentUser?.email && currentUser.email.toLowerCase() !== profileDraft.email.toLowerCase()
      ? [...new Set([...(currentUser.previousEmails || []), currentUser.email])]
      : currentUser?.previousEmails || [];
    updateUserProfile({ ...profileDraft, billingPreference, previousEmails });
    showToast('Profile updated successfully.', 'success');
  };

  const consentGranted = currentUser?.privacyConsent ? currentUser.privacyConsent.granted !== false : true;

  const togglePrivacyConsent = async () => {
    const nextState = !consentGranted;
    await updateUserProfile({
      privacyConsent: {
        granted: nextState,
        consentedAt: new Date().toISOString(),
        policyVersion: 'RA10173-2026.1'
      }
    });
    if (nextState) {
      showToast('Data Privacy Consent granted under RA 10173.', 'success');
    } else {
      showToast('Data Privacy Consent withheld. Personal contact details masked in admin views.', 'info');
    }
  };

  const submitAddress = event => {
    event.preventDefault();
    if (!addressDraft.label.trim() || !addressDraft.address.trim()) return;
    saveAddresses([...addresses, { id: `${Date.now()}`, ...addressDraft }]);
    setAddressDraft({ label: '', address: '' });
  };

  return (
    <div className="min-h-screen bg-[#07132c] px-3 py-4 text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto grid max-w-[1500px] items-start gap-5 lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[#142958] bg-[#0b1b3d] p-4 lg:sticky lg:top-6">
          <div className="mb-5 hidden items-center gap-3 border-b border-[#142958] pb-5 lg:flex"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600"><UserRound size={20} /></div><div className="min-w-0"><div className="truncate text-sm font-extrabold text-white">{currentUser?.name || 'Customer'}</div><div className="text-[10px] text-slate-400">Customer account</div></div></div>
          <nav className="flex gap-1 overflow-x-auto lg:grid lg:overflow-visible" aria-label="Customer portal sections">
            {sections.map(({ id, label, icon: Icon, count }) => <button key={id} type="button" onClick={() => setActiveSection(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-colors ${activeSection === id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-[#142958]'}`}><Icon size={16} /><span className="whitespace-nowrap">{label}</span>{count !== undefined && <span className="ml-auto hidden text-[10px] opacity-70 lg:inline">{count}</span>}</button>)}
          </nav>
          <div className="mt-5 hidden border-t border-[#142958] pt-4 lg:block"><button type="button" onClick={() => setCurrentView('store')} className="flex w-full items-center gap-2 rounded-xl border border-[#142958] px-3 py-2.5 text-xs font-bold text-blue-200"><ArrowLeft size={15} />Back to store</button><button type="button" onClick={logoutUser} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/10"><LogOut size={15} />Sign out</button></div>
        </aside>

        <main className="min-w-0 space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#142958] bg-[#0b1b3d] p-4 sm:p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-blue-300">Customer portal</p><h1 className="mt-1 text-xl font-black text-white">{activeSection === 'overview' ? `Welcome back, ${currentUser?.name?.split(' ')[0] || 'there'}` : sections.find(section => section.id === activeSection)?.label}</h1><p className="mt-1 text-xs text-slate-400">Review purchases, keep your account details current, and get help.</p></div><div className="flex gap-2 lg:hidden"><button onClick={() => setCurrentView('store')} className="rounded-lg border border-[#142958] p-2 text-blue-200" aria-label="Back to store"><ArrowLeft size={16} /></button><button onClick={logoutUser} className="rounded-lg border border-[#142958] p-2 text-rose-300" aria-label="Sign out"><LogOut size={16} /></button></div><span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-300 sm:inline-flex"><ShieldCheck size={13} />Verified Customer Account</span></header>

          {(activeSection === 'overview' || activeSection === 'orders') && <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><div className={panelClass}><div className="text-2xl font-black text-white">{customerOrders.length}</div><div className="mt-1 text-[10px] text-slate-400">Orders</div></div><div className={panelClass}><div className="text-2xl font-black text-amber-300">{activeOrders.length}</div><div className="mt-1 text-[10px] text-slate-400">In progress</div></div><div className={panelClass}><div className="truncate text-lg font-black text-emerald-300">{formatMoney(purchasedTotal)}</div><div className="mt-1 text-[10px] text-slate-400">Completed spend</div></div><div className={panelClass}><div className="text-2xl font-black text-violet-300">{rewardPoints.toLocaleString()}</div><div className="mt-1 text-[10px] text-slate-400">Reward Points</div></div></div>
            <section className={panelClass}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-extrabold text-white">Order history</h2><p className="mt-1 text-[10px] text-slate-400">Invoices, reorder, delivery progress, and returns</p></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-2.5 top-2.5 text-slate-500" size={14} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find an order" className="w-40 rounded-lg border border-[#142958] bg-[#07132c] py-2 pl-8 pr-2 text-[10px] text-white sm:w-52" /></div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-lg border border-[#142958] bg-[#07132c] px-2 text-[10px] text-white"><option value="all">All statuses</option>{['CONFIRMED','PREPARING','IN_TRANSIT','DELIVERED','CANCELLED','REFUND_REQUESTED','REFUNDED'].map(status => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></div></div>
              {filteredOrders.length === 0 ? <div className="rounded-xl border border-[#142958] bg-[#07132c] p-8 text-center text-xs text-slate-400">No orders match this filter.</div> : <div className="space-y-3">{filteredOrders.map(order => {
                const delivered = order.status === 'DELIVERED';
                const returnRequested = ['REFUND_REQUESTED', 'REFUNDED'].includes(order.status);
                const statusLabel = ({ CONFIRMED: 'Processing', PREPARING: 'Preparing', IN_TRANSIT: 'Shipped · Out for delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled', REFUND_REQUESTED: 'Return under review', REFUNDED: 'Refund completed' })[order.status] || order.status;
                return <article key={order.orderNumber} className="rounded-xl border border-[#142958] bg-[#07132c] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-xs text-blue-300">{order.orderNumber}</strong><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${delivered ? 'bg-emerald-500/15 text-emerald-300' : order.status === 'CANCELLED' ? 'bg-rose-500/15 text-rose-300' : 'bg-blue-500/15 text-blue-200'}`}>{statusLabel}</span></div><p className="mt-1 text-[10px] text-slate-400">Placed {new Date(order.date).toLocaleDateString()} · {order.items?.length || 0} item types</p></div><strong className="text-sm text-white">{formatMoney(order.totalAmount)}</strong></div>
                  <div className="mt-3 space-y-2 border-t border-[#142958] pt-3">{(order.items || []).map((item, index) => <div key={`${item.id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-300"><span className="min-w-0 flex-1 truncate">{item.title} × {item.quantity}</span><span>{formatMoney(item.total ?? item.price * item.quantity)}</span>{delivered && <button type="button" onClick={() => openRateModal(order)} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-200 hover:bg-amber-500/20"><Star size={11} className={order.rating ? 'fill-amber-400 text-amber-400' : ''} />{order.rating ? `Rated (${order.rating}★)` : 'Rate'}</button>}</div>)}</div>
                  {order.deliveryAddress && <p className="mt-3 flex items-start gap-1.5 text-[10px] text-slate-400"><MapPin size={13} className="mt-0.5 shrink-0" />{order.deliveryAddress}</p>}
                  {delivered && order.rating && (
                    <div className="mt-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 p-2.5 text-[10px] text-amber-200 flex items-start gap-2">
                      <div className="flex items-center gap-0.5 text-amber-400 shrink-0 mt-0.5">
                        {[...Array(order.rating)].map((_, i) => (
                          <Star key={i} size={11} fill="currentColor" />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-amber-300">Your Rating & Notes: </span>
                        <span className="italic text-slate-200">"{order.notes}"</span>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#142958] pt-3"><button onClick={() => openTracking(order)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-bold text-white"><Truck size={13} />Track order</button>{delivered && <button type="button" onClick={() => openRateModal(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-[10px] font-bold text-amber-200 hover:bg-amber-500/25 shadow-sm transition-all"><Star size={13} className={order.rating ? 'fill-amber-400 text-amber-400' : 'text-amber-300'} /><span>{order.rating ? `Rated (${order.rating}★)` : 'Rate'}</span></button>}<button onClick={() => downloadInvoice(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#142958] px-3 py-2 text-[10px] font-bold text-slate-200"><Download size={13} />Invoice</button><button onClick={() => reorder(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#142958] px-3 py-2 text-[10px] font-bold text-slate-200"><ShoppingBag size={13} />Reorder</button>{delivered && !returnRequested && <button onClick={() => openRefund(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 px-3 py-2 text-[10px] font-bold text-purple-200"><RotateCcw size={13} />Request return</button>}{returnRequested && <button onClick={() => printReturnLabel(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 px-3 py-2 text-[10px] font-bold text-purple-200"><Download size={13} />Print return label</button>}{['CONFIRMED', 'PENDING'].includes(order.status) && <button type="button" onClick={() => { setCancelModalOrder(order); setCancelReasonType('Ordered wrong product or size'); setCancelOtherReason(''); }} className="rounded-lg border border-rose-500/25 px-3 py-2 text-[10px] font-bold text-rose-300 hover:bg-rose-500/10">Cancel order</button>}</div>
                  {['CONFIRMED','PREPARING','IN_TRANSIT'].includes(order.status) && <p className="mt-2 text-[9px] text-slate-500">Status updates are synced with our dispatch logistics system.</p>}
                </article>;
              })}</div>}
            </section>
          </>}

          {activeSection === 'profile' && <div className="grid gap-5 xl:grid-cols-2">
            <section className={`${panelClass} xl:col-span-2 border-blue-500/30 bg-gradient-to-br from-[#091838] via-[#0b1b3d] to-[#122b5e]`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                    consentGranted 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}>
                    {consentGranted ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <ShieldAlert className="w-5 h-5 text-rose-400" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-extrabold text-white">Philippine Data Privacy Consent (RA 10173)</h2>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        consentGranted 
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}>
                        {consentGranted ? '✓ Consent Granted to Admin' : '✕ Consent Withheld (Protected)'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                      In accordance with the <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong>, you have control over whether Archon Nell store administrators and dispatch managers can view your full personal contact records (email, phone number, and physical job site delivery address).
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {consentGranted
                        ? 'Your consent is currently ACTIVE. Store administrators can view verified contact details to coordinate freight delivery and provide priority support.'
                        : 'Your consent is WITHHELD. Your email, mobile number, and site address are automatically masked (e.g. 0928***, m***@gmail.com) in administrative dashboards.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={togglePrivacyConsent}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center justify-center gap-2 shadow-md ${
                    consentGranted
                      ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border-rose-500/30 hover:border-rose-500/50'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                  }`}
                >
                  {consentGranted ? (
                    <>
                      <ShieldAlert className="w-4 h-4 text-rose-300" />
                      <span>Revoke Admin Access</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-white" />
                      <span>Grant Consent to Admin</span>
                    </>
                  )}
                </button>
              </div>
            </section>
            <section className={panelClass}><h2 className="text-sm font-extrabold text-white">Personal information</h2><p className="mt-1 text-[10px] text-slate-400">Saved to your Archon Nell profile.</p><form onSubmit={submitProfile} className="mt-4 space-y-3">{[['name','Full name'],['email','Email address'],['phone','Phone number'],['company','Company']].map(([key,label]) => <label key={key} className="block text-[10px] font-semibold text-slate-400">{label}<input required={key === 'name' || key === 'email'} type={key === 'email' ? 'email' : 'text'} value={profileDraft[key]} onChange={event => setProfileDraft(draft => ({ ...draft, [key]: event.target.value }))} className={`${inputClass} mt-1`} /></label>)}<label className="block text-[10px] font-semibold text-slate-400">Billing preference<select value={billingPreference} onChange={event => setBillingPreference(event.target.value)} className={`${inputClass} mt-1`}><option value="standard">Standard invoice</option><option value="business">Business purchase order</option><option value="cash-on-delivery">Cash on delivery preference</option></select></label><button className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white">Save profile</button></form><div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100">Password changes require secure authentication and are not supported by this demo account.</div></section>
            <section className={panelClass}><div className="flex items-center justify-between"><div><h2 className="text-sm font-extrabold text-white">Address book</h2><p className="mt-1 text-[10px] text-slate-400">Addresses are stored locally in this browser.</p></div><MapPin size={18} className="text-blue-300" /></div><form onSubmit={submitAddress} className="mt-4 grid gap-2 sm:grid-cols-[120px_1fr_auto]"><input required value={addressDraft.label} onChange={event => setAddressDraft(draft => ({ ...draft, label: event.target.value }))} placeholder="Home, Office..." className={inputClass} /><input required value={addressDraft.address} onChange={event => setAddressDraft(draft => ({ ...draft, address: event.target.value }))} placeholder="Full shipping or billing address" className={inputClass} /><button className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold"><Plus size={14} />Add</button></form><div className="mt-4 space-y-2">{addresses.length ? addresses.map(address => <div key={address.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#142958] bg-[#07132c] p-3"><div><strong className="text-xs text-white">{address.label}</strong><p className="mt-1 text-[10px] text-slate-400">{address.address}</p></div><button onClick={() => saveAddresses(addresses.filter(item => item.id !== address.id))} aria-label={`Remove ${address.label} address`} className="text-slate-500 hover:text-rose-300"><X size={15} /></button></div>) : <p className="rounded-xl border border-dashed border-[#142958] p-5 text-center text-[10px] text-slate-500">No saved addresses yet.</p>}</div></section>
            <section className={`${panelClass} xl:col-span-2`}><div className="flex items-center gap-2"><CreditCard size={17} className="text-amber-300" /><h2 className="text-sm font-extrabold text-white">Payment methods</h2></div><p className="mt-2 text-xs text-slate-300">No card or wallet credentials are stored in this demo. Choose a payment method during checkout; only the order’s method label is recorded.</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-lg border border-[#142958] bg-[#07132c] px-3 py-2 text-[10px] text-slate-300">GCash at checkout</span><span className="rounded-lg border border-[#142958] bg-[#07132c] px-3 py-2 text-[10px] text-slate-300">Other checkout methods per order</span></div></section>
          </div>}

          {activeSection === 'rewards' && <div className="grid gap-5 xl:grid-cols-2"><section className={`${panelClass} bg-gradient-to-br from-[#0b1b3d] to-[#172b52]`}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">Demo loyalty</p><h2 className="mt-2 text-2xl font-black text-white">{rewardTier} member</h2><p className="mt-1 text-xs text-slate-300">Points estimate from completed spend</p></div><Star size={25} className="text-amber-300" /></div><div className="mt-6 text-4xl font-black text-amber-300">{rewardPoints.toLocaleString()} <span className="text-sm font-bold">pts</span></div><p className="mt-2 text-[10px] text-slate-400">Demo estimate: 1 point per PHP 100 spent. No points are redeemable.</p></section><section className={panelClass}><div className="flex items-center gap-2"><Wallet size={17} className="text-emerald-300" /><h2 className="text-sm font-extrabold text-white">Coupon wallet</h2></div><p className="mt-1 text-[10px] text-slate-400">Available discount codes · no gift balance or expiry tracking</p><div className="mt-4 space-y-2">{[{code:'ARCHON20', detail:'20% off eligible orders'}, {code:'ARCHON500', detail:'PHP 500 off'}, {code:'FREESHIP', detail:'Free shipping'}].map(coupon => <div key={coupon.code} className="flex items-center justify-between rounded-xl border border-[#142958] bg-[#07132c] p-3"><div><strong className="font-mono text-xs text-blue-200">{coupon.code}</strong><p className="mt-1 text-[10px] text-slate-400">{coupon.detail}</p></div><span className="text-[9px] text-emerald-300">Available</span></div>)}</div></section><section className={`${panelClass} xl:col-span-2`}><div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-sm font-extrabold text-white"><Heart size={16} className="text-rose-300" />Wishlist</h2><p className="mt-1 text-[10px] text-slate-400">Saved on this browser; price-drop alerts are not connected.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{customerProducts.map(product => <article key={product.id} className="flex gap-3 rounded-xl border border-[#142958] bg-[#07132c] p-3"><img src={product.image} alt={product.title} className="h-16 w-16 rounded-lg bg-white object-contain p-1" /><div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-[10px] font-bold text-white">{product.title}</h3><p className="mt-1 text-xs font-bold text-emerald-300">{formatMoney(product.price)}</p><div className="mt-2 flex gap-2"><button onClick={() => addToCart(product)} className="text-[9px] font-bold text-blue-300">Add to cart</button><button onClick={() => saveWishlist(wishlist.filter(id => id !== product.id))} className="text-[9px] text-rose-300">Remove</button></div></div></article>)}{!customerProducts.length && <p className="rounded-xl border border-dashed border-[#142958] p-6 text-center text-[10px] text-slate-500 sm:col-span-2 xl:col-span-3">Your wishlist is empty. Save products here to keep them handy.</p>}</div><div className="mt-5 border-t border-[#142958] pt-4"><h3 className="text-xs font-bold text-slate-200">Add products to wishlist</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{products.filter(product => !wishlist.includes(product.id)).slice(0, 6).map(product => <div key={product.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#142958] bg-[#07132c] p-2.5"><span className="truncate text-[10px] text-slate-300">{product.title}</span><button aria-label={`Save ${product.title} to wishlist`} onClick={() => saveWishlist([...wishlist, product.id])} className="shrink-0 rounded-md border border-rose-500/20 p-1.5 text-rose-300"><Heart size={13} /></button></div>)}</div></div></section></div>}

          {activeSection === 'support' && <div className="grid gap-5 xl:grid-cols-2"><section className={panelClass}><h2 className="text-sm font-extrabold text-white">Help desk</h2><p className="mt-1 text-[10px] text-slate-400">Direct communication lines with our engineering and support team.</p><button onClick={() => setIsCsOpen(true)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#142958] bg-[#07132c] p-3 text-left"><span className="flex items-center gap-2 text-xs font-bold text-slate-200"><CircleHelp size={15} className="text-blue-300" />Open support chat</span><ChevronRight size={15} className="text-slate-500" /></button><div className="mt-3 rounded-xl border border-[#142958] bg-[#07132c] p-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-200"><BookOpen size={15} className="text-amber-300" />Order help</div><p className="mt-1 text-[10px] text-slate-400">Open an order’s tracking panel for status details, or use the return request action after delivery.</p></div><p className="mt-3 text-[9px] text-slate-500">Our engineering support team responds to all inquiries within 24 hours.</p></section><section className={panelClass}><div className="flex items-center gap-2"><Bell size={17} className="text-blue-300" /><h2 className="text-sm font-extrabold text-white">Communication preferences</h2></div><p className="mt-1 text-[10px] text-slate-400">These choices are saved locally; preferences are saved to your account.</p><div className="mt-4 space-y-2">{[['emailNews','Email newsletter'],['smsUpdates','SMS order updates'],['marketing','Marketing notifications']].map(([key,label]) => <label key={key} className="flex cursor-pointer items-center justify-between rounded-xl border border-[#142958] bg-[#07132c] p-3 text-xs text-slate-200">{label}<input type="checkbox" checked={Boolean(preferences[key])} onChange={event => savePreferences({ ...preferences, [key]: event.target.checked })} className="h-4 w-4 accent-blue-500" /></label>)}</div></section></div>}
        </main>
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#142958] bg-[#0b1b3d] p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Cancel Order #{cancelModalOrder.orderNumber}</span>
            </h3>
            <p className="mt-1 text-xs text-slate-300">
              Only pending orders can be cancelled. Please select a reason for our warehouse dispatch team.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
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
                cancelOrder(cancelModalOrder.orderNumber, trimmed);
              } else {
                cancelOrder(cancelModalOrder.orderNumber, cancelReasonType);
              }
              setCancelModalOrder(null);
              setCancelReasonType('Ordered wrong product or size');
              setCancelOtherReason('');
            }} className="mt-3 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Cancellation Reason: *
                </label>
                <select
                  value={cancelReasonType}
                  onChange={(e) => {
                    setCancelReasonType(e.target.value);
                    if (e.target.value !== 'Other reason') {
                      setCancelOtherReason('');
                    }
                  }}
                  className="w-full rounded-xl border border-[#142958] bg-[#07132c] p-2.5 text-xs text-white focus:border-rose-500 focus:outline-none"
                >
                  <option value="Ordered wrong product or size" className="bg-[#0b1b3d] text-white">Ordered wrong product or size</option>
                  <option value="Job site schedule delayed" className="bg-[#0b1b3d] text-white">Job site schedule delayed</option>
                  <option value="Found lower price elsewhere" className="bg-[#0b1b3d] text-white">Found lower price elsewhere</option>
                  <option value="Change of project plans" className="bg-[#0b1b3d] text-white">Change of project plans</option>
                  <option value="Incorrect shipping address" className="bg-[#0b1b3d] text-white">Incorrect shipping address</option>
                  <option value="Other reason" className="bg-[#0b1b3d] text-white">Other reason</option>
                </select>
              </div>

              {cancelReasonType === 'Other reason' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <label className="font-semibold text-slate-400">
                      Specify Reason (8–25 characters): *
                    </label>
                    <span className={`text-[10px] font-mono ${
                      cancelOtherReason.trim().length >= 8 && cancelOtherReason.trim().length <= 25
                        ? 'text-emerald-400 font-bold'
                        : cancelOtherReason.length > 0
                        ? 'text-amber-400 font-bold'
                        : 'text-slate-500'
                    }`}>
                      {cancelOtherReason.length}/25 (min 8)
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={8}
                    maxLength={25}
                    value={cancelOtherReason}
                    onChange={(e) => setCancelOtherReason(e.target.value.slice(0, 25))}
                    placeholder="Enter 8 to 25 characters"
                    className="w-full rounded-xl border border-[#142958] bg-[#07132c] p-2.5 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                  />
                  {cancelOtherReason.length > 0 && cancelOtherReason.trim().length < 8 && (
                    <p className="text-[10px] text-amber-400">
                      Must be at least 8 characters ({8 - cancelOtherReason.trim().length} more needed).
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCancelModalOrder(null);
                    setCancelReasonType('Ordered wrong product or size');
                    setCancelOtherReason('');
                  }}
                  className="rounded-lg border border-[#142958] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-[#142958]"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={cancelReasonType === 'Other reason' && (cancelOtherReason.trim().length < 8 || cancelOtherReason.trim().length > 25)}
                  className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  </div>
);
}