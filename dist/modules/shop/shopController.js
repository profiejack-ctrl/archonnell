import { z } from 'zod';
import * as shopService from './shopService.js';
// Categories
export async function getCategories(req, res, next) {
    try {
        const data = await shopService.getAllCategories();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createCategory(req, res, next) {
    try {
        const schema = z.object({
            name: z.string().min(2),
            slug: z.string().min(2),
            description: z.string().optional()
        });
        const { name, slug, description } = schema.parse(req.body);
        const data = await shopService.createCategory(name, slug, description);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Products
export async function getProducts(req, res, next) {
    try {
        const { category, category_id, search, include_inactive } = req.query;
        const data = await shopService.getAllProducts({
            categorySlug: category,
            categoryId: category_id,
            search: search,
            includeInactive: include_inactive === 'true'
        });
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getProduct(req, res, next) {
    try {
        const data = await shopService.getProductById(req.params.id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createProduct(req, res, next) {
    try {
        const schema = z.object({
            categoryId: z.string().uuid().optional(),
            customId: z.string().optional(),
            title: z.string().min(2),
            description: z.string().optional(),
            brand: z.string().optional(),
            unit: z.enum(['PCS', 'SACK', 'DRUM']).optional(),
            currency: z.string().optional(),
            publishable: z.boolean().optional(),
            price: z.number().positive(),
            stock: z.number().int().nonnegative().optional(),
            sku: z.string().optional(),
            images: z.array(z.string()).optional(),
            specs: z.record(z.string(), z.any()).optional()
        });
        const parsed = schema.parse(req.body);
        const data = await shopService.createProduct(parsed);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function updateProduct(req, res, next) {
    try {
        const data = await shopService.updateProduct(req.params.id, req.body);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Vouchers
export async function validateVoucher(req, res, next) {
    try {
        const schema = z.object({
            code: z.string().min(2),
            subtotal: z.number().nonnegative()
        });
        const { code, subtotal } = schema.parse(req.body);
        const data = await shopService.validateVoucher(code, subtotal);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Orders & Checkout
export async function checkout(req, res, next) {
    try {
        const schema = z.object({
            externalOrderId: z.string().optional(),
            external_order_id: z.string().optional(),
            orderDate: z.string().optional(),
            order_date: z.string().optional(),
            requiredDeliveryDate: z.string().optional(),
            required_delivery_date: z.string().optional(),
            currency: z.string().optional(),
            customerName: z.string().min(2),
            customerEmail: z.string().email(),
            customerPhone: z.string().min(7),
            deliveryAddress: z.string().min(5),
            deliveryNotes: z.string().optional(),
            paymentMethod: z.enum(['GCash', 'Maya', 'Bank', 'COD']),
            gcashRefNumber: z.string().optional(),
            proofImage: z.string().optional(),
            subtotal: z.number().nonnegative(),
            discount: z.number().nonnegative().optional(),
            total: z.number().nonnegative(),
            voucherCode: z.string().optional(),
            items: z.array(z.object({
                productId: z.string().uuid().optional(),
                externalLineId: z.string().optional(),
                external_line_id: z.string().optional(),
                title: z.string().min(1),
                price: z.number().positive(),
                quantity: z.number().int().positive(),
                total: z.number().positive()
            })).min(1, 'Order must contain at least one item')
        });
        const parsed = schema.parse(req.body);
        const userId = req.user?.id;
        const data = await shopService.createOrder({
            ...parsed,
            externalOrderId: parsed.externalOrderId || parsed.external_order_id,
            orderDate: parsed.orderDate || parsed.order_date,
            requiredDeliveryDate: parsed.requiredDeliveryDate || parsed.required_delivery_date,
            items: parsed.items.map((item) => ({
                ...item,
                externalLineId: item.externalLineId || item.external_line_id
            })),
            userId
        });
        res.status(data.replayed ? 200 : 201).json({
            success: true,
            message: 'Order placed successfully and logistics dispatch scheduled.',
            data
        });
    }
    catch (err) {
        next(err);
    }
}
export async function getOrders(req, res, next) {
    try {
        const { status, search } = req.query;
        // If not admin, restrict to logged-in user
        const userId = req.user && req.user.global_role !== 'superadmin' ? req.user.id : undefined;
        const data = await shopService.getAllOrders({
            userId,
            status: status,
            search: search
        });
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getOrder(req, res, next) {
    try {
        const data = await shopService.getOrderByIdOrNumber(req.params.identifier);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function updateOrder(req, res, next) {
    try {
        const schema = z.object({
            deliveryStatus: z.string().min(2),
            trackingStep: z.string().optional()
        });
        const { deliveryStatus, trackingStep } = schema.parse(req.body);
        const data = await shopService.updateOrderStatus(req.params.id, deliveryStatus, trackingStep);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Reviews
export async function getReviews(req, res, next) {
    try {
        const data = await shopService.getProductReviews(req.params.productId);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function addReview(req, res, next) {
    try {
        const schema = z.object({
            productId: z.string().uuid(),
            customerName: z.string().min(2),
            rating: z.number().int().min(1).max(5),
            comment: z.string().optional(),
            aiSentiment: z.string().optional()
        });
        const parsed = schema.parse(req.body);
        const userId = req.user?.id;
        const data = await shopService.createProductReview({
            ...parsed,
            userId
        });
        res.status(201).json({ success: true, message: 'Review submitted.', data });
    }
    catch (err) {
        next(err);
    }
}
// SmartChain-compatible Early Cancellation & Return Requests
export async function requestCancellation(req, res, next) {
    try {
        const schema = z.object({
            external_request_id: z.string().min(1),
            reason: z.string().min(1)
        });
        const parsed = schema.parse(req.body);
        const data = await shopService.requestOrderCancellation(req.params.identifier, parsed);
        res.status(data.replayed ? 200 : 201).json({
            success: true,
            order_no: data.order_no,
            external_order_id: data.external_order_id,
            status: data.status
        });
    }
    catch (err) {
        next(err);
    }
}
export async function submitReturnRequest(req, res, next) {
    try {
        const schema = z.object({
            external_request_id: z.string().min(1),
            external_order_id: z.string().min(1),
            external_line_id: z.string().min(1),
            quantity: z.number().int().positive(),
            reason: z.string().min(1)
        });
        const parsed = schema.parse(req.body);
        const data = await shopService.createReturnRequest(parsed);
        res.status(data.replayed ? 200 : 201).json({
            success: true,
            return_reference: data.return_reference,
            status: data.status
        });
    }
    catch (err) {
        next(err);
    }
}
