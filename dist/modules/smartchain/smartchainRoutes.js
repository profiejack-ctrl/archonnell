import { Router } from 'express';
import * as smartchainController from './smartchainController.js';
const router = Router();
// --- SmartChain Logistics Integration ---
router.post('/logistics/status-events', smartchainController.receiveLogisticsStatusEvent);
router.post('/logistics/delivery-requests', smartchainController.submitDeliveryRequest);
router.get('/logistics/delivery-requests', smartchainController.getDeliveryRequests);
// --- SmartChain Finance Integration ---
router.post('/financial/events', smartchainController.recordFinancialEvent);
router.post('/finance/purchase-orders', smartchainController.submitPurchaseOrder);
router.post('/finance/request-disbursement', smartchainController.requestDisbursement);
router.get('/finance/events', smartchainController.getFinanceRecords);
export default router;
