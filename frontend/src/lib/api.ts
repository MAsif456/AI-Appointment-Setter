/**
 * API client for communicating with the NestJS backend.
 * Centralises base URL configuration and fetch helpers.
 */

/** Base URL for the backend API, configurable via environment variable. */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Typed wrapper around fetch that handles JSON parsing and error responses.
 * @param path - API path relative to the base URL (e.g. "/api/clinics/123/ai-settings")
 * @param options - Standard RequestInit options
 * @returns Parsed JSON response
 * @throws Error with the server's error message on non-OK responses
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Attach the JWT from localStorage when running in the browser so
  // protected endpoints (e.g. /analytics/*) authorise correctly. Server
  // components have no localStorage, so the header is simply omitted.
  const authHeader: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('accessToken');
    if (token) authHeader.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
