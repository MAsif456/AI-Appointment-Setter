import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
  // Required so the browser sends the HttpOnly refresh_token cookie on every request
  // including the /auth/refresh call. Without this, cross-origin cookies are blocked.
  withCredentials: true,
});

// Add access token to outgoing requests from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * Silent token refresh flow:
 *
 * 1. On any 401 response (except /auth/refresh and /auth/login themselves):
 *    - Call POST /auth/refresh with withCredentials so the browser sends the
 *      HttpOnly refresh_token cookie automatically — no JS ever reads it.
 *    - If refresh succeeds: store the new accessToken, retry the original request.
 *    - If refresh also returns 401: clear localStorage and redirect to /login.
 *
 * 2. A boolean flag (isRefreshing) and a promise queue prevent multiple concurrent
 *    refresh calls when several requests 401 simultaneously. All queued requests
 *    are resolved or rejected together once the single refresh attempt settles.
 */
let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  refreshQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint =
      originalRequest?.url === '/auth/refresh' ||
      originalRequest?.url === '/auth/login';

    if (error.response?.status !== 401 || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Another refresh is already in-flight — queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const newToken: string = data.accessToken;
      localStorage.setItem('accessToken', newToken);
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login?expired=true';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
