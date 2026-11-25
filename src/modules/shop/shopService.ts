import { query } from '../../db/connection.js';

// ------------------------------------------------------------------------------
// CATEGORIES & PRODUCTS
// ------------------------------------------------------------------------------

export async function getAllCategories() {
  const result = await query(
    `SELECT c.*, COUNT(p.id)::int AS product_count
     FROM shop.categories c
     LEFT JOIN shop.products p ON p.category_id = c.id AND p.is_active = TRUE
     GROUP BY c.id
     ORDER BY c.name ASC`
  );
  return result.rows;
}

export async function createCategory(name: string, slug: string, description?: string) {
  const result = await query(
    `INSERT INTO shop.categories (name, slug, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, slug.toLowerCase(), description || null]
  );
  return result.rows[0];
}

function enrichProductForSmartChain(row: any) {
  if (!row) return row;
  const images = Array.isArray(row.images) ? row.images : [];
  return {
    ...row,
    name: row.title,
    category: row.category_name || null,
    brand: row.brand || null,
    unit: row.unit || 'PCS',
    image_url: images[0] || null,
    selling_price: row.price !== null && row.price !== undefined ? Number(row.price).toFixed(2) : null,
    currency: row.currency || 'PHP',
    available_stock: row.stock ?? 0,
    publishable: row.publishable !== undefined ? Boolean(row.publishable) : Boolean(row.is_active),
  };
}

export async function getAllProducts(options: {
  categorySlug?: string;
  categoryId?: string;
  search?: string;
  includeInactive?: boolean;
} = {}) {
  let sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug,
           COALESCE(AVG(r.rating), 0)::numeric(3, 2) AS average_rating,
           COUNT(r.id)::int AS review_count
    FROM shop.products p
    LEFT JOIN shop.categories c ON c.id = p.category_id
    LEFT JOIN shop.reviews r ON r.product_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (!options.includeInactive) {
    sql += ` AND p.is_active = TRUE`;
  }
  if (options.categoryId) {
    params.push(options.categoryId);
    sql += ` AND p.category_id = $${params.length}`;
  }
  if (options.categorySlug && options.categorySlug !== 'all') {
    params.push(options.categorySlug);
    sql += ` AND c.slug = $${params.length}`;
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    sql += ` AND (p.title ILIKE $${params.length} OR p.description ILIKE $${params.length} OR p.sku ILIKE $${params.length})`;
  }

  sql += ` GROUP BY p.id, c.name, c.slug ORDER BY p.created_at DESC`;

  const result = await query(sql, params);
  return result.rows.map(enrichProductForSmartChain);
}

export async function getProductById(id: string) {
  const result = await query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            COALESCE(AVG(r.rating), 0)::numeric(3, 2) AS average_rating,
            COUNT(r.id)::int AS review_count
     FROM shop.products p
     LEFT JOIN shop.categories c ON c.id = p.category_id
     LEFT JOIN shop.reviews r ON r.product_id = p.id
     WHERE p.id = $1 OR p.custom_id = $1
     GROUP BY p.id, c.name, c.slug`,
    [id]
  );

  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' };
  }
  return enrichProductForSmartChain(result.rows[0]);
}

export async function createProduct(data: {
  categoryId?: string;
  customId?: string;
  title: string;
  description?: string;
  brand?: string;
  unit?: string;
  currency?: string;
  publishable?: boolean;
  price: number;
  stock?: number;
  sku?: string;
  images?: string[];
  specs?: Record<string, any>;
}) {
  const result = await query(
    `INSERT INTO shop.products (
       category_id, custom_id, title, description, brand, unit, currency, publishable, price, stock, sku, images, specs
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      data.categoryId || null,
      data.customId || `prod-${Date.now().toString().slice(-5)}`,
      data.title,
      data.description || null,
      data.brand || null,
      data.unit || 'PCS',
      data.currency || 'PHP',
      data.publishable !== undefined ? data.publishable : true,
      data.price,
      data.stock || 0,
      data.sku || null,
      JSON.stringify(data.images || []),
      JSON.stringify(data.specs || {})
    ]
  );
  return enrichProductForSmartChain(result.rows[0]);
}

export async function updateProduct(id: string, data: Partial<{
  categoryId: string;
  title: string;
  description: string;
  brand: string;
  unit: string;
  currency: string;
  publishable: boolean;
  price: number;
  stock: number;
  sku: string;
  images: string[];
  specs: Record<string, any>;
  isActive: boolean;
}>) {
  const fields: string[] = [];
  const params: any[] = [id];

  const map: Record<string, string> = {
    categoryId: 'category_id',
    title: 'title',
    description: 'description',
    brand: 'brand',
    unit: 'unit',
    currency: 'currency',
    publishable: 'publishable',
    price: 'price',
    stock: 'stock',
    sku: 'sku',
    isActive: 'is_active'
  };

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      if (key === 'images' || key === 'specs') {
        params.push(JSON.stringify(val));
        fields.push(`${key} = $${params.length}`);
      } else if (map[key]) {
        params.push(val);
        fields.push(`${map[key]} = $${params.length}`);
      }
    }
  }

  if (fields.length === 0) {
    return getProductById(id);
  }

  fields.push('updated_at = NOW()');
  const sql = `UPDATE shop.products SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await query(sql, params);
  return result.rows[0];
}

// ------------------------------------------------------------------------------
// VOUCHERS
// ------------------------------------------------------------------------------

export async function validateVoucher(code: string, subtotal: number) {
  const result = await query(
    `SELECT * FROM shop.vouchers WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`,
    [code]
  );

  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'INVALID_VOUCHER', message: 'Voucher code is invalid or inactive.' };
  }

  const v = result.rows[0];

  if (v.expires_at && new Date(v.expires_at) < new Date()) {
    throw { statusCode: 400, code: 'EXPIRED_VOUCHER', message: 'This voucher has expired.' };
  }

  if (v.usage_limit && v.used_count >= v.usage_limit) {
    throw { statusCode: 400, code: 'VOUCHER_EXHAUSTED', message: 'This voucher has reached its redemption limit.' };
  }

  if (subtotal < Number(v.min_spend)) {
    throw {
      statusCode: 400,
      code: 'MIN_SPEND_NOT_MET',
      message: `Minimum spend of ₱${Number(v.min_spend).toLocaleString()} required for this voucher.`
    };
  }

  let discount = 0;
  if (v.discount_type === 'PERCENTAGE') {
    discount = (subtotal * Number(v.discount_value)) / 100;
    if (v.max_discount && discount > Number(v.max_discount)) {
      discount = Number(v.max_discount);
    }
  } else {
    discount = Number(v.discount_value);
  }

  return {
    valid: true,
    code: v.code,
    discountAmount: Number(discount.toFixed(2)),
    voucher: v
  };
}

// ------------------------------------------------------------------------------
// ORDERS & CHECKOUT (WITH AUTO-DISPATCH CREATION)
// ------------------------------------------------------------------------------

export async function createOrder(data: {
  userId?: string;
  externalOrderId?: string;
  orderDate?: string;
  requiredDeliveryDate?: string;
  currency?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  paymentMethod: string;
  gcashRefNumber?: string;
  proofImage?: string;
  subtotal: number;
  discount?: number;
  total: number;
  voucherCode?: string;
  items: Array<{
    productId?: string;
    externalLineId?: string;
    title: string;
    price: number;
    quantity: number;
    total: number;
  }>;
}) {
  // Idempotent replay if externalOrderId already exists
  if (data.externalOrderId) {
    const existing = await query(
      `SELECT * FROM shop.orders WHERE external_order_id = $1`,
      [data.externalOrderId]
    );
    if (existing.rows.length > 0) {
      return {
        ...existing.rows[0],
        replayed: true
      };
    }
  }

  const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const defaultTrackingSteps = [
    { step: 'Order Placed', time: new Date().toISOString(), done: true },
    { step: 'Factory Packed', time: '', done: false },
    { step: 'In Transit', time: '', done: false },
    { step: 'Out for Delivery', time: '', done: false },
    { step: 'Delivered', time: '', done: false }
  ];

  // 1. Insert Order
  const orderRes = await query(
    `INSERT INTO shop.orders (
       order_number, external_order_id, user_id, customer_name, customer_email, customer_phone,
       delivery_address, delivery_notes, order_date, required_delivery_date, currency,
       payment_method, payment_status,
       gcash_ref_number, proof_image, subtotal, discount, total,
       delivery_status, current_tracking_step, tracking_steps
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE), $10::date, $11, $12, $13, $14, $15, $16, $17, $18, 'Pending', 'Order Placed', $19)
     RETURNING *`,
    [
      orderNumber,
      data.externalOrderId || null,
      data.userId || null,
      data.customerName,
      data.customerEmail,
      data.customerPhone,
      data.deliveryAddress,
      data.deliveryNotes || '',
      data.orderDate || null,
      data.requiredDeliveryDate || null,
      data.currency || 'PHP',
      data.paymentMethod,
      data.paymentMethod === 'COD' ? 'Pending' : data.gcashRefNumber ? 'Paid' : 'Pending',
      data.gcashRefNumber || null,
      data.proofImage || null,
      data.subtotal,
      data.discount || 0,
      data.total,
      JSON.stringify(defaultTrackingSteps)
    ]
  );

  const order = orderRes.rows[0];

  // 2. Insert Order Items & decrement product stock
  for (const item of data.items) {
    await query(
      `INSERT INTO shop.order_items (order_id, product_id, external_line_id, title, price, quantity, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [order.id, item.productId || null, item.externalLineId || null, item.title, item.price, item.quantity, item.total]
    );

    if (item.productId) {
      await query(
        `UPDATE shop.products SET stock = GREATEST(0, stock - $1) WHERE id = $2`,
        [item.quantity, item.productId]
      );
    }
  }

  // 3. Increment voucher usage if applied
  if (data.voucherCode) {
    await query(
      `UPDATE shop.vouchers SET used_count = used_count + 1 WHERE UPPER(code) = UPPER($1)`,
      [data.voucherCode]
    );
  }

  // 4. AUTOMATED CROSS-MODULE INTEGRATION: Create Dispatch in Fleetops!
  const dispatchNumber = `DSP-${Date.now().toString().slice(-6)}`;
  await query(
    `INSERT INTO fleet.dispatches (
       dispatch_number, order_id, pickup_address, delivery_address, status, scheduled_at
     ) VALUES ($1, $2, 'Archon Nell Main Chemical Plant, Cavite Industrial Park', $3, 'Scheduled', NOW())`,
    [dispatchNumber, order.id, data.deliveryAddress]
  );

  return {
    ...order,
    dispatchNumber
  };
}

export async function getAllOrders(options: {
  userId?: string;
  status?: string;
  search?: string;
} = {}) {
  let sql = `
    SELECT o.*, COUNT(oi.id)::int AS total_items,
           d.dispatch_number, d.status AS dispatch_status, d.driver_id,
           dr.first_name AS driver_first_name, dr.last_name AS driver_last_name
    FROM shop.orders o
    LEFT JOIN shop.order_items oi ON oi.order_id = o.id
    LEFT JOIN fleet.dispatches d ON d.order_id = o.id
    LEFT JOIN fleet.drivers drv ON drv.id = d.driver_id
    LEFT JOIN hrms.employees dr ON dr.id = drv.employee_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (options.userId) {
    params.push(options.userId);
    sql += ` AND o.user_id = $${params.length}`;
  }
  if (options.status && options.status !== 'all') {
    params.push(options.status);
    sql += ` AND o.delivery_status = $${params.length}`;
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    sql += ` AND (o.order_number ILIKE $${params.length} OR o.customer_name ILIKE $${params.length} OR o.customer_email ILIKE $${params.length})`;
  }

  sql += ` GROUP BY o.id, d.dispatch_number, d.status, d.driver_id, dr.first_name, dr.last_name ORDER BY o.created_at DESC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function getOrderByIdOrNumber(identifier: string) {
  const orderRes = await query(
    `SELECT o.*, d.dispatch_number, d.status AS dispatch_status,
            v.plate_number, v.model AS vehicle_model,
            dr.first_name AS driver_first_name, dr.last_name AS driver_last_name, dr.phone AS driver_phone
     FROM shop.orders o
     LEFT JOIN fleet.dispatches d ON d.order_id = o.id
     LEFT JOIN fleet.vehicles v ON v.id = d.vehicle_id
     LEFT JOIN fleet.drivers drv ON drv.id = d.driver_id
     LEFT JOIN hrms.employees dr ON dr.id = drv.employee_id
     WHERE o.id = $1 OR o.order_number = $1`,
    [identifier]
  );

  if (orderRes.rows.length === 0) {
    throw { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' };
  }

  const itemsRes = await query(
    `SELECT * FROM shop.order_items WHERE order_id = $1`,
    [orderRes.rows[0].id]
  );

  return {
    ...orderRes.rows[0],
    items: itemsRes.rows
  };
}

export async function updateOrderStatus(orderId: string, deliveryStatus: string, trackingStep?: string) {
  const orderRes = await query('SELECT * FROM shop.orders WHERE id = $1', [orderId]);
  if (orderRes.rows.length === 0) {
    throw { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' };
  }

  const order = orderRes.rows[0];
  let steps = typeof order.tracking_steps === 'string' ? JSON.parse(order.tracking_steps) : order.tracking_steps;

  if (trackingStep && Array.isArray(steps)) {
    const nowStr = new Date().toISOString();
    steps = steps.map((s: any) => {
      if (s.step === trackingStep) {
        return { ...s, done: true, time: nowStr };
      }
      return s;
    });
  }

  const result = await query(
    `UPDATE shop.orders
     SET delivery_status = $1,
         current_tracking_step = COALESCE($2, current_tracking_step),
         tracking_steps = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [deliveryStatus, trackingStep || null, JSON.stringify(steps), orderId]
  );

  return result.rows[0];
}

// ------------------------------------------------------------------------------
// REVIEWS
// ------------------------------------------------------------------------------

export async function getProductReviews(productId: string) {
  const result = await query(
    `SELECT * FROM shop.reviews WHERE product_id = $1 ORDER BY created_at DESC`,
    [productId]
  );
  return result.rows;
}

export async function createProductReview(data: {
  productId: string;
  userId?: string;
  customerName: string;
  rating: number;
  comment?: string;
  aiSentiment?: string;
}) {
  const result = await query(
    `INSERT INTO shop.reviews (
       product_id, user_id, customer_name, rating, comment, ai_sentiment, is_verified_purchase
     ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     RETURNING *`,
    [
      data.productId,
      data.userId || null,
      data.customerName,
      data.rating,
      data.comment || null,
      data.aiSentiment || 'POSITIVE'
    ]
  );
  return result.rows[0];
}

// ------------------------------------------------------------------------------
// SMARTCHAIN CANCELLATION & RETURN REQUESTS
// ------------------------------------------------------------------------------

export async function requestOrderCancellation(
  identifier: string,
  data: { external_request_id: string; reason: string }
) {
  const orderRes = await query(
    `SELECT * FROM shop.orders
     WHERE id::text = $1 OR order_number = $1 OR external_order_id = $1
     LIMIT 1`,
    [identifier]
  );

  if (orderRes.rows.length === 0) {
    throw { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' };
  }

  const order = orderRes.rows[0];

  if (order.delivery_status === 'Cancelled') {
    return {
      replayed: true,
      order_no: order.order_number,
      external_order_id: order.external_order_id || identifier,
      external_request_id: data.external_request_id,
      status: 'CANCELLED'
    };
  }

  if (['Dispatched', 'Delivered'].includes(order.delivery_status)) {
    throw {
      statusCode: 422,
      code: 'CANCELLATION_NOT_ALLOWED',
      message: `Order in status '${order.delivery_status}' can no longer be cancelled at early stage.`
    };
  }

  await query(
    `UPDATE shop.orders
     SET delivery_status = 'Cancelled',
         cancellation_reason = $1,
         cancelled_at = NOW(),
         updated_at = NOW()
     WHERE id = $2`,
    [data.reason, order.id]
  );

  return {
    replayed: false,
    order_no: order.order_number,
    external_order_id: order.external_order_id || identifier,
    external_request_id: data.external_request_id,
    status: 'CANCELLED'
  };
}

export async function createReturnRequest(data: {
  external_request_id: string;
  external_order_id: string;
  external_line_id: string;
  quantity: number;
  reason: string;
}) {
  const existing = await query(
    `SELECT * FROM shop.return_requests WHERE external_request_id = $1`,
    [data.external_request_id]
  );
  if (existing.rows.length > 0) {
    const r = existing.rows[0];
    return {
      replayed: true,
      return_reference: r.return_reference,
      status: r.status
    };
  }

  const orderRes = await query(
    `SELECT id FROM shop.orders WHERE external_order_id = $1 OR order_number = $1 OR id::text = $1 LIMIT 1`,
    [data.external_order_id]
  );
  const orderId = orderRes.rows[0]?.id || null;
  const returnReference = `CR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const result = await query(
    `INSERT INTO shop.return_requests (
       return_reference, external_request_id, order_id, external_order_id, external_line_id, quantity, reason, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'REQUESTED')
     RETURNING *`,
    [
      returnReference,
      data.external_request_id,
      orderId,
      data.external_order_id,
      data.external_line_id,
      data.quantity,
      data.reason
    ]
  );

  return {
    replayed: false,
    return_reference: result.rows[0].return_reference,
    status: result.rows[0].status,
    data: result.rows[0]
  };
}
