export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) || 'http://localhost:4000/api/v1/payroll';
export const AUTH_URL: string =
  (import.meta.env.VITE_AUTH_URL as string | undefined) || 'http://localhost:4000/api/v1/auth';
export const GATEWAY_URL: string =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) || 'http://localhost:4000';
