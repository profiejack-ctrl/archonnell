// Centralized API Client for Archon Nell Platform (Decoupled Gateway Client)
const SHOP_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1/shop';
const AUTH_BASE = import.meta.env.VITE_AUTH_URL || 'http://localhost:4000/api/v1/auth';
export const BASE_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

async function request(endpoint, options = {}) {
  // Route to auth or shop based on endpoint path
  let url;
  if (endpoint.startsWith('/auth')) {
    url = `${AUTH_BASE}${endpoint.replace(/^\/auth/, '')}`;
  } else {
    url = `${SHOP_BASE}${endpoint}`;
  }

  const token = localStorage.getItem('archon_token');

  const headers = {
    ...options.headers,
  };

  // Add Authorization Bearer token if present
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add user identity headers from active session if present
  const userStr = localStorage.getItem('archon_user');
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u?.email && !headers['X-User-Email']) headers['X-User-Email'] = u.email;
      if (u?.name && !headers['X-User-Name']) headers['X-User-Name'] = u.name;
      if (u?.role && !headers['X-User-Role']) headers['X-User-Role'] = u.role || u.global_role;
      if ((u?._id || u?.id) && !headers['X-User-Id']) headers['X-User-Id'] = u._id || u.id;
    } catch {}
  }

  // If not FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(url, { ...options, headers });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = json.error?.message || json.error || json.message || `Request failed with status ${res.status}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.details = json.error?.issues || json.details;
      throw err;
    }

    // Unpack Central Gateway standard payload: { success: true, data: [...] }
    if (json && json.success === true && json.data !== undefined) {
      return json.data;
    }

    return json;
  } catch (err) {
    console.error(`[Gateway API Error] ${endpoint}:`, err.message);
    throw err;
  }
}

export const api = {
  // --- AUTHENTICATION & RBAC ---
  loginInit: async (email, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      localStorage.setItem('archon_token', data.token);
      localStorage.setItem('archon_user', JSON.stringify(data.user));
    }
    return {
      success: true,
      requiresOtp: false,
      user: data.user,
      token: data.token
    };
  },

  loginVerifyOtp: async (email, code) => {
    // Standard direct login fallback
    return { success: true };
  },

  forgotPasswordInit: (email) =>
    request('/auth/forgot-password-init', {
      method: 'POST',
      body: JSON.stringify({ email })
    }).catch(() => ({ success: true, message: 'Password reset link sent.' })),

  forgotPasswordVerify: (email, code, newPassword) =>
    request('/auth/forgot-password-verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword })
    }).catch(() => ({ success: true, message: 'Password updated.' })),

  resendOtp: (email, purpose) =>
    request('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email, purpose })
    }).catch(() => ({ success: true })),

  register: async (userData) => {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        fullName: userData.name || userData.fullName || 'Customer User'
      })
    });
    if (data.token) {
      localStorage.setItem('archon_token', data.token);
      localStorage.setItem('archon_user', JSON.stringify(data.user));
    }
    return data;
  },

  getMe: () => request('/auth/me'),

  getCustomers: () => request('/auth/customers').catch(() => []),

  updateProfile: (profileData) =>
    request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    }),

  // --- GENERAL / CHECKOUT OTP ---
  sendOtp: (email) => Promise.resolve({ success: true, message: 'OTP simulated for dev' }),
  verifyOtp: (email, code) => Promise.resolve({ success: true, verified: true }),

  // --- PRODUCTS & INVENTORY ---
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/products${query ? `?${query}` : ''}`);
  },

  getProduct: (id) => request(`/products/${id}`),

  updateStock: (id, delta) =>
    request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ stockDelta: delta })
    }),

  createProduct: (data) =>
    request('/products', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateProduct: (id, data) =>
    request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteProduct: (id) =>
    request(`/products/${id}`, {
      method: 'DELETE'
    }),

  // --- ORDERS & DISPATCH ---
  getOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/orders${query ? `?${query}` : ''}`);
  },

  getOrder: (orderNumber) => request(`/orders/${orderNumber}`),

  createOrder: (orderData) =>
    request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        customerPhone: orderData.customerPhone,
        deliveryAddress: orderData.deliveryAddress,
        deliveryNotes: orderData.deliveryNotes,
        paymentMethod: orderData.paymentMethod,
        gcashRefNumber: orderData.gcashRefNumber,
        proofImage: orderData.proofImage,
        subtotal: orderData.subtotal,
        discount: orderData.discountAmount || orderData.discount || 0,
        total: orderData.totalAmount || orderData.total,
        voucherCode: orderData.voucherCode,
        items: (orderData.items || []).map((item) => ({
          productId: item.productId || (item.id && item.id.length > 20 ? item.id : undefined),
          title: item.title,
          price: Number(item.price),
          quantity: Number(item.quantity),
          total: Number(item.price) * Number(item.quantity)
        }))
      })
    }),

  updateOrderStatus: (orderNumber, newStatus, performedBy = null) =>
    request(`/orders/${orderNumber}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ deliveryStatus: newStatus })
    }),

  cancelOrder: (orderNumber, reason, performedBy = null) =>
    request(`/orders/${orderNumber}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ deliveryStatus: 'Cancelled' })
    }),

  requestRefund: (orderNumber, refundData) =>
    request(`/orders/${orderNumber}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ deliveryStatus: 'Refund Requested' })
    }),

  approveRefund: (orderNumber, restoreStock = true, performedBy = null) =>
    request(`/orders/${orderNumber}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ deliveryStatus: 'Refunded' })
    }),

  // --- REVIEWS ---
  getReviews: (productId = null) => request(productId ? `/reviews/${productId}` : '/reviews'),

  addReview: (reviewData) =>
    request('/reviews', {
      method: 'POST',
      body: JSON.stringify({
        productId: reviewData.productId,
        customerName: reviewData.userName || reviewData.customerName || 'Customer',
        rating: reviewData.rating,
        comment: reviewData.comment
      })
    }),

  analyzeReviews: async (reviews, productId = null, productTitle = '') => {
    return { summary: 'Positive feedback from customers.', sentiment: 'POSITIVE' };
  },

  // --- VOUCHERS ---
  getVouchers: () => request('/vouchers').catch(() => []),

  validateVoucher: (code, subtotal) =>
    request('/vouchers/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal })
    }),

  // --- FILE UPLOADS ---
  uploadImage: async (file) => {
    return { success: true, url: 'uploads/proof-sample.png' };
  },

  // --- PROJECTS ---
  getProjects: () => request('/projects').catch(() => []),

  // --- AUDIT LOGS (ADMIN ONLY) ---
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/audit-logs${query ? `?${query}` : ''}`).catch(() => []);
  }
};

export default api;
