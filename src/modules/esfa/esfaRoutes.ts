import { Router } from 'express';
import * as esfaController from './esfaController.js';

const router = Router();

// --- Support Tickets & Knowledge Base ---
router.get('/tickets', esfaController.listTickets);
router.post('/tickets', esfaController.createTicket);
router.get('/tickets/:reference', esfaController.getTicket);
router.post('/tickets/:reference/messages', esfaController.addTicketMessage);
router.post('/tickets/:reference/csat', esfaController.submitTicketCsat);
router.get('/kb/articles', esfaController.listKbArticles);

// --- Payments & Refunds ---
router.post('/payments', esfaController.createPayment);
router.get('/payments/:reference', esfaController.getPayment);
router.post('/refunds', esfaController.createRefund);
router.get('/refunds/:reference', esfaController.getRefund);

// --- Quotes & Shipments ---
router.post('/quotes', esfaController.getQuotes);
router.post('/shipments', esfaController.createShipment);
router.get('/shipments/:reference', esfaController.getShipment);

// --- Analytics & Webhooks ---
router.get('/analytics/summary', esfaController.getAnalyticsSummary);
router.get('/webhook-endpoints', esfaController.listWebhookEndpoints);
router.post('/webhook-endpoints', esfaController.createWebhookEndpoint);

export default router;
