import { z } from 'zod';
import * as pdmsService from './pdmsService.js';
export async function ingestWorkforceRecords(req, res, next) {
    try {
        const schema = z.object({
            records: z.array(z.any()).min(1).max(500),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({
                success: false,
                message: 'records must be a non-empty array of up to 500 items.',
            });
        }
        const result = await pdmsService.ingestWorkforceRecords(parsed.data.records, 'hr2_api');
        return res.status(200).json(result);
    }
    catch (err) {
        return next(err);
    }
}
export async function syncWorkforceFromWfm(req, res, next) {
    try {
        const schema = z.object({
            period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        });
        const { period_start, period_end } = schema.parse(req.body);
        const result = await pdmsService.syncWorkforceFromWfm(period_start, period_end);
        return res.status(200).json({ success: true, ...result });
    }
    catch (err) {
        return next(err);
    }
}
export async function getWorkforceRecords(req, res, next) {
    try {
        const employeeCode = req.query.employee_code;
        const data = await pdmsService.listWorkforceRecords(employeeCode);
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function getDashboard(req, res, next) {
    try {
        const data = await pdmsService.getDashboardSummary();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function getCompetencies(req, res, next) {
    try {
        const data = await pdmsService.listCompetencies();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function createCompetency(req, res, next) {
    try {
        const schema = z.object({
            code: z.string().optional(),
            name: z.string().min(2),
            category: z.string().optional(),
            description: z.string().optional(),
        });
        const parsed = schema.parse(req.body);
        const data = await pdmsService.createCompetency(parsed);
        return res.status(201).json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function getGoals(req, res, next) {
    try {
        const data = await pdmsService.listGoals();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function createGoal(req, res, next) {
    try {
        const schema = z.object({
            employee_id: z.string().uuid().optional(),
            title: z.string().min(2),
            description: z.string().optional(),
            progress: z.number().min(0).max(100).optional(),
            weight: z.number().int().min(0).max(100).optional(),
            status: z.string().optional(),
            due_date: z.string().optional(),
        });
        const parsed = schema.parse(req.body);
        const data = await pdmsService.createGoal(parsed);
        return res.status(201).json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function getKpis(req, res, next) {
    try {
        const data = await pdmsService.listKpis();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function createKpi(req, res, next) {
    try {
        const schema = z.object({
            name: z.string().min(2),
            source: z.string().optional(),
            unit: z.string().optional(),
            target_value: z.number().optional(),
            direction: z.enum(['higher', 'lower']).optional(),
            frequency: z.string().optional(),
        });
        const parsed = schema.parse(req.body);
        const data = await pdmsService.createKpi(parsed);
        return res.status(201).json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function getPerformanceReviews(req, res, next) {
    try {
        const data = await pdmsService.listPerformanceReviews();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function createPerformanceReview(req, res, next) {
    try {
        const schema = z.object({
            employee_id: z.string().uuid().optional(),
            cycle_name: z.string().min(2),
            score: z.number().min(0).max(100).optional(),
            status: z.string().optional(),
            comments: z.string().optional(),
        });
        const parsed = schema.parse(req.body);
        const data = await pdmsService.createPerformanceReview(parsed);
        return res.status(201).json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function getCourses(req, res, next) {
    try {
        const data = await pdmsService.listCourses();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function getTrainings(req, res, next) {
    try {
        const data = await pdmsService.listTrainings();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function getSuccessionPositions(req, res, next) {
    try {
        const data = await pdmsService.listSuccessionPositions();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function getRecognitions(req, res, next) {
    try {
        const data = await pdmsService.listRecognitions();
        return res.json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
export async function createRecognition(req, res, next) {
    try {
        const schema = z.object({
            recipient_employee_id: z.string().uuid().optional(),
            sender_employee_id: z.string().uuid().optional(),
            category: z.string().optional(),
            message: z.string().min(2),
        });
        const parsed = schema.parse(req.body);
        const data = await pdmsService.createRecognition(parsed);
        return res.status(201).json({ success: true, data });
    }
    catch (err) {
        return next(err);
    }
}
