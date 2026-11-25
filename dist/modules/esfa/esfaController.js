import { z } from 'zod';
import * as esfaService from './esfaService.js';
export async function listTickets(req, res, next) {
    try {
        const data = await esfaService.listTickets();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function createTicket(req, res, next) {
    try {
        const schema = z.object({
            requester_type: z.string().optional(),
            requester_external_id: z.string().min(1),
            order_external_id: z.string().optional(),
            payment_reference: z.string().optional(),
            subject: z.string().min(2),
            description: z.string().min(2),
            channel: z.string().optional(),
            category: z.string().optional(),
            priority: z.string().optional(),
        });
        const parsed = schema.parse(req.body);
        const idempotencyKey = req.header('Idempotency-Key') || undefined;
        const result = await esfaService.createTicket(parsed, idempotencyKey);
        return res.status(result.replayed ? 200 : 201).json({
            success: true,
            Idempotency_Replayed: result.replayed || undefined,
            ticket: result.ticket,
        });
    }
    catch (err) {
        return next(err);
    }
}
export async function getTicket(req, res, next) {
    try {
        const ticket = await esfaService.getTicket(req.params.reference);
        return res.json({ success: true, ticket });
    }
    catch (err) {
        return next(err);
    }
}
export async function addTicketMessage(req, res, next) {
    try {
        const schema = z.object({
            body: z.string().min(1),
            author_type: z.string().optional(),
        });
        const parsed = schema.parse(req.body);
        const message = await esfaService.addTicketMessage(req.params.reference, parsed.body, parsed.author_type || 'customer');
        return res.status(201).json({ success: true, message });
    }
    catch (err) {
        return next(err);
    }
}
export async function submitTicketCsat(req, res, next) {
    try {
        const schema = z.object({
            score: z.number().int().min(1).max(5),
            comment: z.string().optional(),
        });
        const parsed = schema.parse(req.body);
        const ticket = await esfaService.submitTicketCsat(req.params.reference, parsed.score, parsed.comment);
        return res.json({ success: true, ticket });
    }
    catch (err) {
        return next(err);
    }
}
export async function listKbArticles(req, res, next) {
    try {
        const data = await esfaService.listKbArticles();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function createPayment(req, res, next) {
    try {
        const schema = z.object({
            order_external_id: z.string().min(1),
            method: z.string().min(1),
            amount: z.number().int().positive().optional(),
        });
        const parsed = schema.parse(req.body);
        const idempotencyKey = req.header('Idempotency-Key') || undefined;
        const result = await esfaService.createPayment(parsed, idempotencyKey);
        return res.status(result.replayed ? 200 : 201).json({
            success: true,
            payment: result.payment,
            next_action: null,
        });
    }
    catch (err) {
        return next(err);
    }
}
export async function getPayment(req, res, next) {
    try {
        const payment = await esfaService.getPayment(req.params.reference);
        return res.json({ success: true, payment });
    }
    catch (err) {
        return next(err);
    }
}
export async function createRefund(req, res, next) {
    try {
        const schema = z.object({
            payment_reference: z.string().min(1),
            amount: z.number().int().positive(),
            reason: z.string().min(1),
            notes: z.string().optional(),
        });
        const parsed = schema.parse(req.body);
        const idempotencyKey = req.header('Idempotency-Key') || undefined;
        const result = await esfaService.createRefund(parsed, idempotencyKey);
        return res.status(result.replayed ? 200 : 201).json({
            success: true,
            refund: result.refund,
        });
    }
    catch (err) {
        return next(err);
    }
}
export async function getRefund(req, res, next) {
    try {
        const refund = await esfaService.getRefund(req.params.reference);
        return res.json({ success: true, refund });
    }
    catch (err) {
        return next(err);
    }
}
export async function getQuotes(req, res, next) {
    try {
        const schema = z.object({
            origin_code: z.string().min(1),
            destination_code: z.string().min(1),
            weight_grams: z.number().int().positive(),
            dimensions: z.record(z.string(), z.any()).optional(),
            cod_amount: z.number().int().nonnegative().optional(),
        });
        const parsed = schema.parse(req.body);
        const quotes = esfaService.calculateQuotes(parsed.weight_grams, parsed.cod_amount || 0);
        return res.json({ success: true, quotes });
    }
    catch (err) {
        return next(err);
    }
}
export async function createShipment(req, res, next) {
    try {
        const schema = z.object({
            order_external_id: z.string().min(1),
            seller_external_id: z.string().optional(),
            courier_id: z.number().int().optional(),
            service_type: z.string().optional(),
            destination: z.record(z.string(), z.any()).optional(),
            weight_grams: z.number().int().positive().optional(),
            tracking_number: z.string().optional(),
        });
        const parsed = schema.parse(req.body);
        const idempotencyKey = req.header('Idempotency-Key') || undefined;
        const result = await esfaService.createShipment(parsed, idempotencyKey);
        return res.status(result.replayed ? 200 : 201).json({
            success: true,
            shipment: result.shipment,
        });
    }
    catch (err) {
        return next(err);
    }
}
export async function getShipment(req, res, next) {
    try {
        const shipment = await esfaService.getShipment(req.params.reference);
        return res.json({ success: true, shipment });
    }
    catch (err) {
        return next(err);
    }
}
export async function getAnalyticsSummary(req, res, next) {
    try {
        const data = await esfaService.getAnalyticsSummary();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function listWebhookEndpoints(req, res, next) {
    try {
        const data = await esfaService.listWebhookEndpoints();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function createWebhookEndpoint(req, res, next) {
    try {
        const schema = z.object({
            url: z.string().url(),
            events: z.array(z.string()).optional(),
        });
        const parsed = schema.parse(req.body);
        const data = await esfaService.createWebhookEndpoint(parsed.url, parsed.events);
        return res.status(201).json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
