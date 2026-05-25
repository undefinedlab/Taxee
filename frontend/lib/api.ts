/**
 * Backend API base URL. Defaults to production Railway — no local API required.
 * Override with NEXT_PUBLIC_API_URL only for local API development.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://taxee-production.up.railway.app';
