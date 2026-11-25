import crypto from 'crypto';
import { query } from '../../db/connection.js';

function hashPayload(payload: unknown): string {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

const STATUS_RANK: Record<string, number> = {
  SCHEDULED: 1,
  IN_TRANSIT: 2,
  DELIVERED: 3,
};

// ------------------------------------------------------------------------------
// LOGISTICS: DELIVERY REQUESTS & STATUS EVENTS
// ------------------------------------------------------------------------------

export async function createDeliveryRequest(
  data: {
    schema_version?: string;
    source_system?: string;
    delivery_request_id: string;
    order_reference: string;
    shipment_reference: string;
    partner_code: string;
    pickup: Record<string, any>;
    recipient: Record<string, any>;
    required_delivery_at?: string;
    items: any[];
    callback?: { url?: string };
  },
  idempotencyKey?: string,
  correlationId?: string
) {
  const existing = await query(
    `SELECT * FROM smartchain.delivery_requests WHERE delivery_request_id = $1`,
    [data.delivery_request_id]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      replayed: true,
      delivery_request_id: row.delivery_request_id,
      partner_delivery_request_id: row.partner_delivery_request_id,
      status: row.status,
      data: row,
    };
  }

  const partnerDeliveryId = `LSP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const result = await query(
    `INSERT INTO smartchain.delivery_requests (
       delivery_request_id, order_reference, shipment_reference, partner_code,
       partner_delivery_request_id, pickup, recipient, required_delivery_at,
       items, callback_url, status, idempotency_key, correlation_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SCHEDULED', $11, $12)
     RETURNING *`,
    [
      data.delivery_request_id,
      data.order_reference,
      data.shipment_reference,
      data.partner_code,
      partnerDeliveryId,
      JSON.stringify(data.pickup || {}),
      JSON.stringify(data.recipient || {}),
      data.required_delivery_at || null,
      JSON.stringify(data.items || []),
      data.callback?.url || null,
      idempotencyKey || null,
      correlationId || null,
    ]
  );

  // Best-effort link to Fleetops dispatches
  try {
    await query(
      `INSERT INTO fleet.dispatches (
         dispatch_number, pickup_address, delivery_address, status, scheduled_at
       ) VALUES ($1, $2, $3, 'Scheduled', COALESCE($4::timestamptz, NOW()))
       ON CONFLICT (dispatch_number) DO NOTHING`,
      [
        partnerDeliveryId,
        data.pickup?.address || data.pickup?.name || 'SmartChain Pickup',
        data.recipient?.address || data.recipient?.name || 'SmartChain Recipient',
        data.required_delivery_at || null,
      ]
    );
  } catch (err: any) {
    console.warn('[SmartChain] Fleet dispatch mirror skipped:', err.message);
  }

  return {
    replayed: false,
    delivery_request_id: result.rows[0].delivery_request_id,
    partner_delivery_request_id: partnerDeliveryId,
    status: result.rows[0].status,
    data: result.rows[0],
  };
}

export async function processLogisticsStatusEvent(
  data: {
    schema_version: string;
    event_id: string;
    delivery_request_id: string;
    partner_delivery_request_id: string;
    status: 'IN_TRANSIT' | 'DELIVERED';
    occurred_at: string;
    note?: string | null;
    proof_reference?: string | null;
  },
  partnerCode: string,
  rawBody: string | unknown
) {
  const payloadHash = hashPayload(rawBody);

  // 1. Idempotency check on (partner_code, event_id)
  const existingEvent = await query(
    `SELECT * FROM smartchain.logistics_status_events WHERE partner_code = $1 AND event_id = $2`,
    [partnerCode, data.event_id]
  );

  const deliveryRes = await query(
    `SELECT * FROM smartchain.delivery_requests WHERE delivery_request_id = $1`,
    [data.delivery_request_id]
  );

  if (existingEvent.rows.length > 0) {
    const prev = existingEvent.rows[0];
    if (prev.payload_hash !== payloadHash) {
      throw {
        statusCode: 409,
        code: 'EVENT_ID_CONFLICT',
        message: 'The event ID was already used with different content.',
      };
    }
    return {
      acknowledged: true,
      event_id: data.event_id,
      result: 'DUPLICATE',
      smartchain_status: deliveryRes.rows[0]?.status || data.status,
    };
  }

  if (deliveryRes.rows.length === 0) {
    throw {
      statusCode: 404,
      code: 'UNKNOWN_DELIVERY_REQUEST',
      message: 'The delivery request was not found.',
    };
  }

  const delivery = deliveryRes.rows[0];

  if (delivery.partner_code !== partnerCode) {
    throw {
      statusCode: 403,
      code: 'WRONG_PARTNER',
      message: 'This partner does not own the delivery request.',
    };
  }

  if (
    delivery.partner_delivery_request_id &&
    delivery.partner_delivery_request_id !== data.partner_delivery_request_id
  ) {
    throw {
      statusCode: 409,
      code: 'PARTNER_REFERENCE_MISMATCH',
      message: 'The partner delivery reference does not match the recorded reference.',
    };
  }

  const currentRank = STATUS_RANK[delivery.status] || 0;
  const incomingRank = STATUS_RANK[data.status] || 0;

  let eventResult: 'APPLIED' | 'IGNORED_OUT_OF_ORDER' = 'APPLIED';
  let finalStatus = delivery.status;

  if (incomingRank < currentRank) {
    eventResult = 'IGNORED_OUT_OF_ORDER';
  } else {
    finalStatus = data.status;
    await query(
      `UPDATE smartchain.delivery_requests
       SET status = $1, updated_at = NOW()
       WHERE delivery_request_id = $2`,
      [finalStatus, data.delivery_request_id]
    );

    // Sync Fleetops dispatch status if mirrored
    const fleetStatus = finalStatus === 'DELIVERED' ? 'Completed' : 'In Transit';
    await query(
      `UPDATE fleet.dispatches
       SET status = $1,
           completed_at = CASE WHEN $1 = 'Completed' THEN NOW() ELSE completed_at END,
           proof_of_delivery_url = COALESCE($2, proof_of_delivery_url)
       WHERE dispatch_number = $3`,
      [fleetStatus, data.proof_reference || null, data.partner_delivery_request_id]
    ).catch(() => {});
  }

  await query(
    `INSERT INTO smartchain.logistics_status_events (
       schema_version, event_id, partner_code, delivery_request_id,
       partner_delivery_request_id, status, occurred_at, note,
       proof_reference, payload_hash, result
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      data.schema_version,
      data.event_id,
      partnerCode,
      data.delivery_request_id,
      data.partner_delivery_request_id,
      data.status,
      data.occurred_at,
      data.note || null,
      data.proof_reference || null,
      payloadHash,
      eventResult,
    ]
  );

  return {
    acknowledged: true,
    event_id: data.event_id,
    result: eventResult,
    smartchain_status: finalStatus,
  };
}

export async function listDeliveryRequests() {
  const result = await query(
    `SELECT * FROM smartchain.delivery_requests ORDER BY created_at DESC LIMIT 100`
  );
  return result.rows;
}

// ------------------------------------------------------------------------------
// FINANCE: EVENTS, PURCHASE ORDERS & DISBURSEMENTS
// ------------------------------------------------------------------------------

export async function recordFinancialEvent(
  data: {
    schema_version: string;
    event_id: string;
    event_type: string;
    occurred_at: string;
    reference: string;
    status: string;
    amount?: string | number;
    currency?: string;
  },
  rawBody: string | unknown
) {
  const payloadHash = hashPayload(rawBody);
  const existing = await query(
    `SELECT * FROM smartchain.financial_events WHERE event_id = $1`,
    [data.event_id]
  );

  if (existing.rows.length > 0) {
    if (existing.rows[0].payload_hash !== payloadHash) {
      throw {
        statusCode: 409,
        code: 'EVENT_ID_CONFLICT',
        message: 'Identity reused with different data.',
      };
    }
    return {
      replayed: true,
      event_id: existing.rows[0].event_id,
      outcome: existing.rows[0].outcome,
    };
  }

  const result = await query(
    `INSERT INTO smartchain.financial_events (
       schema_version, event_id, event_type, occurred_at, reference, status, amount, currency, outcome, payload_hash
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_REVIEW', $9)
     RETURNING *`,
    [
      data.schema_version,
      data.event_id,
      data.event_type,
      data.occurred_at,
      data.reference,
      data.status,
      data.amount !== undefined && data.amount !== null ? Number(data.amount) : null,
      data.currency || 'PHP',
      payloadHash,
    ]
  );

  return {
    replayed: false,
    event_id: result.rows[0].event_id,
    outcome: result.rows[0].outcome,
    data: result.rows[0],
  };
}

export async function submitPurchaseOrder(
  data: {
    schema_version?: string;
    source_system?: string;
    message_id: string;
    external_reference_id: string;
    category_type: string;
    currency?: string;
    total_amount: string | number;
    supplier: Record<string, any>;
    items: any[];
  },
  idempotencyKey?: string,
  correlationId?: string
) {
  const existing = await query(
    `SELECT * FROM smartchain.purchase_orders WHERE message_id = $1 OR external_reference_id = $2`,
    [data.message_id, data.external_reference_id]
  );

  if (existing.rows.length > 0) {
    return {
      replayed: true,
      data: existing.rows[0],
    };
  }

  const result = await query(
    `INSERT INTO smartchain.purchase_orders (
       message_id, external_reference_id, source_system, category_type,
       currency, total_amount, supplier, items, idempotency_key, correlation_id, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'RECEIVED')
     RETURNING *`,
    [
      data.message_id,
      data.external_reference_id,
      data.source_system || 'SMARTCHAIN',
      data.category_type,
      data.currency || 'PHP',
      Number(data.total_amount),
      JSON.stringify(data.supplier || {}),
      JSON.stringify(data.items || []),
      idempotencyKey || null,
      correlationId || null,
    ]
  );

  return {
    replayed: false,
    data: result.rows[0],
  };
}

export async function requestDisbursement(data: {
  external_module: string;
  external_reference_id: string;
  category_type: string;
  amount: number;
  payee_info: Record<string, any>;
  description?: string;
}) {
  const existing = await query(
    `SELECT * FROM smartchain.disbursement_requests WHERE external_reference_id = $1`,
    [data.external_reference_id]
  );

  if (existing.rows.length > 0) {
    const r = existing.rows[0];
    return {
      bill_number: r.bill_number,
      transaction_code: r.transaction_code,
      status: r.status,
      data: r,
    };
  }

  const suffix = `${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
  const billNumber = `BILL-SC-${suffix}`;
  const transactionCode = `TRX-SC-${suffix}`;

  const result = await query(
    `INSERT INTO smartchain.disbursement_requests (
       external_module, external_reference_id, category_type, amount,
       payee_info, description, bill_number, transaction_code, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'UNPAID')
     RETURNING *`,
    [
      data.external_module,
      data.external_reference_id,
      data.category_type,
      Number(data.amount),
      JSON.stringify(data.payee_info || {}),
      data.description || null,
      billNumber,
      transactionCode,
    ]
  );

  return {
    bill_number: billNumber,
    transaction_code: transactionCode,
    status: 'UNPAID',
    data: result.rows[0],
  };
}

export async function listFinanceRecords() {
  const [events, purchaseOrders, disbursements] = await Promise.all([
    query(`SELECT * FROM smartchain.financial_events ORDER BY created_at DESC LIMIT 50`),
    query(`SELECT * FROM smartchain.purchase_orders ORDER BY created_at DESC LIMIT 50`),
    query(`SELECT * FROM smartchain.disbursement_requests ORDER BY created_at DESC LIMIT 50`),
  ]);

  return {
    events: events.rows,
    purchase_orders: purchaseOrders.rows,
    disbursements: disbursements.rows,
  };
}
