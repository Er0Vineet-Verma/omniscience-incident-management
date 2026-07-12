import axios from 'axios'

// NOTE (security): the JWT is kept in localStorage for simplicity (portfolio build).
// Production hardening: migrate to an httpOnly, Secure, SameSite cookie set by the
// backend so the token is not reachable from JS (mitigates XSS token theft). That is
// a coordinated backend+frontend change (refresh-token flow) — deferred for now.
export const TOKEN_KEY = 'ims_token'
export const USER_KEY = 'ims_user'

/**
 * Shared axios instance. Base URL is relative so the Vite dev proxy
 * (vite.config.ts) and any reverse proxy in production both work unchanged.
 */
export const api = axios.create({
  baseURL: '/api',
})

// Attach the JWT to every request when present.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401 (expired/invalid token) clear the session and send the user to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/')) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

/** Extracts a human-readable message from a backend ErrorResponse or network error. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message
  }
  return err instanceof Error ? err.message : 'Unexpected error'
}
