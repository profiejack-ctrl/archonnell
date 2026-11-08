import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { 
  ShieldCheck, 
  ShieldAlert,
  Lock,
  ArrowLeft, 
  LogOut, 
  DollarSign, 
  Package, 
  ShoppingBag, 
  AlertTriangle, 
  Plus, 
  Minus, 
  Search, 
  CheckCircle2, 
  Truck, 
  RotateCcw, 
  FileText, 
  ExternalLink,
  ArchiveRestore,
  X,
  LayoutDashboard,
  Users,
  TrendingUp,
  Printer,
  Star,
  Target,
  CircleDollarSign,
  Percent,
  ClipboardList,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

function mapStatusToKey(status) {
  if (!status) return 'pending';
  const s = String(status).toUpperCase();
  if (s === 'CONFIRMED' || s === 'PENDING') return 'pending';
  if (s === 'PREPARING') return 'preparing';
  if (s === 'IN_TRANSIT' || s === 'SHIPPED') return 'shipped';
  if (s === 'DELIVERED') return 'delivered';
  if (s === 'REFUND_REQUESTED' || s === 'RETURN') return 'return';
  if (s === 'REFUNDED' || s === 'REFUND') return 'refund';
  if (s === 'CANCELLED') return 'cancelled';
  return 'pending';
}

function formatStatusLabel(status) {
  const key = mapStatusToKey(status);
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function maskEmail(email) {
  if (!email) return '—';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return '—';
  const clean = phone.trim();
  if (clean.length < 7) return '***-****';
  return `${clean.slice(0, 4)}***${clean.slice(-3)}`;
}

function maskAddress(address) {
  if (!address) return '—';
  const parts = address.split(',');
  if (parts.length > 1) {
    return `[Protected Site Street], ${parts.slice(-2).join(', ').trim()}`;
  }
  return '[Site Address Protected under RA 10173]';
}

export default function AdminView() {
  const {
    setCurrentView,
    logoutUser,
    products,
    setProducts,
    orders,
    updateOrderStatus,
    approveRefund,
    cancelOrder,
    showToast
  } = useApp();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [productSearch, setProductSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState('all');
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [adminCancelOrderNumber, setAdminCancelOrderNumber] = useState(null);
  const [adminCancelReasonType, setAdminCancelReasonType] = useState('Ordered wrong product or size');
  const [adminCancelOtherReason, setAdminCancelOtherReason] = useState('');
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productDraft, setProductDraft] = useState({ title: '', sku: '', category: '', price: '', stock: '', shippingWeightKg: '', description: '', image: '' });

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditLoading, setAuditLoading] = useState(false);

  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userConsentFilter, setUserConsentFilter] = useState('all');

  const [showPrices, setShowPrices] = useState(() => {
    try {
      return localStorage.getItem('archon_admin_show_prices') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleShowPrices = () => {
    setShowPrices(prev => {
      const next = !prev;
      try {
        localStorage.setItem('archon_admin_show_prices', String(next));
      } catch {}
      return next;
    });
  };

  const fetchAuditLogs = () => {
    setAuditLoading(true);
    api.getAuditLogs({ limit: 100 })
      .then(data => {
        if (Array.isArray(data)) setAuditLogs(data);
      })
      .catch(err => console.warn('Audit logs fetch:', err.message))
      .finally(() => setAuditLoading(false));
  };

  const fetchRegisteredUsers = () => {
    setUsersLoading(true);
    api.getCustomers()
      .then(data => {
        if (Array.isArray(data)) setRegisteredUsers(data);
      })
      .catch(err => console.warn('Registered customers fetch:', err.message))
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => {
    fetchAuditLogs();
    fetchRegisteredUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    } else if (activeTab === 'users') {
      fetchRegisteredUsers();
    }
  }, [activeTab]);

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesAction = auditActionFilter === 'all' || log.action === auditActionFilter;
    const q = auditSearch.toLowerCase().trim();
    const matchesSearch = !q ||
      (log.details && log.details.toLowerCase().includes(q)) ||
      (log.target && log.target.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.performedBy?.email && log.performedBy.email.toLowerCase().includes(q)) ||
      (log.performedBy?.name && log.performedBy.name.toLowerCase().includes(q));
    return matchesAction && matchesSearch;
  });

  const handleStockAdjust = (productId, delta) => {
    const updated = products.map(p => {
      if (p.id === productId) {
        const newStock = Math.max(0, p.stock + delta);
        return { ...p, stock: newStock };
      }
      return p;
    });
    setProducts(updated);
    showToast(`Warehouse stock level adjusted (${delta > 0 ? `+${delta}` : delta}).`, 'info');
  };

  const handleProductSubmit = (event) => {
    event.preventDefault();
    const productData = {
      ...productDraft,
      price: Number(productDraft.price),
      stock: Number(productDraft.stock),
      shippingWeightKg: Number(productDraft.shippingWeightKg) || 0,
      sold: products.find(product => product.id === editingProductId)?.sold || 0,
    };
    if (editingProductId) {
      setProducts(products.map(product => product.id === editingProductId ? { ...product, ...productData } : product));
      showToast('Product details updated in the catalog.', 'success');
    } else {
      setProducts([{ ...productData, id: `prod-${Date.now()}`, image: productData.image || '/assets/images/leveling_mortar_1785519746126.png' }, ...products]);
      showToast('Product added to the catalog.', 'success');
    }
    setIsProductFormOpen(false);
    setEditingProductId(null);
    setProductDraft({ title: '', sku: '', category: '', price: '', stock: '', shippingWeightKg: '', description: '', image: '' });
  };

  const startProductEdit = product => {
    setEditingProductId(product.id);
    setProductDraft({ title: product.title || '', sku: product.sku || product.id, category: product.category || '', price: product.price ?? '', stock: product.stock ?? '', shippingWeightKg: product.shippingWeightKg ?? '', description: product.description || '', image: product.image || '' });
    setIsProductFormOpen(true);
  };

  const totalRevenue = orders
    .filter(o => o.status !== 'CANCELLED' && o.status !== 'REFUNDED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const totalOrdersCount = orders.length;
  const activeDeliveriesCount = orders.filter(o => o.status === 'PREPARING' || o.status === 'IN_TRANSIT').length;
  const lowStockCount = products.filter(p => p.stock <= 10).length;
  const pendingRefundsCount = orders.filter(o => o.status === 'REFUND_REQUESTED').length;
  const validSalesOrders = orders.filter(order => !['CANCELLED', 'REFUNDED'].includes(order.status));
  const averageOrderValue = validSalesOrders.length
    ? validSalesOrders.reduce((sum, order) => sum + order.totalAmount, 0) / validSalesOrders.length
    : 0;
  const monthlyGoal = 500000;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyRevenue = validSalesOrders
    .filter(order => {
      const d = order.date || order.createdAt;
      return d && String(d).slice(0, 7) === currentMonth;
    })
    .reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const goalProgress = Math.min(100, Math.round((monthlyRevenue / monthlyGoal) * 100));

  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - index));
    const key = d.toISOString().slice(0, 7);
    return {
      key,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      revenue: validSalesOrders.filter(order => {
        const orderDateStr = order.date || order.createdAt;
        return orderDateStr && String(orderDateStr).slice(0, 7) === key;
      }).reduce((sum, order) => sum + (order.totalAmount || 0), 0),
    };
  });
  const maxMonthlyRevenue = Math.max(1, ...monthlyTrend.map(month => month.revenue));

  const productSales = products.map(product => {
    const pId = product.id || product.customId;
    return {
      ...product,
      soldInOrders: validSalesOrders.reduce((sum, order) => sum + (order.items || [])
        .filter(item => (item.id === pId || item.customId === pId || item.productId === pId))
        .reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
    };
  }).sort((a, b) => b.soldInOrders - a.soldInOrders).slice(0, 5);

  const categorySales = Object.entries(validSalesOrders.reduce((summary, order) => {
    (order.items || []).forEach(item => {
      const itemKey = item.id || item.customId || item.productId;
      const product = products.find(candidate => (candidate.id === itemKey || candidate.customId === itemKey));
      const category = product?.category || 'mortar';
      summary[category] = (summary[category] || 0) + (item.total || item.price * item.quantity || 0);
    });
    return summary;
  }, {})).sort((a, b) => b[1] - a[1]);

  const statusCounts = [
    { label: 'Pending', key: 'pending', status: 'CONFIRMED' },
    { label: 'Preparing', key: 'preparing', status: 'PREPARING' },
    { label: 'Shipped', key: 'shipped', status: 'IN_TRANSIT' },
    { label: 'Delivered', key: 'delivered', status: 'DELIVERED' },
    { label: 'Cancelled', key: 'cancelled', status: 'CANCELLED' },
    { label: 'Return', key: 'return', status: 'REFUND_REQUESTED' },
    { label: 'Refund', key: 'refund', status: 'REFUNDED' },
  ].map(({ label, key, status }) => ({
    label,
    key,
    status,
    count: orders.filter(order => mapStatusToKey(order.status) === key).length
  }));
  const conversionRate = null;

  const printOrderDocument = (order, type) => {
    const isInvoice = type === 'invoice';
    const rows = (order.items || []).map(item => `<tr><td>${item.title}</td><td>${item.quantity}</td><td>PHP ${(item.total || item.price * item.quantity).toLocaleString()}</td></tr>`).join('');
    const popup = window.open('', '_blank', 'width=800,height=900');
    if (!popup) {
      showToast('Allow pop-ups to print this document.', 'warning');
      return;
    }
    popup.document.write(`<!doctype html><html><head><title>${isInvoice ? 'Invoice' : 'Shipping Label'} ${order.orderNumber}</title><style>body{font:14px Arial,sans-serif;color:#111;padding:36px}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:10px;border-bottom:1px solid #ccc;text-align:left}.label{border:2px solid #111;padding:24px;max-width:520px}.muted{color:#555}</style></head><body>${isInvoice ? `<h1>Archon Nell — Order Invoice</h1><p>Order: ${order.orderNumber}<br>Date: ${new Date(order.date).toLocaleDateString()}</p><h3>${order.customerName}</h3><p>${order.customerEmail || ''}<br>${order.customerPhone || ''}<br>${order.deliveryAddress || ''}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><h2>Total: PHP ${order.totalAmount.toLocaleString()}</h2><p class="muted">Official Archon Nell Commercial Invoice.</p>` : `<div class="label"><h1>SHIP TO</h1><h2>${order.customerName}</h2><p>${order.deliveryAddress || 'No delivery address on record'}</p><p>${order.customerPhone || ''}</p><hr><strong>${order.orderNumber}</strong><p class="muted">Shipping label preview — no carrier booking created.</p></div>`}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const filteredProducts = products.filter(p => {
    const q = productSearch.toLowerCase().trim();
    return !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const filteredOrders = orders.filter(o => {
    const q = orderSearch.toLowerCase().trim();
    const matchesSearch = !q ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.toLowerCase().includes(q) ||
      (o.gcashRefNumber && o.gcashRefNumber.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (orderStatusFilter !== 'all') {
      const mapped = mapStatusToKey(o.status);
      if (mapped !== orderStatusFilter && o.status !== orderStatusFilter) {
        return false;
      }
    }

    return true;
  });

  const filteredShipments = orders
    .filter(o => {
      const q = shipmentSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (shipmentStatusFilter !== 'all') {
        const mapped = mapStatusToKey(o.status);
        if (shipmentStatusFilter === 'return') {
          if (!['return', 'refund'].includes(mapped)) return false;
        } else if (mapped !== shipmentStatusFilter) {
          return false;
        }
      }
      return true;
    });

  const refundOrders = orders.filter(o => o.status === 'REFUND_REQUESTED' || o.status === 'REFUNDED');

  const allCustomers = (() => {
    const map = new Map();

    registeredUsers.forEach(u => {
      const email = u.email ? u.email.toLowerCase().trim() : '';
      if (email) {
        map.set(email, {
          customerName: u.name,
          customerEmail: u.email,
          customerPhone: u.phone || '',
          company: u.company || 'Contractor Partner',
          registeredDate: u.createdAt,
          isRegistered: true,
          defaultAddress: u.defaultAddress || '',
          privacyConsent: u.privacyConsent || { granted: true, consentedAt: u.createdAt, policyVersion: 'RA10173-2026.1' }
        });
      }
    });

    orders.forEach(o => {
      const email = o.customerEmail ? o.customerEmail.toLowerCase().trim() : (o.customerPhone || '');
      if (email) {
        const existing = map.get(email) || {
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          company: 'Engineering Client',
          registeredDate: o.createdAt,
          isRegistered: false,
          defaultAddress: o.deliveryAddress,
          privacyConsent: { granted: true, consentedAt: o.createdAt, policyVersion: 'RA10173-2026.1' }
        };
        map.set(email, existing);
      }
    });
    return [...map.values()];
  })();

  const customers = allCustomers;
  const consentedUsersCount = customers.filter(c => c.privacyConsent?.granted !== false).length;
  const withheldUsersCount = customers.filter(c => c.privacyConsent?.granted === false).length;

  const filteredCustomers = customers.filter(c => {
    const q = userSearch.toLowerCase().trim();
    const matchesSearch = !q ||
      c.customerName.toLowerCase().includes(q) ||
      (c.customerEmail && c.customerEmail.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.customerPhone && c.customerPhone.includes(q)) ||
      (c.defaultAddress && c.defaultAddress.toLowerCase().includes(q));
    if (!matchesSearch) return false;
    const isGranted = c.privacyConsent?.granted !== false;
    if (userConsentFilter === 'consented' && !isGranted) return false;
    if (userConsentFilter === 'withheld' && isGranted) return false;
    return true;
  });

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Product & Inventory', icon: Package, count: products.length },
    { id: 'orders', label: 'Orders', icon: FileText, count: orders.length },
    { id: 'shipments', label: 'Delivery Status', icon: Truck, count: orders.length },
    { id: 'refunds', label: 'Returns & Refunds', icon: RotateCcw, count: refundOrders.length },
    { id: 'users', label: 'Manage Users', icon: Users, count: customers.length },
    { id: 'audit', label: 'Audit Logs', icon: ClipboardList, count: auditLogs.length },
  ];

  return (
    <div className="admin-view min-h-screen bg-[#07132c] text-slate-100 py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1600px] grid-cols-[250px_minmax(0,1fr)] items-start gap-6 max-[800px]:grid-cols-1 max-[800px]:gap-3.5">
        <aside className="sticky top-6 flex min-h-[calc(100vh-48px)] flex-col rounded-[22px] border border-[#142958] bg-[#0b1b3d] px-3.5 py-5 max-[800px]:static max-[800px]:min-h-0 max-[800px]:rounded-[18px] max-[800px]:p-3">
          <div className="flex items-center gap-[11px] border-b border-[#142958] px-2 pb-[22px] pt-0.5 max-[800px]:hidden">
            <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-amber-500 text-[#07132c]"><ShieldCheck size={19} /></span>
            <div><strong className="block text-sm text-white">Archon Nell</strong><span className="mt-[3px] block text-[11px] text-slate-400">Admin Console</span></div>
          </div>
          <nav className="mt-6 grid gap-1.5 max-[800px]:mt-0 max-[800px]:flex max-[800px]:gap-1.5 max-[800px]:overflow-x-auto" aria-label="Admin sections">
            <span className="px-2.5 pb-2 text-[10px] font-extrabold tracking-[.12em] text-[#8294b3] max-[800px]:hidden">WORKSPACE</span>
            {navigation.map(({ id, label, icon: Icon, count }) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)} className={`flex w-full cursor-pointer items-center gap-[11px] rounded-xl border px-2.5 py-[11px] text-left text-xs font-bold transition-colors max-[800px]:w-auto max-[800px]:shrink-0 max-[800px]:px-2.5 max-[800px]:py-2.5 max-[520px]:gap-[7px] max-[520px]:text-[10px] ${activeTab === id ? 'border-blue-500 bg-blue-700 text-white' : 'border-transparent bg-transparent text-slate-300 hover:bg-[#10234a] hover:text-white'}`} aria-current={activeTab === id ? 'page' : undefined}>
                <Icon size={17} />
                <span className="whitespace-nowrap">{label}</span>
                {count !== undefined && <small className={`ml-auto text-[10px] max-[800px]:hidden ${activeTab === id ? 'text-blue-100' : 'text-[#a9b8d0]'}`}>{count}</small>}
              </button>
            ))}
          </nav>
          <div className="mt-auto border-0 pt-5 max-[800px]:hidden">
            <button type="button" onClick={() => setCurrentView('store')} className="flex w-full cursor-pointer items-center gap-[9px] rounded-xl border border-[#142958] bg-[#07132c] px-2.5 py-[11px] text-xs font-bold text-blue-300"><ArrowLeft size={16} /> Back to Store</button>
          </div>
        </aside>
        <main className="min-w-0">
        <div className="mx-auto max-w-none space-y-4 sm:space-y-6">
        <div className="bg-[#0b1b3d] p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-lg flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <button
              onClick={() => setCurrentView('store')}
              className="px-3 py-2 bg-[#07132c] hover:bg-blue-600/30 text-blue-300 hover:text-white rounded-xl border border-[#142958] transition-all flex items-center gap-1.5 text-xs font-bold active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-blue-400" />
              <span>Back to Store</span>
            </button>

            <button
              onClick={logoutUser}
              className="sm:hidden px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="hidden sm:block text-center sm:text-left flex-1 sm:ml-4">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-amber-500 rounded-md text-slate-950 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
              <h1 className="text-base sm:text-lg font-extrabold text-white leading-tight">Admin Operations Center</h1>
            </div>
            <p className="text-[11px] text-slate-400">Warehouse inventory, stock levels, and dispatch logistics</p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-xl text-xs font-bold">
              Cainta Central Plant
            </span>
            <button
              onClick={logoutUser}
              className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
        {activeTab === 'dashboard' && <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-[#0b1b3d] p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-md flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-xl font-black text-emerald-400 truncate font-mono">
                  {showPrices ? `PHP ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'PHP ******'}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-400 font-semibold truncate">Total Sales</div>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleShowPrices}
              className="p-1.5 sm:p-2 rounded-xl bg-[#07132c] border border-[#142958] hover:border-emerald-500/50 text-slate-400 hover:text-emerald-300 transition-all flex-shrink-0"
              title={showPrices ? "Hide price (show asterisks)" : "Show price"}
            >
              {showPrices ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
          <div className="bg-[#0b1b3d] p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-md flex items-center gap-2.5 sm:gap-3.5">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base sm:text-2xl font-black text-white">{totalOrdersCount}</div>
              <div className="text-[10px] sm:text-xs text-slate-400 font-semibold truncate">Total Orders</div>
            </div>
          </div>
          <div className="bg-[#0b1b3d] p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-md flex items-center gap-2.5 sm:gap-3.5">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base sm:text-2xl font-black text-amber-400">{activeDeliveriesCount}</div>
              <div className="text-[10px] sm:text-xs text-slate-400 font-semibold truncate">Active In-Transit</div>
            </div>
          </div>
          <div className="bg-[#0b1b3d] p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-md flex items-center gap-2.5 sm:gap-3.5">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base sm:text-2xl font-black text-rose-400">{lowStockCount}</div>
              <div className="text-[10px] sm:text-xs text-slate-400 font-semibold truncate">Low Stock Alert</div>
            </div>
          </div>

        </div>}

        {activeTab === 'dashboard' && <section className="flex items-center justify-between gap-5 rounded-[20px] border border-[#142958] bg-[linear-gradient(115deg,#0b1b3d,#102750)] px-6 py-[22px] max-[520px]:flex-col max-[520px]:items-start max-[520px]:p-[17px]"><div><span className="text-[10px] font-extrabold tracking-[.12em] text-[#8294b3]">OVERVIEW</span><h2 className="mt-1.5 text-[22px] font-extrabold text-white">Dashboard</h2><p className="mt-1 text-xs text-slate-400">Here’s what’s happening across your store today.</p></div><button type="button" onClick={() => setActiveTab('orders')} className="flex flex-row-reverse items-center gap-[7px] rounded-[10px] bg-blue-600 px-[13px] py-2.5 text-[11px] font-bold text-white"><ArrowLeft className="rotate-180" size={15} />Review orders</button></section>}

        {activeTab === 'dashboard' && <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-[#142958] bg-[#0b1b3d] p-4 sm:p-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-extrabold text-white">Revenue trend</h3><p className="mt-1 text-[10px] text-slate-400">Monthly Sales · PHP</p></div><TrendingUp size={17} className="text-blue-300" /></div><div className="mt-5 flex h-36 items-end gap-2 sm:gap-4">{monthlyTrend.map(month => <div key={month.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[9px] text-slate-400 font-mono">{showPrices ? (month.revenue ? `${Math.round(month.revenue / 1000)}k` : '0') : '***'}</span><div className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-blue-700 to-cyan-400" style={{ height: `${Math.max(5, (month.revenue / maxMonthlyRevenue) * 78)}%` }} /><span className="text-[9px] text-slate-500">{month.label}</span></div>)}</div></section>
          <section className="rounded-2xl border border-[#142958] bg-[#0b1b3d] p-4 sm:p-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-extrabold text-white">Top-selling products</h3><p className="mt-1 text-[10px] text-slate-400">Units Sold</p></div><ShoppingBag size={17} className="text-emerald-300" /></div><div className="mt-4 space-y-3">{productSales.map(product => <div key={product.id} className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-slate-200">{product.title}</div><div className="mt-1 h-1.5 rounded-full bg-[#142958]"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(4, (product.soldInOrders / Math.max(1, productSales[0]?.soldInOrders || 1)) * 100)}%` }} /></div></div><span className="text-xs font-bold text-emerald-300">{product.soldInOrders}</span></div>)}</div></section>
          <section className="rounded-2xl border border-[#142958] bg-[#0b1b3d] p-4 sm:p-5"><h3 className="text-sm font-extrabold text-white">Sales by category</h3><p className="mt-1 text-[10px] text-slate-400">Based on items in recorded orders</p><div className="mt-4 space-y-3">{categorySales.length ? categorySales.map(([category, amount], index) => <div key={category} className="flex items-center gap-3"><span className="w-24 truncate text-xs capitalize text-slate-300">{category}</span><div className="h-2 flex-1 rounded-full bg-[#142958]"><div className={`h-full rounded-full ${['bg-cyan-400', 'bg-violet-400', 'bg-amber-400', 'bg-emerald-400'][index % 4]}`} style={{ width: `${Math.max(3, (amount / Math.max(1, categorySales[0][1])) * 100)}%` }} /></div><span className="w-24 text-right text-[10px] text-slate-400 font-mono">{showPrices ? `PHP ${amount.toLocaleString()}` : 'PHP ******'}</span></div>) : <p className="text-xs text-slate-500">No order line items recorded yet.</p>}</div></section>
          <section className="rounded-2xl border border-[#142958] bg-[#0b1b3d] p-4 sm:p-5"><h3 className="text-sm font-extrabold text-white">Order pipeline</h3><p className="mt-1 text-[10px] text-slate-400">Current order status counts</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{statusCounts.map(({ label, key, count }) => <button key={key} type="button" onClick={() => { setOrderStatusFilter(key); setActiveTab('orders'); }} className="rounded-xl border border-[#142958] bg-[#07132c] p-3 text-left hover:border-blue-500/50 transition-all"><span className="block text-[9px] font-bold text-slate-400 uppercase">{label}</span><span className="mt-1 block text-lg font-black text-white">{count}</span></button>)}</div></section>
          <section className="rounded-2xl border border-[#142958] bg-[#0b1b3d] p-4 sm:p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-extrabold text-white">Inventory alerts</h3><AlertTriangle size={17} className="text-amber-300" /></div><div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => setActiveTab('inventory')} className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-left"><span className="block text-[10px] text-amber-200">Low stock (10 or fewer)</span><strong className="mt-1 block text-xl text-amber-300">{products.filter(product => product.stock > 0 && product.stock <= 10).length}</strong></button><button type="button" onClick={() => setActiveTab('inventory')} className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-left"><span className="block text-[10px] text-rose-200">Out of stock</span><strong className="mt-1 block text-xl text-rose-300">{products.filter(product => product.stock <= 0).length}</strong></button></div><button type="button" onClick={() => setActiveTab('inventory')} className="mt-3 text-[10px] font-bold text-blue-300">Open inventory →</button></section>
          <section className="rounded-2xl border border-[#142958] bg-[#0b1b3d] p-4 sm:p-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-extrabold text-white">Returns &amp; customer insights</h3><p className="mt-1 text-[10px] text-slate-400">Customer Accounts & Orders</p></div><Users size={17} className="text-violet-300" /></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl border border-[#142958] bg-[#07132c] p-3"><span className="block text-[10px] text-slate-400">Customer profiles in orders</span><strong className="mt-1 block text-xl text-white">{customers.length}</strong></div><div className="rounded-xl border border-[#142958] bg-[#07132c] p-3"><span className="block text-[10px] text-slate-400">Pending return requests</span><strong className="mt-1 block text-xl text-purple-300">{pendingRefundsCount}</strong></div></div><div className="mt-3 flex flex-wrap gap-2">{['ARCHON20', 'ARCHON500', 'FREESHIP'].map(code => <span key={code} className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 font-mono text-[9px] text-blue-200">{code}</span>)}</div><p className="mt-2 text-[9px] text-slate-500">Traffic sources, campaign performance, loyalty, and abandoned-cart logs are not collected in this demo.</p><button type="button" onClick={() => setActiveTab('refunds')} className="mt-2 text-[10px] font-bold text-purple-300">Review return requests →</button></section>
        </div>}
        {activeTab === 'inventory' && (
          <div className="bg-[#0b1b3d] p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-lg space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-xs sm:text-base font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                  <Package className="w-4 h-4 text-blue-400" />
                  <span>Real-Time Warehouse Inventory</span>
                </h2>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Adjust stock levels. Store checkout checks stocks immediately to prevent overselling.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search inventory..."
                  className="w-full pl-9 pr-8 py-2 bg-[#07132c] text-xs text-white placeholder-slate-400 rounded-xl border border-[#142958] focus:outline-none focus:border-blue-500"
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={() => { setEditingProductId(null); setProductDraft({ title: '', sku: '', category: '', price: '', stock: '', shippingWeightKg: '', description: '', image: '' }); setIsProductFormOpen(value => !value); }} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"><Plus size={14} /> Add product</button>
            </div>
            {isProductFormOpen && <form onSubmit={handleProductSubmit} className="grid grid-cols-1 gap-3 rounded-2xl border border-[#142958] bg-[#07132c] p-4 sm:grid-cols-2">
              <h3 className="text-sm font-bold text-white sm:col-span-2">{editingProductId ? 'Edit product' : 'New catalog item'}</h3>
              {[['title', 'Product name'], ['sku', 'SKU'], ['category', 'Category'], ['price', 'Price (PHP)'], ['stock', 'Stock count'], ['shippingWeightKg', 'Shipping weight per unit (kg)']].map(([field, label]) => <label key={field} className="text-[10px] font-semibold text-slate-400">{label}<input required={field !== 'sku'} type={['price', 'stock', 'shippingWeightKg'].includes(field) ? 'number' : 'text'} min={['price', 'stock', 'shippingWeightKg'].includes(field) ? 0 : undefined} step={field === 'price' || field === 'shippingWeightKg' ? '0.1' : '1'} value={productDraft[field]} onChange={event => setProductDraft(draft => ({ ...draft, [field]: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#142958] bg-[#0b1b3d] px-3 py-2 text-xs text-white outline-none focus:border-blue-500" /></label>)}
              <label className="text-[10px] font-semibold text-slate-400 sm:col-span-2">Description<textarea rows="2" value={productDraft.description} onChange={event => setProductDraft(draft => ({ ...draft, description: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#142958] bg-[#0b1b3d] px-3 py-2 text-xs text-white outline-none focus:border-blue-500" /></label>
              <label className="text-[10px] font-semibold text-slate-400 sm:col-span-2">Product image<input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setProductDraft(draft => ({ ...draft, image: reader.result })); reader.readAsDataURL(file); }} className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-[#142958] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white" /></label>
              <div className="flex gap-2 sm:col-span-2"><button type="submit" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Save product</button><button type="button" onClick={() => { setIsProductFormOpen(false); setEditingProductId(null); }} className="rounded-lg border border-[#142958] px-3 py-2 text-xs font-bold text-slate-300">Close</button></div>
            </form>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-4">
              {filteredProducts.map(product => {
                const isZero = product.stock === 0;
                const isLow = product.stock > 0 && product.stock <= 10;

                return (
                  <div
                    key={product.id}
                    className="p-3 sm:p-4 rounded-2xl bg-[#07132c] border border-[#142958] space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3 hover:border-blue-500/40 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={product.image}
                        alt={product.title}
                        className="w-12 h-12 sm:w-14 sm:h-14 object-contain bg-white rounded-xl p-1 border border-slate-300 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{product.title}</div>
                        <div className="text-[9px] font-mono text-slate-500">SKU: {product.sku || product.id}</div>
                        <div className="text-[9px] text-slate-500">Estimated shipping weight: {product.shippingWeightKg || 0} kg / unit</div>
                        <div className="text-xs font-semibold text-blue-400 mt-0.5">PHP {product.price.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400">Sold: {product.sold} units • {product.category}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#142958]/80">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => startProductEdit(product)} className="rounded-lg border border-[#142958] bg-[#0b1b3d] px-2 py-1.5 text-[10px] font-bold text-blue-300 hover:bg-[#142958]">Edit</button>
                        <button
                          onClick={() => handleStockAdjust(product.id, -5)}
                          className="px-2 py-1.5 bg-[#0b1b3d] hover:bg-[#142958] border border-[#142958] rounded-lg text-slate-300 text-[10px] font-bold active:scale-95"
                          title="Reduce 5"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => handleStockAdjust(product.id, -1)}
                          className="p-1.5 bg-[#0b1b3d] hover:bg-[#142958] border border-[#142958] rounded-lg text-slate-300 active:scale-95"
                          title="Reduce 1"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className={`px-2.5 py-1 rounded-xl text-center font-mono font-bold text-xs min-w-[70px] border ${
                        isZero
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : isLow
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}>
                        <div>{product.stock} units</div>
                        <div className="text-[8px] uppercase tracking-wider font-sans font-extrabold">
                          {isZero ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStockAdjust(product.id, 1)}
                          className="p-1.5 bg-[#0b1b3d] hover:bg-[#142958] border border-[#142958] rounded-lg text-slate-300 active:scale-95"
                          title="Add 1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStockAdjust(product.id, 5)}
                          className="px-2 py-1.5 bg-[#0b1b3d] hover:bg-[#142958] border border-[#142958] rounded-lg text-slate-300 text-[10px] font-bold active:scale-95"
                          title="Add 5"
                        >
                          +5
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        )}
        {activeTab === 'orders' && (
          <div className="bg-[#0b1b3d] p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-lg space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-[#142958]">
              <div>
                <h2 className="text-xs sm:text-base font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Orders Management ({filteredOrders.length})</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Commercial purchases, payment verification, invoice generation, and order cancellation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="py-2 px-3 bg-[#07132c] text-xs text-white rounded-xl border border-[#142958] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="preparing">Preparing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search Order # or Client..."
                    className="w-full pl-9 pr-4 py-2 bg-[#07132c] text-xs text-white placeholder-slate-400 rounded-xl border border-[#142958] focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-[#07132c] rounded-2xl border border-[#142958]">
                  No orders match your filter criteria.
                </div>
              ) : (
                filteredOrders.map(order => {
                  const isPending = mapStatusToKey(order.status) === 'pending';
                  const isCancelled = order.status === 'CANCELLED';

                  return (
                    <div
                      key={order.orderNumber}
                      className="p-4 sm:p-5 rounded-2xl bg-[#07132c] border border-[#142958] space-y-3 hover:border-blue-500/40 transition-all shadow-md"
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-2.5 border-b border-[#142958]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-xs sm:text-sm text-blue-400">{order.orderNumber}</span>
                            <span className="text-[10px] bg-[#0b1b3d] text-slate-300 font-bold px-2 py-0.5 rounded border border-[#142958]">
                              {order.paymentMethod}
                            </span>
                            {order.gcashRefNumber && (
                              <span className="text-[10px] bg-blue-900/40 text-blue-200 font-mono font-bold px-2 py-0.5 rounded border border-blue-500/30">
                                Ref: {order.gcashRefNumber}
                              </span>
                            )}
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              order.status === 'DELIVERED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : order.status === 'CANCELLED'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : order.status === 'REFUNDED' || order.status === 'REFUND_REQUESTED'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300 mt-1">
                            <strong>{order.customerName}</strong> ({order.customerPhone})
                          </div>
                        </div>

                        <div className="flex sm:flex-col justify-between sm:items-end items-center">
                          <div className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                            PHP {order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(order.date || order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="bg-[#0b1b3d] p-3 rounded-xl border border-[#142958] space-y-1.5">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Order Items:</span>
                        {(order.items || []).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs text-slate-200">
                            <span>{item.title} × {item.quantity}</span>
                            <span className="font-mono text-slate-400">PHP {(item.total || item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-slate-300 bg-[#0b1b3d] p-2.5 rounded-xl border border-[#142958]">
                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Destination:</span>
                        <span className="line-clamp-2">{order.deliveryAddress}</span>
                      </div>
                      {order.status === 'DELIVERED' && (
                        <div className={`p-3 rounded-xl border text-xs ${
                          order.rating 
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
                            : 'bg-[#0b1b3d] border-[#142958] text-slate-400'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Customer Delivery Rating:</span>
                              {order.rating ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center text-amber-400">
                                    {[...Array(5)].map((_, i) => (
                                      <Star key={i} size={13} className={i < order.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'} />
                                    ))}
                                  </div>
                                  <strong className="text-amber-300 font-mono text-xs">({order.rating}/5 Stars)</strong>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No rating submitted yet (Awaiting customer review)</span>
                              )}
                            </div>
                            {order.ratedAt && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Rated on {new Date(order.ratedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {order.notes && (
                            <p className="mt-1.5 text-xs text-slate-200 italic bg-black/20 p-2 rounded-lg border border-white/5">
                              "{order.notes}"
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => printOrderDocument(order, 'invoice')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#142958] bg-[#0b1b3d] px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:border-blue-500/50"><Printer size={13} />Print invoice</button>
                        <button type="button" onClick={() => printOrderDocument(order, 'label')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#142958] bg-[#0b1b3d] px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:border-blue-500/50"><Printer size={13} />Print shipping label</button>
                      </div>
                      {isCancelled && order.cancelReason && (
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300">
                          <span className="font-bold block text-[10px] uppercase text-rose-400">Cancellation Reason:</span>
                          <span>{order.cancelReason}</span>
                        </div>
                      )}
                      <div className="pt-2.5 border-t border-[#142958] flex flex-col sm:flex-row justify-between sm:items-center gap-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Status:</span>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                            order.status === 'DELIVERED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : order.status === 'CANCELLED'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : order.status === 'REFUNDED' || order.status === 'REFUND_REQUESTED'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          }`}>
                            {formatStatusLabel(order.status)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => { setAdminCancelOrderNumber(order.orderNumber); setAdminCancelReasonType('Ordered wrong product or size'); setAdminCancelOtherReason(''); }}
                              className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl transition-all"
                            >
                              Cancel Order
                            </button>
                          )}

                          {!isCancelled && !['REFUNDED', 'REFUND_REQUESTED'].includes(order.status) && (() => {
                            if (order.status === 'DELIVERED') {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Delivered (Final)</span>
                                </span>
                              );
                            }
                            const nextConfig = {
                              'CONFIRMED': { next: 'PREPARING', label: 'Next: Preparing →', style: 'bg-amber-600 hover:bg-amber-500 text-white' },
                              'PENDING': { next: 'PREPARING', label: 'Next: Preparing →', style: 'bg-amber-600 hover:bg-amber-500 text-white' },
                              'PREPARING': { next: 'IN_TRANSIT', label: 'Next: Shipped →', style: 'bg-blue-600 hover:bg-blue-500 text-white' },
                              'IN_TRANSIT': { next: 'DELIVERED', label: 'Next: Delivered →', style: 'bg-emerald-600 hover:bg-emerald-500 text-white' }
                            }[order.status];

                            if (nextConfig) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => updateOrderStatus(order.orderNumber, nextConfig.next)}
                                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-md border border-white/10 active:scale-95 transition-all ${nextConfig.style}`}
                                  title={`Advance order to ${nextConfig.next}`}
                                >
                                  <span>{nextConfig.label}</span>
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
            {adminCancelOrderNumber && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-[#142958] bg-[#0b1b3d] p-5 shadow-2xl space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Cancel Order #{adminCancelOrderNumber}</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Cancelling this order will restore reserved product inventory back to warehouse stock.
                  </p>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Reason for Cancellation: *
                    </label>
                    <select
                      value={adminCancelReasonType}
                      onChange={(e) => {
                        setAdminCancelReasonType(e.target.value);
                        if (e.target.value !== 'Other reason') {
                          setAdminCancelOtherReason('');
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

                  {adminCancelReasonType === 'Other reason' && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <label className="font-semibold text-slate-400">
                          Specify Reason (8–25 characters): *
                        </label>
                        <span className={`text-[10px] font-mono ${
                          adminCancelOtherReason.trim().length >= 8 && adminCancelOtherReason.trim().length <= 25
                            ? 'text-emerald-400 font-bold'
                            : adminCancelOtherReason.length > 0
                            ? 'text-amber-400 font-bold'
                            : 'text-slate-500'
                        }`}>
                          {adminCancelOtherReason.length}/25 (min 8)
                        </span>
                      </div>
                      <input
                        type="text"
                        minLength={8}
                        maxLength={25}
                        value={adminCancelOtherReason}
                        onChange={(e) => setAdminCancelOtherReason(e.target.value.slice(0, 25))}
                        placeholder="Enter 8 to 25 characters"
                        className="w-full rounded-xl border border-[#142958] bg-[#07132c] p-2.5 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                      />
                      {adminCancelOtherReason.length > 0 && adminCancelOtherReason.trim().length < 8 && (
                        <p className="text-[10px] text-amber-400">
                          Must be at least 8 characters ({8 - adminCancelOtherReason.trim().length} more needed).
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminCancelOrderNumber(null);
                        setAdminCancelReasonType('Ordered wrong product or size');
                        setAdminCancelOtherReason('');
                      }}
                      className="rounded-lg border border-[#142958] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-[#142958]"
                    >
                      Keep Order
                    </button>
                    <button
                      type="button"
                      disabled={adminCancelReasonType === 'Other reason' && (adminCancelOtherReason.trim().length < 8 || adminCancelOtherReason.trim().length > 25)}
                      onClick={() => {
                        if (adminCancelReasonType === 'Other reason') {
                          const trimmed = adminCancelOtherReason.trim();
                          if (trimmed.length < 8) {
                            showToast('Other reason must be at least 8 characters.', 'warning');
                            return;
                          }
                          if (trimmed.length > 25) {
                            showToast('Other reason cannot exceed 25 characters.', 'warning');
                            return;
                          }
                          cancelOrder(adminCancelOrderNumber, trimmed);
                        } else {
                          cancelOrder(adminCancelOrderNumber, adminCancelReasonType);
                        }
                        setAdminCancelOrderNumber(null);
                        setAdminCancelReasonType('Ordered wrong product or size');
                        setAdminCancelOtherReason('');
                      }}
                      className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
        {activeTab === 'shipments' && (
          <div className="bg-[#0b1b3d] p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-lg space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-[#142958]">
              <div>
                <h2 className="text-xs sm:text-base font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span>Delivery Status ({filteredShipments.length})</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Real-time logistics tracking and freight dispatch stages across all {orders.length} orders.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[10px] text-blue-300 font-bold">
                    Total Tracked: {orders.length}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold">
                    Standard Freight: {orders.filter(o => !['REFUND_REQUESTED', 'REFUNDED'].includes(o.status)).length}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-[10px] text-purple-300 font-bold">
                    Return / Refund Claims: {refundOrders.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
                <select
                  value={shipmentStatusFilter}
                  onChange={(e) => setShipmentStatusFilter(e.target.value)}
                  className="py-2 px-3 bg-[#07132c] text-xs text-white rounded-xl border border-[#142958] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Deliveries ({orders.length})</option>
                  <option value="pending">Pending Dispatch</option>
                  <option value="preparing">Preparing / Packed</option>
                  <option value="shipped">In Transit / Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="return">Return / Refund Inquiries ({refundOrders.length})</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={shipmentSearch}
                    onChange={(e) => setShipmentSearch(e.target.value)}
                    placeholder="Search Tracking # or Client..."
                    className="w-full pl-9 pr-4 py-2 bg-[#07132c] text-xs text-white placeholder-slate-400 rounded-xl border border-[#142958] focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {filteredShipments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-[#07132c] rounded-2xl border border-[#142958]">
                  No shipments match your delivery filter criteria.
                </div>
              ) : (
                filteredShipments.map(order => {
                  const statusKey = mapStatusToKey(order.status);
                  const isDelivered = statusKey === 'delivered';
                  const isShipped = statusKey === 'shipped';
                  const isPreparing = statusKey === 'preparing';

                  return (
                    <div
                      key={order.orderNumber}
                      className="p-4 sm:p-5 rounded-2xl bg-[#07132c] border border-[#142958] space-y-3 hover:border-amber-500/40 transition-all shadow-md"
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-2.5 border-b border-[#142958]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-xs sm:text-sm text-blue-400">{order.orderNumber}</span>
                            <span className="text-[10px] bg-[#0b1b3d] text-slate-300 font-bold px-2 py-0.5 rounded border border-[#142958]">
                              {order.paymentMethod}
                            </span>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                              isDelivered
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : order.status === 'CANCELLED'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : ['REFUND_REQUESTED', 'REFUNDED'].includes(order.status)
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : isShipped
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            }`}>
                              {order.status === 'REFUND_REQUESTED' ? 'Return Under Review' : order.status === 'REFUNDED' ? 'Refund Processed' : formatStatusLabel(order.status)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300 mt-1">
                            Recipient: <strong>{order.customerName}</strong> ({order.customerPhone})
                          </div>
                        </div>

                        <div className="flex sm:flex-col justify-between sm:items-end items-center">
                          <div className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                            PHP {order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Dispatched: {new Date(order.date || order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-300 bg-[#0b1b3d] p-2.5 rounded-xl border border-[#142958]">
                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Shipping Destination:</span>
                        <span className="line-clamp-2">{order.deliveryAddress}</span>
                      </div>
                      <div className="bg-[#0b1b3d]/60 p-3 rounded-xl border border-[#142958] space-y-2">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Dispatch Progression:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {[
                            { name: '1. Placed', done: true },
                            { name: '2. Verified', done: true },
                            { name: '3. Packed', done: isPreparing || isShipped || isDelivered },
                            { name: '4. In-Transit', done: isShipped || isDelivered },
                            { name: '5. Delivered', done: isDelivered },
                          ].map((step, idx) => (
                            <div key={idx} className={`p-2 rounded-lg border text-center text-[10px] font-bold ${
                              order.status === 'CANCELLED'
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                                : step.done
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                : 'bg-[#07132c] border-[#142958] text-slate-500'
                            }`}>
                              <div>{step.name}</div>
                              <div className="text-[8px] mt-0.5 opacity-80">
                                {order.status === 'CANCELLED' ? 'Cancelled' : step.done ? 'Completed' : 'Pending'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {isDelivered && (
                        <div className={`p-3 rounded-xl border text-xs ${
                          order.rating 
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
                            : 'bg-[#0b1b3d] border-[#142958] text-slate-400'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Customer Delivery Review:</span>
                              {order.rating ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center text-amber-400">
                                    {[...Array(5)].map((_, i) => (
                                      <Star key={i} size={13} className={i < order.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'} />
                                    ))}
                                  </div>
                                  <strong className="text-amber-300 font-mono text-xs">({order.rating}/5 Stars)</strong>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Delivered · No customer rating submitted yet</span>
                              )}
                            </div>
                            {order.ratedAt && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Rated on {new Date(order.ratedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {order.notes && (
                            <p className="mt-1.5 text-xs text-slate-200 italic bg-black/20 p-2 rounded-lg border border-white/5">
                              "{order.notes}"
                            </p>
                          )}
                        </div>
                      )}
                      <div className="pt-2 border-t border-[#142958] flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Truck className="w-3.5 h-3.5 text-amber-400" />
                          <span>Status: <strong className="text-white uppercase">{formatStatusLabel(order.status)}</strong> (View-Only)</span>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => printOrderDocument(order, 'label')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#142958] bg-[#0b1b3d] px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:border-amber-500/50"><Printer size={13} />Print shipping label</button>
                          <button type="button" onClick={() => printOrderDocument(order, 'invoice')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#142958] bg-[#0b1b3d] px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:border-blue-500/50"><Printer size={13} />Print invoice</button>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}
        {activeTab === 'users' && (
          <section className="bg-[#0b1b3d] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-[#142958]">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Customer Accounts &amp; Data Privacy (RA 10173)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verified contractor profiles, lifetime transaction spend, and personal information consent status under the Philippine Data Privacy Act of 2012.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[10px] text-blue-300 font-bold">
                    Total Accounts: {customers.length}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    RA 10173 Consented: {consentedUsersCount}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-300 font-bold flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-rose-400" />
                    Consent Withheld (Masked): {withheldUsersCount}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <select
                  value={userConsentFilter}
                  onChange={(e) => setUserConsentFilter(e.target.value)}
                  className="py-1.5 px-3 bg-[#07132c] text-xs text-white rounded-xl border border-[#142958] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Consent Statuses ({customers.length})</option>
                  <option value="consented">Consent Granted Only ({consentedUsersCount})</option>
                  <option value="withheld">Consent Withheld Only ({withheldUsersCount})</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name, email, company..."
                    className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-[#07132c] text-xs text-white placeholder-slate-400 rounded-xl border border-[#142958] focus:outline-none"
                  />
                </div>

                <button
                  onClick={fetchRegisteredUsers}
                  className="px-3 py-1.5 bg-[#07132c] hover:bg-[#142958] border border-[#142958] text-xs font-bold text-slate-200 rounded-xl flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${usersLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-slate-300 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong className="text-white">Philippine Republic Act No. 10173 Compliance: </strong>
                Under Data Privacy principles, customer personal contact information (email, phone, physical job site address) is only shown in clear text if the customer has explicitly authorized store administration access. When consent is withheld, sensitive fields are securely masked.
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-[#07132c] rounded-2xl border border-[#142958]">
                No customer records match your filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#142958] bg-[#07132c]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#142958] bg-[#0b1b3d]/50">
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">Customer &amp; Company</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">Personal Contact</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">Site / Delivery Address</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400 text-center">RA 10173 Consent</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">Account Type</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400 text-center">Orders</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400 text-right">Lifetime Spend</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">Last Order Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142958]">
                    {filteredCustomers.map((customer) => {
                      const cEmail = (customer.customerEmail || '').toLowerCase();
                      const cPhone = customer.customerPhone || '';
                      const customerOrders = orders.filter(o => 
                        (o.customerEmail && o.customerEmail.toLowerCase() === cEmail) ||
                        (o.customerPhone && o.customerPhone === cPhone)
                      );
                      const lastOrder = customerOrders.reduce((latest, o) => {
                        const d = new Date(o.date || o.createdAt || 0);
                        return !latest || d > new Date(latest.date || latest.createdAt || 0) ? o : latest;
                      }, null);
                      const lifetimeSpend = customerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

                      const isConsented = customer.privacyConsent?.granted !== false;

                      return (
                        <tr key={customer.customerEmail || customer.customerPhone} className="hover:bg-[#0b1b3d]/60 transition-colors">
                          <td className="p-3 text-white">
                            <strong className="block text-slate-100">{customer.customerName}</strong>
                            <span className="text-[10px] text-slate-400">{customer.company || 'Private Contractor'}</span>
                          </td>
                          <td className="p-3 text-slate-300">
                            {isConsented ? (
                              <>
                                <div className="font-mono text-[11px] text-blue-300">{customer.customerEmail || '—'}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{customer.customerPhone || '—'}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-mono text-[11px] text-rose-300 flex items-center gap-1">
                                  <Lock className="w-3 h-3 text-rose-400 shrink-0" />
                                  <span>{maskEmail(customer.customerEmail)}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{maskPhone(customer.customerPhone)}</div>
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-rose-500/10 border border-rose-500/20 text-[9px] text-rose-300">
                                  Masked per RA 10173
                                </span>
                              </>
                            )}
                          </td>
                          <td className="p-3 text-slate-300 max-w-[200px]">
                            {isConsented ? (
                              <span className="text-[11px] text-slate-300 line-clamp-2">
                                {customer.defaultAddress || '—'}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic line-clamp-2">
                                {maskAddress(customer.defaultAddress)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isConsented ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Consent Allowed</span>
                                </span>
                                <span className="text-[9px] text-slate-400 mt-0.5">RA 10173 Verified</span>
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Consent Withheld</span>
                                </span>
                                <span className="text-[9px] text-rose-300/80 mt-0.5">Data Protected</span>
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              customer.isRegistered 
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            }`}>
                              {customer.isRegistered ? 'Verified Account' : 'Order Guest'}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-white font-mono">
                            {customerOrders.length}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-400 font-mono">
                            PHP {lifetimeSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                            {lastOrder ? new Date(lastOrder.date || lastOrder.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'refunds' && (
          <div className="bg-[#0b1b3d] p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-lg space-y-4">
            <div>
              <h2 className="text-xs sm:text-base font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                <RotateCcw className="w-4 h-4 text-purple-400" />
                <span>Return &amp; Refund Inquiries</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Review damaged material photos uploaded by contractors and approve return with automatic warehouse restocking.
              </p>
            </div>

            <div className="space-y-3">
              {refundOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-[#07132c] rounded-2xl border border-[#142958]">
                  No active refund claims filed.
                </div>
              ) : (
                refundOrders.map(order => {
                  const isApproved = order.status === 'REFUNDED';
                  const details = order.refundDetails || {};

                  return (
                    <div
                      key={order.orderNumber}
                      className="p-4 rounded-2xl bg-[#07132c] border border-[#142958] space-y-3 shadow-md"
                    >
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#142958]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-blue-400">{order.orderNumber}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isApproved
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            {isApproved ? 'APPROVED' : 'PENDING REVIEW'}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          PHP {order.totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-[#0b1b3d] p-3 rounded-xl border border-[#142958] text-xs space-y-2">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Reason:</span>
                          <span className="text-rose-300 font-bold">{details.reason || 'Damaged packaging'}</span>
                        </div>
                        {details.details && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Contractor Description:</span>
                            <span className="text-slate-200">{details.details}</span>
                          </div>
                        )}
                        {details.damagePhoto && (
                          <div className="pt-1">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Uploaded Evidence:</span>
                            <img
                              src={details.damagePhoto}
                              alt="Damage Evidence"
                              className="w-24 h-24 object-cover rounded-xl border border-[#142958]"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end pt-1">
                        {!isApproved ? (
                          <button
                            onClick={() => approveRefund(order.orderNumber, true)}
                            className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                          >
                            <ArchiveRestore className="w-4 h-4" />
                            <span>Approve Refund &amp; Restock</span>
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Claim Completed &amp; Restocked</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}
        {activeTab === 'audit' && (
          <section className="bg-[#0b1b3d] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#142958] shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-[#142958]">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-400" />
                  <span>Audit Logs &amp; Security Compliance ({filteredAuditLogs.length})</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Immutable security audit trail recording 2FA OTP verifications, device trusts, failed logins, lockouts, and order dispatches.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={fetchAuditLogs}
                  disabled={auditLoading}
                  className="px-3 py-1.5 bg-[#07132c] hover:bg-[#142958] border border-[#142958] text-xs font-bold text-slate-200 rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${auditLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="py-1.5 px-3 bg-[#07132c] text-xs font-semibold text-white rounded-xl border border-[#142958] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Actions</option>
                  <option value="LOGIN_2FA_SUCCESS">Login 2FA Success</option>
                  <option value="LOGIN_FAILED">Login Failed</option>
                  <option value="LOGIN_TRUSTED_DEVICE">Login Trusted Device</option>
                  <option value="ACCOUNT_LOCKED_5_FAILED_ATTEMPTS">Account Locked (5 Attempts)</option>
                  <option value="OTP_ABORTED_MAX_ATTEMPTS">OTP Aborted (5 Attempts)</option>
                  <option value="DELIVERY_STATUS_UPDATED">Delivery Status Updated</option>
                  <option value="ORDER_CREATED">Order Created</option>
                  <option value="ORDER_PLACED">Order Placed</option>
                  <option value="REFUND_STATUS_UPDATED">Refund Status Updated</option>
                  <option value="PASSWORD_RESET_SUCCESS">Password Reset</option>
                  <option value="STOCK_ADJUSTED">Stock Adjusted</option>
                  <option value="SYSTEM_SEED_INITIALIZED">System Seed Initialized</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search logs..."
                    className="pl-8 pr-3 py-1.5 bg-[#07132c] text-xs text-white placeholder-slate-400 rounded-xl border border-[#142958] focus:outline-none w-44 sm:w-52"
                  />
                </div>
              </div>
            </div>

            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs bg-[#07132c] rounded-2xl border border-[#142958]">
                <ClipboardList className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                No audit log records match your filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#142958] bg-[#07132c]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#142958] bg-[#0b1b3d]/50">
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">Timestamp</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">Action</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">Performed By</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">Target</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">Details</th>
                      <th className="p-3 text-[10px] uppercase tracking-wider text-slate-400">IP &amp; Device</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142958]">
                    {filteredAuditLogs.map((log, idx) => {
                      const action = log.action || '';
                      const isDanger = action.includes('LOCKED') || action.includes('ABORTED') || action.includes('FAILED');
                      const isSuccess = action.includes('SUCCESS') || action.includes('INITIALIZED');
                      const isWarning = action.includes('RESET') || action.includes('STOCK') || action.includes('REFUND');
                      
                      const badgeClass = isDanger 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : isSuccess
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : isWarning
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30';

                      return (
                        <tr key={log._id || idx} className="hover:bg-[#0b1b3d]/60 transition-colors">
                          <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
                              {action}
                            </span>
                          </td>
                          <td className="p-3 text-slate-200 whitespace-nowrap">
                            <div className="font-semibold text-white">{log.performedBy?.name || 'System / Anonymous'}</div>
                            <div className="text-[10px] text-slate-400">{log.performedBy?.email || 'N/A'}</div>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-blue-300 whitespace-nowrap">
                            {log.target || '—'}
                          </td>
                          <td className="p-3 text-slate-300 max-w-xs break-words text-[11px]">
                            {log.details || '—'}
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-[10px] whitespace-nowrap">
                            <div>{log.ip || '127.0.0.1'}</div>
                            <div className="text-[9px] text-slate-500 truncate max-w-[120px]">{log.userAgent || 'Web Client'}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        </div>
        </main>
      </div>
    </div>
  );
}
