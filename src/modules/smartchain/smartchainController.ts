import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import * as smartchainService from './smartchainService.js';

function verifySmartChainSignature(req: Request): { ok: true; partner: string } | { ok: false; code: string; message: string } {
  const partner = String(req.header('X-SmartChain-Partner') || '').trim();
  const timestamp = String(req.header('X-SmartChain-Timestamp') || '').trim();
  const signature = String(req.header('X-SmartChain-Signature') || '').trim();

  if (!partner || !/^[A-Z0-9_-]{2,50}$/.test(partner)) {
    return { ok: false, code: 'INVALID_AUTHENTICATION', message: 'Missing or malformed X-SmartChain-Partner header.' };
  }
  if (!timestamp || !/^[0-9]+$/.test(timestamp)) {
    return { ok: false, code: 'INVALID_AUTHENTICATION', message: 'Missing or malformed X-SmartChain-Timestamp header.' };
  }
  if (!signature || !/^[A-Fa-f0-9]{64}$/.test(signature)) {
    return { ok: false, code: 'INVALID_AUTHENTICATION', message: 'Missing or malformed X-SmartChain-Signature header.' };
  }

  // Enforce 300s clock skew tolerance if secret is configured
  if (env.SMARTCHAIN_WEBHOOK_SECRET) {
    const nowSec = Math.floor(Date.now() / 1000);
    const tsSec = parseInt(timestamp, 10);
    if (Math.abs(nowSec - tsSec) > 300) {
      return { ok: false, code: 'STALE_SIGNATURE', message: 'Timestamp is outside the 300 second tolerance window.' };
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const expected = crypto
      .createHmac('sha256', env.SMARTCHAIN_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    if (signature.toLowerCase() !== expected.toLowerCase()) {
      return { ok: false, code: 'INVALID_SIGNATURE', message: 'Callback signature verification failed.' };
    }
  }

  return { ok: true, partner };
}

export async function receiveLogisticsStatusEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = verifySmartChainSignature(req);
    if (!auth.ok) {
      return res.status(401).json({
        acknowledged: false,
        error: { code: auth.code, message: auth.message },
      });
    }

    const schema = z.object({
      schema_version: z.literal('1.0'),
      event_id: z.string().min(1).max(100).regex(/^[A-Za-z0-9._:-]+$/),
      delivery_request_id: z.string().uuid(),
      partner_delivery_request_id: z.string().min(1).max(100),
      status: z.enum(['IN_TRANSIT', 'DELIVERED']),
      occurred_at: z.string().max(40),
      note: z.string().max(1000).nullable().optional(),
      proof_reference: z.string().max(255).nullable().optional(),
    }).strict();

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path.join('.') || 'body');
      const hasUnknown = parsed.error.issues.some((i) => i.code === 'unrecognized_keys');
      return res.status(422).json({
        acknowledged: false,
        error: {
          code: hasUnknown ? 'UNKNOWN_FIELDS' : 'VALIDATION_ERROR',
          message: 'The callback payload is invalid.',
          fields,
        },
      });
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const result = await smartchainService.processLogisticsStatusEvent(parsed.data, auth.partner, rawBody);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({
        acknowledged: false,
        error: { code: err.code || 'ERROR', message: err.message },
      });
    }
    return next(err);
  }
}

export async function submitDeliveryRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      schema_version: z.string().optional().default('1.0'),
      source_system: z.string().optional().default('SMARTCHAIN'),
      delivery_request_id: z.string().uuid(),
      order_reference: z.string().min(1),
      shipment_reference: z.string().min(1),
      partner_code: z.string().min(2).max(50),
      pickup: z.record(z.string(), z.any()).optional().default({}),
      recipient: z.record(z.string(), z.any()).optional().default({}),
      required_delivery_at: z.string().optional(),
      items: z.array(z.any()).min(1),
      callback: z.object({ url: z.string().optional() }).optional(),
    });

    const parsed = schema.parse(req.body);
    const idempotencyKey = req.header('Idempotency-Key') || undefined;
    const correlationId = req.header('X-Correlation-ID') || undefined;

    const result = await smartchainService.createDeliveryRequest(parsed, idempotencyKey, correlationId);
    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      delivery_request_id: result.delivery_request_id,
      partner_delivery_request_id: result.partner_delivery_request_id,
      status: result.status,
      data: result.data,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getDeliveryRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await smartchainService.listDeliveryRequests();
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

export async function recordFinancialEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      schema_version: z.string().min(1),
      event_id: z.string().min(1),
      event_type: z.string().min(1),
      occurred_at: z.string().min(1),
      reference: z.string().min(1),
      status: z.string().min(1),
      amount: z.union([z.string(), z.number()]).optional(),
      currency: z.string().optional().default('PHP'),
    });

    const parsed = schema.parse(req.body);
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const result = await smartchainService.recordFinancialEvent(parsed, rawBody);

    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      event_id: result.event_id,
      outcome: result.outcome,
    });
  } catch (err) {
    return next(err);
  }
}

export async function submitPurchaseOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      schema_version: z.string().optional().default('1.0'),
      source_system: z.string().optional().default('SMARTCHAIN'),
      message_id: z.string().uuid(),
      external_reference_id: z.string().min(1),
      category_type: z.string().min(1),
      currency: z.string().optional().default('PHP'),
      total_amount: z.union([z.string(), z.number()]),
      supplier: z.record(z.string(), z.any()),
      items: z.array(z.any()).min(1),
    });

    const parsed = schema.parse(req.body);
    const idempotencyKey = req.header('Idempotency-Key') || undefined;
    const correlationId = req.header('X-Correlation-ID') || undefined;

    const result = await smartchainService.submitPurchaseOrder(parsed, idempotencyKey, correlationId);
    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      data: result.data,
    });
  } catch (err) {
    return next(err);
  }
}

export async function requestDisbursement(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      external_module: z.string().min(1),
      external_reference_id: z.string().min(1),
      category_type: z.string().min(1),
      amount: z.union([z.string(), z.number()]).transform((v) => Number(v)),
      payee_info: z.record(z.string(), z.any()),
      description: z.string().optional(),
    });

    const parsed = schema.parse(req.body);
    const result = await smartchainService.requestDisbursement(parsed);
    return res.status(200).json({
      success: true,
      bill_number: result.bill_number,
      transaction_code: result.transaction_code,
      status: result.status,
      data: result.data,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getFinanceRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await smartchainService.listFinanceRecords();
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}
