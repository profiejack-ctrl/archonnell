// ==============================================================================
// ARCHON NELL INCORPORATED - SHOP & E-COMMERCE FACTORY & SEEDER
// Populates shop.categories, products, vouchers, orders, order_items, reviews
// ==============================================================================
import { query } from '../connection.js';
import { SHOP_CATEGORIES, ARCHON_PRODUCTS, SHOP_VOUCHERS, REALISTIC_REVIEWS } from './dataSets.js';
export async function seedShop(customerUsers) {
    console.log('   ↳ [ShopFactory] Seeding product categories...');
    const categoryMap = new Map(); // slug -> id
    for (const c of SHOP_CATEGORIES) {
        const res = await query(`INSERT INTO shop.categories (name, slug, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name, description = EXCLUDED.description
       RETURNING id, slug`, [c.name, c.slug, c.description]);
        categoryMap.set(res.rows[0].slug, res.rows[0].id);
    }
    console.log('   ↳ [ShopFactory] Seeding construction chemical products with technical specifications...');
    const productMap = new Map();
    for (const p of ARCHON_PRODUCTS) {
        const catId = categoryMap.get(p.categorySlug);
        const existing = await query('SELECT id FROM shop.products WHERE custom_id = $1', [p.customId]);
        let prodId;
        if (existing.rows.length > 0) {
            prodId = existing.rows[0].id;
            await query(`UPDATE shop.products
         SET category_id = $1, title = $2, description = $3, price = $4,
             stock = $5, sku = $6, images = $7, specs = $8, is_active = TRUE, updated_at = NOW()
         WHERE id = $9`, [
                catId || null,
                p.title,
                p.description,
                p.price,
                p.stock,
                p.sku,
                JSON.stringify(p.images),
                JSON.stringify(p.specs),
                prodId
            ]);
        }
        else {
            const res = await query(`INSERT INTO shop.products (
           category_id, custom_id, title, description, price, stock, sku, images, specs, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
         RETURNING id`, [
                catId || null,
                p.customId,
                p.title,
                p.description,
                p.price,
                p.stock,
                p.sku,
                JSON.stringify(p.images),
                JSON.stringify(p.specs)
            ]);
            prodId = res.rows[0].id;
        }
        productMap.set(p.customId, { id: prodId, title: p.title, price: p.price });
    }
    console.log('   ↳ [ShopFactory] Seeding promotional vouchers...');
    for (const v of SHOP_VOUCHERS) {
        await query(`INSERT INTO shop.vouchers (
         code, discount_type, discount_value, min_spend, max_discount,
         usage_limit, used_count, expires_at, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (code) DO UPDATE
       SET discount_value = EXCLUDED.discount_value,
           min_spend = EXCLUDED.min_spend,
           max_discount = EXCLUDED.max_discount,
           is_active = EXCLUDED.is_active`, [
            v.code,
            v.discountType,
            v.discountValue,
            v.minSpend,
            v.maxDiscount,
            v.usageLimit,
            v.usedCount,
            v.expiresAt,
            v.isActive
        ]);
    }
    console.log('   ↳ [ShopFactory] Seeding realistic customer orders with multi-step tracking timelines...');
    const ordersData = [
        {
            orderNumber: 'AN-ORD-2026-88412',
            customerName: 'Engr. Kent Tagle',
            customerEmail: 'kent.tagle@eei.com.ph',
            customerPhone: '0928-987-6543',
            deliveryAddress: 'Lot 14 Blk 3 Mega Highway Depot, C-5 Corridor, Pasig City, Metro Manila',
            deliveryNotes: 'Gate 1 Industrial Staging Area. Crane available on site.',
            paymentMethod: 'GCash',
            paymentStatus: 'Paid',
            gcashRef: 'GC-987654321000',
            deliveryStatus: 'Delivered',
            currentTrackingStep: 'Delivered',
            items: [{ customId: 'prod-1', qty: 10 }, { customId: 'prod-5', qty: 8 }],
            discount: 500.00
        },
        {
            orderNumber: 'AN-ORD-2026-88413',
            customerName: 'Engr. Carlos Mendoza (DMCI)',
            customerEmail: 'carlos.mendoza@dmci.com.ph',
            customerPhone: '0918-555-1201',
            deliveryAddress: 'DMCI Compound, Pasong Tamo Ext., Makati City, Metro Manila',
            deliveryNotes: 'Deliver to Basement Batching Staging Room.',
            paymentMethod: 'Maya',
            paymentStatus: 'Paid',
            gcashRef: 'MYA-554433221101',
            deliveryStatus: 'Delivered',
            currentTrackingStep: 'Delivered',
            items: [{ customId: 'prod-3', qty: 6 }, { customId: 'prod-2', qty: 4 }],
            discount: 0.00
        },
        {
            orderNumber: 'AN-ORD-2026-88414',
            customerName: 'Arch. Maricel Reyes',
            customerEmail: 'maricel.reyes@archstudio.ph',
            customerPhone: '0917-333-8822',
            deliveryAddress: 'Unit 1502 High Street South Corporate Plaza, BGC, Taguig City',
            deliveryNotes: 'Call client 30 minutes before arrival for security pass.',
            paymentMethod: 'Bank',
            paymentStatus: 'Paid',
            gcashRef: 'BDO-TRX-998811',
            deliveryStatus: 'Dispatched',
            currentTrackingStep: 'Out for Delivery',
            items: [{ customId: 'prod-7', qty: 3 }, { customId: 'prod-10', qty: 20 }],
            discount: 1500.00
        },
        {
            orderNumber: 'AN-ORD-2026-88415',
            customerName: 'Engr. Antonio Aquino',
            customerEmail: 'antonio.aquino@conmix.ph',
            customerPhone: '0919-444-9911',
            deliveryAddress: 'Conmix Batching Facility, Cavite Economic Zone, Rosario, Cavite',
            deliveryNotes: 'Bulk delivery of 200L chemical drums. Forklift ready.',
            paymentMethod: 'Bank',
            paymentStatus: 'Paid',
            gcashRef: 'BPI-CORP-44321',
            deliveryStatus: 'Dispatched',
            currentTrackingStep: 'Out for Delivery',
            items: [{ customId: 'prod-12', qty: 2 }, { customId: 'prod-3', qty: 8 }],
            discount: 3000.00
        },
        {
            orderNumber: 'AN-ORD-2026-88416',
            customerName: 'Patricia Lim',
            customerEmail: 'patricia.lim@megawide.com.ph',
            customerPhone: '0927-111-4455',
            deliveryAddress: 'Megawide Construction Yard, Commonwealth Ave, Quezon City',
            deliveryNotes: 'Building B Material Depot.',
            paymentMethod: 'GCash',
            paymentStatus: 'Paid',
            gcashRef: 'GC-445566778899',
            deliveryStatus: 'Processing',
            currentTrackingStep: 'Factory Packed',
            items: [{ customId: 'prod-4', qty: 15 }, { customId: 'prod-8', qty: 10 }],
            discount: 1000.00
        },
        {
            orderNumber: 'AN-ORD-2026-88417',
            customerName: 'Rowena Dela Cruz',
            customerEmail: 'rowena.delacruz@megabuild.ph',
            customerPhone: '0918-666-7788',
            deliveryAddress: 'Filinvest Corporate City, Alabang, Muntinlupa City',
            deliveryNotes: 'Side entrance loading dock.',
            paymentMethod: 'COD',
            paymentStatus: 'Pending',
            gcashRef: null,
            deliveryStatus: 'Pending',
            currentTrackingStep: 'Order Placed',
            items: [{ customId: 'prod-9', qty: 12 }, { customId: 'prod-11', qty: 4 }],
            discount: 0.00
        }
    ];
    const orders = [];
    for (const o of ordersData) {
        const matchedUser = customerUsers.find((u) => u.email === o.customerEmail);
        let subtotal = 0;
        const computedItems = [];
        for (const item of o.items) {
            const prod = productMap.get(item.customId);
            if (prod) {
                const itemTotal = Number((prod.price * item.qty).toFixed(2));
                subtotal += itemTotal;
                computedItems.push({
                    productId: prod.id,
                    title: prod.title,
                    price: prod.price,
                    quantity: item.qty,
                    total: itemTotal
                });
            }
        }
        const total = Math.max(0, Number((subtotal - o.discount).toFixed(2)));
        const trackingSteps = [
            { step: 'Order Placed', time: 'Oct 15, 2026 - 09:00 AM', done: true },
            { step: 'Payment Verified', time: o.paymentStatus === 'Paid' ? 'Payment Confirmed' : 'Pending Verification', done: o.paymentStatus === 'Paid' },
            { step: 'Factory Packed', time: ['Processing', 'Dispatched', 'Delivered'].includes(o.deliveryStatus) ? 'Oct 15, 2026 - 02:00 PM' : 'In Queue', done: ['Processing', 'Dispatched', 'Delivered'].includes(o.deliveryStatus) },
            { step: 'Out for Delivery', time: ['Dispatched', 'Delivered'].includes(o.deliveryStatus) ? 'Oct 16, 2026 - 08:30 AM' : 'Pending', done: ['Dispatched', 'Delivered'].includes(o.deliveryStatus) },
            { step: 'Delivered', time: o.deliveryStatus === 'Delivered' ? 'Oct 16, 2026 - 03:45 PM' : 'Pending', done: o.deliveryStatus === 'Delivered' }
        ];
        const orderRes = await query(`INSERT INTO shop.orders (
         order_number, user_id, customer_name, customer_email, customer_phone,
         delivery_address, delivery_notes, payment_method, payment_status,
         gcash_ref_number, subtotal, discount, total, delivery_status,
         current_tracking_step, tracking_steps
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (order_number) DO UPDATE
       SET payment_status = EXCLUDED.payment_status,
           delivery_status = EXCLUDED.delivery_status,
           current_tracking_step = EXCLUDED.current_tracking_step,
           tracking_steps = EXCLUDED.tracking_steps
       RETURNING id, order_number, user_id, customer_name, customer_email, customer_phone, delivery_address, delivery_status, total`, [
            o.orderNumber,
            matchedUser?.id || null,
            o.customerName,
            o.customerEmail,
            o.customerPhone,
            o.deliveryAddress,
            o.deliveryNotes,
            o.paymentMethod,
            o.paymentStatus,
            o.gcashRef,
            subtotal,
            o.discount,
            total,
            o.deliveryStatus,
            o.currentTrackingStep,
            JSON.stringify(trackingSteps)
        ]);
        const orderRecord = {
            id: orderRes.rows[0].id,
            orderNumber: orderRes.rows[0].order_number,
            userId: orderRes.rows[0].user_id,
            customerName: orderRes.rows[0].customer_name,
            customerEmail: orderRes.rows[0].customer_email,
            customerPhone: orderRes.rows[0].customer_phone,
            deliveryAddress: orderRes.rows[0].delivery_address,
            deliveryStatus: orderRes.rows[0].delivery_status,
            total: Number(orderRes.rows[0].total)
        };
        orders.push(orderRecord);
        // Insert order items
        for (const ci of computedItems) {
            await query(`INSERT INTO shop.order_items (order_id, product_id, title, price, quantity, total)
         VALUES ($1, $2, $3, $4, $5, $6)`, [orderRecord.id, ci.productId, ci.title, ci.price, ci.quantity, ci.total]);
        }
    }
    console.log('   ↳ [ShopFactory] Seeding verified contractor product reviews...');
    for (const r of REALISTIC_REVIEWS) {
        const prod = productMap.get(r.productId);
        if (!prod)
            continue;
        await query(`INSERT INTO shop.reviews (product_id, customer_name, rating, comment, ai_sentiment, is_verified_purchase)
       VALUES ($1, $2, $3, $4, $5, TRUE)`, [prod.id, r.customerName, r.rating, r.comment, r.aiSentiment]);
    }
    console.log(`   ✅ [ShopFactory] Seeded ${SHOP_CATEGORIES.length} categories, ${ARCHON_PRODUCTS.length} products, ${SHOP_VOUCHERS.length} vouchers, ${orders.length} orders, and ${REALISTIC_REVIEWS.length} reviews.`);
    return { categoryMap, productMap, orders };
}
