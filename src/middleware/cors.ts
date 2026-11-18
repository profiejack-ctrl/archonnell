import cors from 'cors';
import { env } from '../config/env.js';

const allowedOriginsList = (env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Check if origin matches allowed list
    if (allowedOriginsList.includes(origin)) {
      return callback(null, true);
    }

    try {
      const url = new URL(origin);
      const hostname = url.hostname.toLowerCase();

      // Check wildcard subdomain matching for *.archonnellincorporated.com or archonnellincorporated.com
      if (
        hostname === 'archonnellincorporated.com' ||
        hostname.endsWith('.archonnellincorporated.com')
      ) {
        return callback(null, true);
      }

      // Check wildcard subdomain matching for *.archonnell.com or archonnell.com
      if (
        hostname === 'archonnell.com' ||
        hostname.endsWith('.archonnell.com')
      ) {
        return callback(null, true);
      }

      // Check Vercel deployments (*.vercel.app)
      if (hostname.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      // Check localhost or loopback on any port
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return callback(null, true);
      }
    } catch {
      // Invalid URL syntax
    }

    // Gracefully deny unlisted origin without throwing an unhandled Error
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-CSRF-Token',
    'x-csrf-token',
    'X-Session-Passive',
    'x-session-passive',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['Set-Cookie', 'X-CSRF-Token', 'x-csrf-token'],
  optionsSuccessStatus: 200
});
