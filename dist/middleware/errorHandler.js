import { ZodError } from 'zod';
export function errorHandler(err, req, res, next) {
    console.error(`[Error] ${req.method} ${req.url}:`, err.message || err);
    if (err instanceof ZodError) {
        const rawIssues = err.issues || err.errors || [];
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request data provided.',
                issues: rawIssues.map((e) => ({
                    field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
                    message: e.message
                }))
            }
        });
    }
    const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
    res.status(statusCode).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_SERVER_ERROR',
            message: err.message || 'An unexpected internal server error occurred.',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }
    });
}
