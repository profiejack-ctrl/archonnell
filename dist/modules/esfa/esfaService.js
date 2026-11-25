import { query } from '../../db/connection.js';
// ------------------------------------------------------------------------------
// SUPPORT TICKETS & KNOWLEDGE BASE
// ------------------------------------------------------------------------------
export async function listTickets() {
    const res = await query(`SELECT * FROM esfa.tickets ORDER BY created_at DESC LIMIT 100`);
    return res.rows;
}
export async function createTicket(data, idempotencyKey) {
    if (idempotencyKey) {
        const existing = await query(`SELECT * FROM esfa.tickets WHERE idempotency_key = $1`, [idempotencyKey]);
        if (existing.rows.length > 0) {
            return { replayed: true, ticket: existing.rows[0] };
        }
    }
    const reference = `TCK-${Date.now().toString().slice(-6)}`;
    const res = await query(`INSERT INTO esfa.tickets (
       reference, idempotency_key, requester_type, requester_external_id,
       order_external_id, payment_reference, subject, description,
       channel, category, priority, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open')
     RETURNING *`, [
        reference,
        idempotencyKey || null,
        data.requester_type || 'customer',
        data.requester_external_id,
        data.order_external_id || null,
        data.payment_reference || null,
        data.subject,
        data.description,
        data.channel || 'marketplace_app',
        data.category || 'general',
        data.priority || 'medium',
    ]);
    return { replayed: false, ticket: res.rows[0] };
}
export async function getTicket(reference) {
    const res = await query(`SELECT * FROM esfa.tickets WHERE reference = $1 OR id::text = $1 LIMIT 1`, [reference]);
    if (res.rows.length === 0) {
        throw { statusCode: 404, code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' };
    }
    const ticket = res.rows[0];
    const msgs = await query(`SELECT * FROM esfa.ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`, [ticket.id]);
    return { ...ticket, messages: msgs.rows };
}
export async function addTicketMessage(reference, body, authorType = 'customer') {
    const ticket = await getTicket(reference);
    const res = await query(`INSERT INTO esfa.ticket_messages (ticket_id, author_type, body)
     VALUES ($1, $2, $3) RETURNING *`, [ticket.id, authorType, body]);
    if (ticket.status === 'waiting_on_customer' || ticket.status === 'open') {
        await query(`UPDATE esfa.tickets SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [ticket.id]);
    }
    return res.rows[0];
}
export async function submitTicketCsat(reference, score, comment) {
    const ticket = await getTicket(reference);
    const res = await query(`UPDATE esfa.tickets SET csat_score = $1, csat_comment = $2, updated_at = NOW() WHERE id = $3 RETURNING *`, [score, comment || null, ticket.id]);
    return res.rows[0];
}
export async function listKbArticles() {
    const res = await query(`SELECT * FROM esfa.kb_articles WHERE is_published = TRUE ORDER BY created_at DESC`);
    return res.rows;
}
// ------------------------------------------------------------------------------
// PAYMENTS & REFUNDS (CENTAVOS)
// ------------------------------------------------------------------------------
export async function createPayment(data, idempotencyKey) {
    if (idempotencyKey) {
        const existing = await query(`SELECT * FROM esfa.payments WHERE idempotency_key = $1`, [idempotencyKey]);
        if (existing.rows.length > 0) {
            return { replayed: true, payment: existing.rows[0] };
        }
    }
    let amount = data.amount;
    if (amount === undefined) {
        const ord = await query(`SELECT total FROM shop.orders WHERE external_order_id = $1 OR order_number = $1 OR id::text = $1 LIMIT 1`, [data.order_external_id]);
        amount = ord.rows[0] ? Math.round(Number(ord.rows[0].total) * 100) : 158000;
    }
    const reference = `PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const status = amount % 100 === 99 ? 'declined' : amount % 100 === 98 ? 'pending' : 'captured';
    const res = await query(`INSERT INTO esfa.payments (reference, idempotency_key, order_external_id, method, amount, currency, status)
     VALUES ($1, $2, $3, $4, $5, 'PHP', $6) RETURNING *`, [reference, idempotencyKey || null, data.order_external_id, data.method, amount, status]);
    return { replayed: false, payment: res.rows[0] };
}
export async function getPayment(reference) {
    const res = await query(`SELECT * FROM esfa.payments WHERE reference = $1 OR id::text = $1 LIMIT 1`, [reference]);
    if (res.rows.length === 0) {
        throw { statusCode: 404, code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' };
    }
    return res.rows[0];
}
export async function createRefund(data, idempotencyKey) {
    if (idempotencyKey) {
        const existing = await query(`SELECT * FROM esfa.refunds WHERE idempotency_key = $1`, [idempotencyKey]);
        if (existing.rows.length > 0) {
            return { replayed: true, refund: existing.rows[0] };
        }
    }
    const reference = `REF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const res = await query(`INSERT INTO esfa.refunds (reference, idempotency_key, payment_reference, amount, reason, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending_review') RETURNING *`, [reference, idempotencyKey || null, data.payment_reference, data.amount, data.reason, data.notes || null]);
    return { replayed: false, refund: res.rows[0] };
}
export async function getRefund(reference) {
    const res = await query(`SELECT * FROM esfa.refunds WHERE reference = $1 OR id::text = $1 LIMIT 1`, [reference]);
    if (res.rows.length === 0) {
        throw { statusCode: 404, code: 'REFUND_NOT_FOUND', message: 'Refund not found.' };
    }
    return res.rows[0];
}
// ------------------------------------------------------------------------------
// LOGISTICS QUOTES & SHIPMENTS
// ------------------------------------------------------------------------------
export function calculateQuotes(weightGrams, codAmount = 0) {
    const kg = Math.max(1, Math.ceil(weightGrams / 1000));
    const baseFee = 6500 + (kg - 1) * 2500 + (codAmount > 0 ? 1500 : 0);
    return [
        {
            courier_id: 1,
            courier_name: 'Archon Nell Fleet Express',
            service_type: 'standard',
            fee_amount: baseFee,
            currency: 'PHP',
            estimated_days: 2,
            recommended: true,
        },
        {
            courier_id: 2,
            courier_name: 'Archon Nell Priority',
            service_type: 'express',
            fee_amount: baseFee + 4500,
            currency: 'PHP',
            estimated_days: 1,
            recommended: false,
        },
    ];
}
export async function createShipment(data, idempotencyKey) {
    if (idempotencyKey) {
        const existing = await query(`SELECT * FROM esfa.shipments WHERE idempotency_key = $1`, [idempotencyKey]);
        if (existing.rows.length > 0) {
            return { replayed: true, shipment: existing.rows[0] };
        }
    }
    const quotes = calculateQuotes(data.weight_grams || 1000);
    const selected = quotes.find((q) => q.courier_id === data.courier_id) || quotes[0];
    const reference = `SHP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const trackingNumber = data.tracking_number || `TRK-${Date.now().toString().slice(-6)}`;
    const res = await query(`INSERT INTO esfa.shipments (
       reference, idempotency_key, order_external_id, seller_external_id,
       courier_id, service_type, tracking_number, shipping_fee_amount,
       destination, weight_grams, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
     RETURNING *`, [
        reference,
        idempotencyKey || null,
        data.order_external_id,
        data.seller_external_id || null,
        selected.courier_id,
        data.service_type || selected.service_type,
        trackingNumber,
        selected.fee_amount,
        JSON.stringify(data.destination || {}),
        data.weight_grams || 1000,
    ]);
    return { replayed: false, shipment: res.rows[0] };
}
export async function getShipment(reference) {
    const res = await query(`SELECT * FROM esfa.shipments WHERE reference = $1 OR tracking_number = $1 OR id::text = $1 LIMIT 1`, [reference]);
    if (res.rows.length === 0) {
        throw { statusCode: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment not found.' };
    }
    return res.rows[0];
}
// ------------------------------------------------------------------------------
// ANALYTICS & WEBHOOK ENDPOINTS
// ------------------------------------------------------------------------------
export async function getAnalyticsSummary() {
    const [tickets, payments, refunds, shipments] = await Promise.all([
        query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'open')::int AS open FROM esfa.tickets`),
        query(`SELECT COUNT(*)::int AS total, COALESCE(SUM(amount), 0)::bigint AS total_amount FROM esfa.payments WHERE status = 'captured'`),
        query(`SELECT COUNT(*)::int AS total, COALESCE(SUM(amount), 0)::bigint AS total_amount FROM esfa.refunds`),
        query(`SELECT COUNT(*)::int AS total FROM esfa.shipments`),
    ]);
    return {
        tickets: tickets.rows[0],
        payments: payments.rows[0],
        refunds: refunds.rows[0],
        shipments: shipments.rows[0],
    };
}
export async function listWebhookEndpoints() {
    const res = await query(`SELECT * FROM esfa.webhook_endpoints ORDER BY created_at DESC`);
    return res.rows;
}
export async function createWebhookEndpoint(url, events = ['*']) {
    const res = await query(`INSERT INTO esfa.webhook_endpoints (url, events, is_active) VALUES ($1, $2, TRUE) RETURNING *`, [url, JSON.stringify(events)]);
    return res.rows[0];
}
